require('reflect-metadata');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Prisma}=require('@prisma/client');
const {BinanceService,depositIdentity}=require('../dist/payments/binance.service');
const remote={id:'remote',coin:'USDT',amount:'4.001234',network:'BSC',status:1,address:'0xABC',txId:'tx',insertTime:Date.now()};
function fixture({candidates=[],duplicate=false,status='WAITING'}={}){
  const state={credits:[],payments:[],reviews:0,where:null};
  const request={id:'request',userId:'customer',requestedVnd:new Prisma.Decimal(100000),status};
  const tx={
    $queryRaw:async()=>[],
    $executeRaw:async()=>1,
    paymentTransaction:{findFirst:async()=>duplicate?{id:'duplicate'}:null,create:async({data})=>{state.payments.push(data);}},
    depositRequest:{findMany:async({where})=>{state.where=where;return candidates;},findUniqueOrThrow:async()=>request,updateMany:async()=>{state.reviews++;},update:async()=>{}},
  };
  const service=new BinanceService({get:()=>''},{$transaction:async fn=>fn(tx)},{deposit:async(...args)=>state.credits.push(args)});
  return {service,state};
}
test('only successful supported USDT deposits are eligible',()=>{
  assert.equal(depositIdentity({...remote,status:6}),null);
  assert.equal(depositIdentity({...remote,amount:'-1'}),null);
  assert.equal(depositIdentity({...remote,network:'ETH'}),null);
  assert.equal(depositIdentity({...remote,travelRuleStatus:1}),null);
  assert.equal(depositIdentity(remote).address,'0xabc');
});
test('TRON address casing is preserved',()=>assert.equal(depositIdentity({...remote,network:'TRX',address:'TAbC'}).address,'TAbC'));
test('duplicate remote transaction never credits',async()=>{
  const {service,state}=fixture({duplicate:true});
  assert.equal(await service.applyDeposit(remote),false);
  assert.equal(state.credits.length,0);
});
test('ambiguous deposit goes to review, never selects first customer',async()=>{
  const {service,state}=fixture({candidates:[{id:'a'},{id:'b'}]});
  assert.equal(await service.applyDeposit(remote),false);
  assert.equal(state.reviews,1);
  assert.equal(state.credits.length,0);
  assert.equal(state.payments[0].depositRequestId,undefined);
});
test('matching uses actual deposit time, without future-request allowance',async()=>{
  const {service,state}=fixture();await service.applyDeposit(remote);
  assert.equal(state.where.createdAt.lte.getTime(),remote.insertTime);
  assert.equal(state.where.expiresAt.gte.getTime(),remote.insertTime);
});
test('second transfer cannot credit a completed request again',async()=>{
  const {service,state}=fixture({candidates:[{id:'request'}],status:'COMPLETED'});
  assert.equal(await service.applyDeposit(remote),false);
  assert.equal(state.credits.length,0);
});
test('on-time deposit with late confirmation retains VND snapshot and request idempotency',async()=>{
  const {service,state}=fixture({candidates:[{id:'request'}],status:'EXPIRED'});
  assert.equal(await service.applyDeposit(remote),true);
  assert.equal(state.credits[0][2].toNumber(),100000);
  assert.equal(state.credits[0][4],'deposit:binance:request:request');
});
