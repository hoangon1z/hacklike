const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Prisma}=require('@prisma/client');
const {ProviderHealthService}=require('../dist/provider/provider-health.service');
function fixture({configured=true,result={balance:'100',currency:'USD'},failed=false,locked=true}={}){
 let state={status:'UNKNOWN',balance:'55',currency:'VND',lastCheckedAt:null,lowBalanceThreshold:new Prisma.Decimal(2000000),incidentOpenedAt:new Date(0)},calls=0,writes=0;
 const tx={$queryRaw:async()=>[{locked}],systemSetting:{findUnique:async()=>({value:25000})},providerState:{findUnique:async()=>state,upsert:async q=>{writes++;state={...state,...q.update};return state;}}};
 const db={$transaction:async fn=>fn(tx)};
 const provider={balance:async()=>{calls++;if(failed)throw Error('secret upstream details');return result;}};
 const service=new ProviderHealthService(db,provider,{get:()=>configured?'configured':undefined});
 return {service,get state(){return state},get calls(){return calls},get writes(){return writes}};
}
test('successful USD check uses exchange rate and records timestamp',async()=>{const f=fixture();await f.service.check();assert.equal(f.state.status,'HEALTHY');assert.equal(f.state.balance,'100');assert.ok(f.state.lastCheckedAt instanceof Date);assert.equal(f.state.incidentOpenedAt.getTime(),0);});
test('low balance uses VND threshold',async()=>{const f=fixture({result:{balance:'10',currency:'USD'}});await f.service.check();assert.equal(f.state.status,'LOW_BALANCE');});
test('failure preserves balance and does not expose upstream error',async()=>{const f=fixture({failed:true});const s=await f.service.check();assert.equal(s.status,'UNAVAILABLE');assert.equal(s.balance,'55');assert.ok(!JSON.stringify(s).includes('secret'));});
test('missing configuration makes no provider call',async()=>{const f=fixture({configured:false});await f.service.check();assert.equal(f.state.status,'NOT_CONFIGURED');assert.equal(f.calls,0);});
test('invalid balance is unavailable rather than healthy',async()=>{const f=fixture({result:{balance:'NaN',currency:'VND'}});await f.service.check();assert.equal(f.state.status,'UNAVAILABLE');assert.equal(f.state.balance,'55');});
test('simultaneous checks share one request',async()=>{const f=fixture();await Promise.all([f.service.check(),f.service.check()]);assert.equal(f.calls,1);assert.equal(f.writes,1);});
test('replica lock conflict makes no extra provider call or write',async()=>{const f=fixture({locked:false});await f.service.check();assert.equal(f.calls,0);assert.equal(f.writes,0);});
