"""Private JSON transport for SubVietnam. No retries of upstream requests."""
import hmac
import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROVIDER_URL = 'https://subvietnam.net/api/v2'
MAX_RESPONSE = 16 * 1024 * 1024


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class TransportError(Exception):
    pass


class Transport:
    def __init__(self, solver_url, opener=None):
        self.solver_url = solver_url
        self.opener = opener or urllib.request.build_opener(
            urllib.request.ProxyHandler({}), NoRedirect())
        self.lock = threading.Lock()
        self.cached = None

    def clearance(self):
        if not self.lock.acquire(timeout=25):
            raise TransportError('CLEARANCE_BUSY')
        try:
            if self.cached and self.cached['expires'] > time.time():
                return self.cached
            # No provider key or customer/order data is sent to the browser service.
            request = urllib.request.Request(self.solver_url, data=json.dumps({
                'cmd': 'request.get', 'url': PROVIDER_URL, 'maxTimeout': 20000,
            }).encode(), headers={'Content-Type': 'application/json'})
            try:
                with self.opener.open(request, timeout=25) as response:
                    result = json.loads(response.read(MAX_RESPONSE))
            except Exception:
                raise TransportError('CLEARANCE_FAILED') from None
            solution = result.get('solution', {})
            cookie = next((c for c in solution.get('cookies', [])
                           if c.get('name') == 'cf_clearance'
                           and c.get('domain', '').lstrip('.') == 'subvietnam.net'), None)
            agent = solution.get('userAgent')
            if result.get('status') != 'ok' or not cookie or not agent:
                raise TransportError('CLEARANCE_FAILED')
            expiry = cookie.get('expires', cookie.get('expiry', -1))
            expires = min(time.time() + 600, expiry - 30) if isinstance(expiry, (int, float)) and expiry > 0 else time.time() + 600
            self.cached = {'expires': expires, 'headers': {
                'User-Agent': agent, 'Cookie': 'cf_clearance=' + cookie['value'],
                'Content-Type': 'application/json',
            }}
            return self.cached
        finally:
            self.lock.release()

    def invalidate(self, used):
        with self.lock:
            if self.cached is used:
                self.cached = None

    def call(self, payload):
        clearance = self.clearance()
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
    transport = Transport(os.environ.get('FLARESOLVERR_URL', 'http://flaresolverr:8191/v1'))
    ThreadingHTTPServer(('0.0.0.0', 8192), make_handler(transport, token)).serve_forever()
