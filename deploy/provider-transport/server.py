"""Private JSON transport for SubVietnam. No retries of upstream requests."""
import hmac
import json
import os
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import quote, urlsplit, urlunsplit

import requests
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROVIDER_URL = 'https://subvietnam.net/api/v2'
MAX_RESPONSE = 16 * 1024 * 1024
CLEARANCE_RETRY_DELAY = 60


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class TransportError(Exception):
    pass


class Transport:
    def __init__(self, solver_url, opener=None, proxy_url="", proxy_username="", proxy_password=""):
        self.solver_url = solver_url
        self.opener = opener or urllib.request.build_opener(
            urllib.request.ProxyHandler({}), NoRedirect())
        self.lock = threading.Lock()
        self.cached = None
        self.clearance_retry_at = 0
        self.proxy_url = proxy_url.strip()
        self.proxy_username = proxy_username
        self.proxy_password = proxy_password
        self.proxy = None
        self.requests_proxies = {}
        if self.proxy_url:
            parsed = urlsplit(self.proxy_url)
            if parsed.scheme not in ("http", "https") or not parsed.hostname or not parsed.port:
                raise SystemExit("SMM_PROXY_URL must be an HTTP(S) proxy URL with a port")
            self.proxy = {"url": self.proxy_url}
            if self.proxy_username:
                self.proxy["username"] = self.proxy_username
                self.proxy["password"] = self.proxy_password
            auth = ""
            if self.proxy_username:
                auth = quote(self.proxy_username, safe="") + ":" + quote(self.proxy_password, safe="") + "@"
            authenticated = urlunsplit((parsed.scheme, auth + parsed.netloc, parsed.path, parsed.query, parsed.fragment))
            self.requests_proxies = {"http": authenticated, "https": authenticated}

    def clearance(self):
        # A failed solve must not let every order-status poll start a browser.
        if self.clearance_retry_at > time.time():
            raise TransportError("CLEARANCE_COOLDOWN")
        if not self.lock.acquire(timeout=25):
            raise TransportError('CLEARANCE_BUSY')
        try:
            if self.cached and self.cached['expires'] > time.time():
                return self.cached
            if self.clearance_retry_at > time.time():
                raise TransportError("CLEARANCE_COOLDOWN")
            # No provider key or customer/order data is sent to the browser service.
            solver_payload = {
                'cmd': 'request.get', 'url': PROVIDER_URL, 'maxTimeout': 20000,
            }
            if self.proxy:
                solver_payload['proxy'] = self.proxy
            request = urllib.request.Request(
                self.solver_url, data=json.dumps(solver_payload).encode(),
                headers={'Content-Type': 'application/json'})
            try:
                with self.opener.open(request, timeout=25) as response:
                    result = json.loads(response.read(MAX_RESPONSE))
            except Exception:
                self.clearance_retry_at = time.time() + CLEARANCE_RETRY_DELAY
                raise TransportError('CLEARANCE_FAILED') from None
            solution = result.get('solution', {})
            cookie = next((c for c in solution.get('cookies', [])
                           if c.get('name') == 'cf_clearance'
                           and c.get('domain', '').lstrip('.') == 'subvietnam.net'), None)
            agent = solution.get('userAgent')
            if (result.get('status') != 'ok' or not agent
                    or (not cookie and solution.get('status') != 200)):
                self.clearance_retry_at = time.time() + CLEARANCE_RETRY_DELAY
                raise TransportError('CLEARANCE_FAILED')
            expiry = cookie.get('expires', cookie.get('expiry', -1)) if cookie else -1
            expires = min(time.time() + 600, expiry - 30) if isinstance(expiry, (int, float)) and expiry > 0 else time.time() + 600
            headers = {'User-Agent': agent, 'Content-Type': 'application/json'}
            if cookie:
                headers['Cookie'] = 'cf_clearance=' + cookie['value']
            self.cached = {'expires': expires, 'headers': headers}
            self.clearance_retry_at = 0
            return self.cached
        finally:
            self.lock.release()

    def invalidate(self, used):
        with self.lock:
            if self.cached is used:
                self.cached = None

    def call(self, payload):
        clearance = self.clearance()
        if not self.requests_proxies:
            request = urllib.request.Request(PROVIDER_URL, data=json.dumps(payload).encode(),
                                             headers=clearance['headers'], method='POST')
            try:
                response = self.opener.open(request, timeout=20)
            except urllib.error.HTTPError as error:
                response = error
            except Exception:
                # The upstream may have accepted an order. Never resubmit automatically.
                raise TransportError('UPSTREAM_RESULT_UNKNOWN') from None
            with response:
                if response.headers.get('cf-mitigated') == 'challenge':
                    self.invalidate(clearance)
                    return 503, {'error': 'PROVIDER_CHALLENGE'}
                raw = response.read(MAX_RESPONSE + 1)
                if len(raw) > MAX_RESPONSE:
                    raise TransportError('UPSTREAM_RESPONSE_TOO_LARGE')
                try:
                    data = json.loads(raw)
                except (ValueError, UnicodeDecodeError):
                    raise TransportError('UPSTREAM_NOT_JSON') from None
                if not isinstance(data, (dict, list)):
                    raise TransportError('UPSTREAM_NOT_JSON')
                return response.status, data
        try:
            response = requests.post(
                PROVIDER_URL, json=payload, headers=clearance['headers'], timeout=20,
                allow_redirects=False, proxies=self.requests_proxies)
        except requests.RequestException:
            # The upstream may have accepted an order. Never resubmit automatically.
            raise TransportError('UPSTREAM_RESULT_UNKNOWN') from None
        if response.headers.get('cf-mitigated') == 'challenge':
            self.invalidate(clearance)
            return 503, {'error': 'PROVIDER_CHALLENGE'}
        raw = response.content
        if len(raw) > MAX_RESPONSE:
            raise TransportError('UPSTREAM_RESPONSE_TOO_LARGE')
        try:
            data = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise TransportError('UPSTREAM_NOT_JSON') from None
        if not isinstance(data, (dict, list)):
            raise TransportError('UPSTREAM_NOT_JSON')
        return response.status_code, data


