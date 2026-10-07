const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProviderService } = require('../dist/provider/provider.service');

test('provider transport routing, authentication and no write retries', async () => {
  const original = global.fetch;
  const values = { SMM_PROVIDER_URL: 'https://subvietnam.net/api/v2', SMM_PROVIDER_API_KEY: 'secret',
    SMM_PROVIDER_TRANSPORT_URL: 'http://provider-transport:8192/v1', SMM_TRANSPORT_TOKEN: 'transport-secret' };
  const provider = new ProviderService({ get: key => values[key] });
  let calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ balance: '123', currency: 'VND' });
  };
  try {
    assert.equal((await provider.balance()).balance, '123');
    assert.equal(calls[0].url, values.SMM_PROVIDER_TRANSPORT_URL);
    assert.equal(calls[0].options.headers.authorization, 'Bearer transport-secret');
    assert.equal(calls[0].options.redirect, 'error');
    assert.deepEqual(JSON.parse(calls[0].options.body), { key: 'secret', action: 'balance' });
    for (const mode of ['challenge', 'timeout']) {
      calls = [];
      global.fetch = async () => {
        calls.push(1);
        if (mode === 'timeout') throw new Error('timeout');
        return Response.json({ error: 'PROVIDER_CHALLENGE' }, { status: 503 });
      };
      await assert.rejects(provider.addOrder('1', 'https://example.com', 1));
      assert.equal(calls.length, 1);
    }
    delete values.SMM_PROVIDER_TRANSPORT_URL;
    global.fetch = async (url, options) => {
      assert.equal(url, values.SMM_PROVIDER_URL);
      assert.equal(options.headers.authorization, undefined);
      return Response.json({ balance: '123', currency: 'VND' });
    };
    await provider.balance();
  } finally { global.fetch = original; }
});
