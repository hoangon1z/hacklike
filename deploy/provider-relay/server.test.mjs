import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRelay } from './server.mjs';

test('relay authenticates, restricts requests and sanitizes provider responses', async () => {
  const token = 'a'.repeat(64);
  let calls = 0;
  let mode = 'ok';
  const server = createRelay({ token, apiKey: 'test-secret', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://subvietnam.net/api/v2');
    assert.deepEqual(JSON.parse(options.body), { key: 'test-secret', action: 'balance' });
    assert.equal(options.redirect, 'error');
    if (mode === 'challenge') return new Response('<html>challenge</html>', {
      status: 403, headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'test-ray' },
    });
    if (mode === 'invalid') return Response.json({ balance: null, currency: 'VND' });
    if (mode === 'rejected') return Response.json({ error: 'echoed test-secret' });
    if (mode === 'broken') throw new Error('test-secret');
    return Response.json({ balance: '123.45', currency: 'VND', private: 'test-secret' });
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `Bearer ${token}` };
  try {
    assert.equal((await fetch(`${origin}/balance`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${origin}/balance`, { method: 'POST', headers: { Authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await fetch(`${origin}/add`, { method: 'POST', headers })).status, 404);
    assert.equal((await fetch(`${origin}/balance`, { headers })).status, 404);
    assert.equal((await fetch(`${origin}/balance`, { method: 'POST', headers, body: '{"action":"add"}' })).status, 400);
    assert.equal(calls, 0);
    const request = () => fetch(`${origin}/balance`, { method: 'POST', headers });
    assert.deepEqual(await (await request()).json(), { balance: '123.45', currency: 'VND' });
    mode = 'challenge';
    const challenge = await request();
    assert.equal(challenge.status, 502);
    assert.deepEqual(await challenge.json(), { error: 'PROVIDER_HTTP_ERROR', upstreamStatus: 403, challenge: true, ray: 'test-ray' });
    for (const [value, expected] of [['invalid', 'INVALID_PROVIDER_RESPONSE'], ['rejected', 'PROVIDER_REJECTED'], ['broken', 'PROVIDER_REQUEST_FAILED']]) {
      mode = value;
      const result = await request();
      assert.equal(result.status, 502);
      assert.deepEqual(await result.json(), { error: expected });
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
