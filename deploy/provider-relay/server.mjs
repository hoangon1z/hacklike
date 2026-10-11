import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const endpoint = 'https://subvietnam.net/api/v2';
const digest = value => createHash('sha256').update(value).digest();

export function createRelay({ token, apiKey, fetchImpl = fetch }) {
  if (!token || token.length < 32 || !apiKey) {
    throw new Error('Cần RELAY_TOKEN ít nhất 32 ký tự và SMM_PROVIDER_API_KEY.');
  }
  let busy = false;
  const server = http.createServer(async (req, res) => {
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    if (!timingSafeEqual(digest(req.headers.authorization ?? ''), digest(`Bearer ${token}`))) {
      return reply(401, { error: 'UNAUTHORIZED' });
    }
    if (req.url !== '/balance' || req.method !== 'POST') {
      return reply(404, { error: 'NOT_FOUND' });
    }
    // No caller-supplied URL, action, key or body is forwarded.
    if (req.headers['transfer-encoding'] || Number(req.headers['content-length'] ?? 0) !== 0) {
      return reply(400, { error: 'BODY_NOT_ALLOWED' });
    }
    if (busy) return reply(429, { error: 'CHECK_IN_PROGRESS' });
    busy = true;
    try {
      const upstream = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey, action: 'balance' }),
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!upstream.ok) {
        const diagnostic = {
          error: 'PROVIDER_HTTP_ERROR',
          upstreamStatus: upstream.status,
          challenge: upstream.headers.get('cf-mitigated') === 'challenge',
          ray: upstream.headers.get('cf-ray'),
        };
        await upstream.body?.cancel();
        return reply(502, diagnostic);
      }
      const data = await upstream.json();
      if (data?.error) return reply(502, { error: 'PROVIDER_REJECTED' });
      if (!data || !['string', 'number'].includes(typeof data.balance) ||
          !/^\d+(\.\d+)?$/.test(String(data.balance)) ||
          typeof data.currency !== 'string' || !/^[A-Z]{3}$/.test(data.currency)) {
        return reply(502, { error: 'INVALID_PROVIDER_RESPONSE' });
      }
      return reply(200, { balance: String(data.balance), currency: data.currency });
    } catch {
      return reply(502, { error: 'PROVIDER_REQUEST_FAILED' });
    } finally {
      busy = false;
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = createRelay({ token: process.env.RELAY_TOKEN, apiKey: process.env.SMM_PROVIDER_API_KEY });
    server.on('error', () => { console.error('Không mở được cổng 8787.'); process.exitCode = 1; });
    server.listen(8787, '127.0.0.1', () => console.log('Relay balance: http://127.0.0.1:8787 (Ctrl+C để dừng)'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
