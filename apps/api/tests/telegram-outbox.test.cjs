require('reflect-metadata');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {OutboxProcessor}=require('../dist/outbox/outbox.processor');
function fixture({failed=false,locked=true}={}){
  const order={id:'order-event',aggregateId:'order',eventType:'ORDER_CREATED'};
  const alert={id:'alert',payload:{text:'Test only'},attempts:0,processedAt:null};
  const actions=[];
  const tx={$queryRaw:async()=>[{locked}],outboxEvent:{findUnique:async()=>alert,update:async({where,data})=>{actions.push({id:where.id,data});if(where.id==='alert')Object.assign(alert,data);}}};
  const db={$transaction:async fn=>fn(tx),outboxEvent:{...tx.outboxEvent,findMany:async({where})=>typeof where.eventType==='string'?[alert]:[order]}};
  const notifications={configured:()=>true,scanOrders:async()=>{},send:async()=>{actions.push({send:true});if(failed)throw Error('test failure');}};
  const service=new OutboxProcessor(db,{}, {add:async()=>actions.push({order:true})},notifications);
  return {service,actions,alert};
}
test('Telegram outage never prevents order job dispatch and schedules backoff',async()=>{
  const {service,actions,alert}=fixture({failed:true});
  await service.process({name:'dispatch'});
  assert.equal(actions[0].order,true);assert.equal(alert.processedAt,null);
  assert.ok(Date.parse(alert.payload.retryAt)>Date.now());
  await service.process({name:'dispatch'});assert.equal(actions.filter(x=>x.send).length,1);
});
test('successful send is marked once; other replica cannot send while locked',async()=>{
  const f=fixture();await f.service.process({name:'dispatch'});await f.service.process({name:'dispatch'});
  assert.ok(f.alert.processedAt instanceof Date);assert.equal(f.actions.filter(x=>x.send).length,1);
  const other=fixture({locked:false});await other.service.process({name:'dispatch'});assert.equal(other.actions.filter(x=>x.send).length,0);
});