def make_handler(transport, token):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_):
            pass  # Never log request bodies, headers, keys or cookies.

        def reply(self, status, data):
            body = json.dumps(data).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            self.reply(200 if self.path == '/health' else 404, {'ok': self.path == '/health'})

        def do_POST(self):
            if not hmac.compare_digest(self.headers.get('Authorization', '').encode(),
                                       ('Bearer ' + token).encode()):
                return self.reply(401, {'error': 'UNAUTHORIZED'})
            if self.path != '/v1':
                return self.reply(404, {'error': 'NOT_FOUND'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 256 * 1024 or self.headers.get('Transfer-Encoding'):
                    raise ValueError()
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict) or payload.get('action') not in ('balance', 'services', 'status', 'add', 'refill'):
                    raise ValueError()
                if not isinstance(payload.get('key'), str) or not payload['key']:
                    raise ValueError()
            except (ValueError, OSError):
                return self.reply(400, {'error': 'INVALID_REQUEST'})
            try:
                status, data = transport.call(payload)
            except TransportError as error:
                status, data = 502, {'error': str(error)}
            except Exception:
                status, data = 502, {'error': 'TRANSPORT_FAILED'}
            print(json.dumps({'action': payload['action'], 'http': status}), flush=True)
            self.reply(status, data)
    return Handler


if __name__ == '__main__':
    token = os.environ.get('SMM_TRANSPORT_TOKEN', '')
    if len(token) < 32:
        raise SystemExit('SMM_TRANSPORT_TOKEN must have at least 32 characters')
    transport = Transport(
        os.environ.get('FLARESOLVERR_URL', 'http://flaresolverr:8191/v1'),
        proxy_url=os.environ.get('SMM_PROXY_URL', ''),
        proxy_username=os.environ.get('SMM_PROXY_USERNAME', ''),
        proxy_password=os.environ.get('SMM_PROXY_PASSWORD', ''),
    )
    ThreadingHTTPServer(('0.0.0.0', 8192), make_handler(transport, token)).serve_forever()
