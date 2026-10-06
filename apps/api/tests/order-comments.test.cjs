require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { OrdersService } = require('../dist/orders/orders.service');

function fixture(type = 'Custom Comments') {
  let reserved = false;
  const tx = {
    service: { findFirst: async () => ({ id: 'service', providerType: type, min: 2, max: 10, sellingRate: new Prisma.Decimal(100000), providerRate: new Prisma.Decimal(80000) }) },
    systemSetting: { findUnique: async () => null },
    order: { create: async ({ data }) => ({ id: 'order', ...data }) },
    orderStatusHistory: { create: async () => {} },
    outboxEvent: { create: async () => {} },
  };
  const service = new OrdersService({ order: { findUnique: async () => null }, $transaction: async fn => fn(tx) }, { reserve: async () => { reserved = true; } }, { add: async () => {} });
  return { service, reserved: () => reserved };
}
const base = { serviceId: 'service', link: 'https://example.com/post', quantity: 2 };
test('missing comments are rejected before reserving funds', async () => {
  const f = fixture();
  await assert.rejects(f.service.create('user', 'test-key-123456', base), e => e.code === 'INVALID_COMMENTS');
  assert.equal(f.reserved(), false);
});
test('comment count must match quantity', async () => {
  const f = fixture();
  await assert.rejects(f.service.create('user', 'test-key-123456', { ...base, comments: 'one' }), e => e.code === 'INVALID_COMMENTS');
  assert.equal(f.reserved(), false);
});
test('scheduled order retains normalized comments and correct charge', async () => {
  const f = fixture();
  const result = await f.service.create('user', 'test-key-123456', { ...base, comments: ' first \r\n\n second ', scheduledAt: new Date(Date.now() + 3600000).toISOString() });
  assert.equal(result.comments, 'first\nsecond');
  assert.equal(result.status, 'SCHEDULED');
  assert.equal(result.chargeAmount.toNumber(), 200);
});
test('default service does not require comment content', async () => {
  const result = await fixture('Default').service.create('user', 'test-key-123456', base);
  assert.equal(result.comments, null);
});
