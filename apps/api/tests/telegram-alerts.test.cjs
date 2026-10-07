require('reflect-metadata');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Prisma}=require('@prisma/client');
const {NotificationsService}=require('../dist/notifications/notifications.service');
function fixture(){
  const flags=new Map(),events=[];
  const tx={$executeRaw:async()=>1,systemSetting:{findUnique:async({where})=>where.key==='PROVIDER_RATE_MULTIPLIER'?{value:25000}:flags.has(where.key)?{value:flags.get(where.key)}:null,upsert:async({where,update})=>flags.set(where.key,update.value)},outboxEvent:{create:async({data})=>events.push(data)}};
  const db={...tx,$transaction:async fn=>fn(tx)};
  return {service:new NotificationsService(db,{get:()=> 'test-only'}),events,db};
}
test('below 100k alerts once per episode, exact threshold recovers',async()=>{
  const {service,events}=fixture();
  await service.observeLowBalance('99999','VND');await service.observeLowBalance('0','VND');
  assert.equal(events.length,1);assert.match(events[0].payload.text,/dưới 100\.000/);
  await service.observeLowBalance('100000','VND');assert.equal(events.length,2);assert.match(events[1].payload.text,/phục hồi/);
  await service.observeLowBalance('200000','VND');assert.equal(events.length,2);
  await service.observeLowBalance('10','VND');assert.equal(events.length,3);
});
test('USD is compared after VND conversion and invalid balance never recovers',async()=>{
  const {service,events}=fixture();
  await service.observeLowBalance('3','USD');assert.equal(events.length,1);
  await assert.rejects(service.observeLowBalance('NaN','USD'));assert.equal(events.length,1);
  await service.observeLowBalance('4','USD');assert.equal(events.length,2);
});
test('alert failures cannot reject order balance observation',async()=>{
  const {service,db}=fixture();db.$transaction=async()=>{throw Error('test failure');};
  await service.observeProviderBalance('1','VND',new Prisma.Decimal(100),'test-order');
});
test('waiting order incident queues once and rearms when queue clears',async()=>{
  const {service,db,events}=fixture();let count=2;
  db.order={aggregate:async()=>({_count:{_all:count},_sum:{costAmount:new Prisma.Decimal(200000)}})};
  db.$queryRaw=async()=>[];
  await service.scanOrders();await service.scanOrders();assert.equal(events.length,1);
  count=0;await service.scanOrders();count=1;await service.scanOrders();assert.equal(events.length,2);
});
