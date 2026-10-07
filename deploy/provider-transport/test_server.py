import io
import json
import threading
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from server import Transport, TransportError, make_handler, PROVIDER_URL


class Response(io.BytesIO):
    def __init__(self, data, status=200, headers=None):
        super().__init__(json.dumps(data).encode())
        self.status = status
        self.headers = headers or {}


class FakeOpener:
    def __init__(self, mode='ok'):
        self.calls = []
        self.mode = mode

    def open(self, request, timeout):
        self.calls.append(request)
        if request.full_url == 'http://solver/v1':
            return Response({'status': 'ok', 'solution': {
                'userAgent': 'browser-agent',
                'cookies': [{'name': 'cf_clearance', 'value': 'clearance', 'domain': '.subvietnam.net'}],
            }})
        if self.mode == 'challenge':
            return Response({}, 403, {'cf-mitigated': 'challenge'})
        if self.mode == 'timeout':
            raise TimeoutError()
        if self.mode == 'redirect':
            raise urllib.error.HTTPError(request.full_url, 302, 'redirect', {}, io.BytesIO(b'<html>redirect</html>'))
        return Response({'balance': '123', 'currency': 'VND'})


class Tests(unittest.TestCase):
    def test_json_cookie_agent_and_cache(self):
        opener = FakeOpener()
        transport = Transport('http://solver/v1', opener)
        payload = {'key': 'secret', 'action': 'balance'}
        self.assertEqual(transport.call(payload)[0], 200)
        self.assertEqual(transport.call(payload)[0], 200)
        self.assertEqual(len(opener.calls), 3)
        self.assertNotIn('secret', opener.calls[0].data.decode())
        request = opener.calls[1]
        self.assertEqual(request.full_url, PROVIDER_URL)
        self.assertEqual(json.loads(request.data), payload)
        self.assertEqual(request.get_header('User-agent'), 'browser-agent')
        self.assertEqual(request.get_header('Cookie'), 'cf_clearance=clearance')

    def test_concurrent_clearance_uses_one_browser(self):
        opener = FakeOpener()
        transport = Transport('http://solver/v1', opener)
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda _: transport.clearance(), range(8)))
        self.assertEqual(len(opener.calls), 1)

    def test_no_resubmission_on_challenge_timeout_or_redirect(self):
        for action in ('add', 'refill'):
            for mode in ('challenge', 'timeout', 'redirect'):
                with self.subTest(action=action, mode=mode):
                    opener = FakeOpener(mode)
                    transport = Transport('http://solver/v1', opener)
                    try:
                        status, _ = transport.call({'key': 'secret', 'action': action})
                        self.assertEqual(status, 503)
                        self.assertIsNone(transport.cached)
                    except TransportError:
                        self.assertIn(mode, ('timeout', 'redirect'))
                    self.assertEqual(sum(r.full_url == PROVIDER_URL for r in opener.calls), 1)

    def test_http_auth_and_action_validation(self):
        opener = FakeOpener()
        token = 'a' * 64
        server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(Transport('http://solver/v1', opener), token))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            for bearer, action, expected in [('', 'balance', 401), ('wrong', 'balance', 401), (token, 'arbitrary', 400), (token, 'balance', 200)]:
                req = urllib.request.Request(f'http://127.0.0.1:{server.server_port}/v1',
                    data=json.dumps({'key': 'secret', 'action': action}).encode(),
                    headers={'Authorization': 'Bearer ' + bearer})
                try:
                    response = urllib.request.urlopen(req)
                except urllib.error.HTTPError as error:
                    response = error
                with response:
                    self.assertEqual(response.status, expected)
            self.assertEqual(len(opener.calls), 2)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
