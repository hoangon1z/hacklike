require('reflect-metadata');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Prisma}=require('@prisma/client');
const {ManagementService}=require('../dist/admin/management.service');
const {JwtAuthGuard}=require('../dist/auth/jwt-auth.guard');
const {providerBalanceVnd}=require('../dist/shared/provider-money');
const superUser={sub:'admin',role:'SUPER_ADMIN',email:'admin@example.test',v:0};
function fixture(options={}){
 const events=[];let ledger=options.previous??null;let credits=0;
 const wallet={id:'wallet',userId:'customer',balance:new Prisma.Decimal(100),reserved:new Prisma.Decimal(30)};
 const order={id:'order',status:options.orderStatus??'QUEUED',providerOrderId:null,userId:'customer',chargeAmount:new Prisma.Decimal(20)};
 const deposit={id:'deposit',userId:'customer',method:'USDT_TRC20',network:'TRX',destinationAddress:'TReceiver',usdtRate:new Prisma.Decimal(25000),requestedVnd:new Prisma.Decimal(100000),creditedVnd:null,status:'WAITING'};
 const payment={id:'payment',provider:'BINANCE',externalId:'remote',depositRequestId:options.alreadyMatched?'other':null,network:'TRX',amount:new Prisma.Decimal(4),rawPayload:{address:options.wrongAddress?'TWrong':'TReceiver'}};
 const tx={
  $queryRaw:async()=>{events.push('lock');return[];},$executeRaw:async()=>1,
  user:{findUnique:async()=>({id:'admin',status:'ACTIVE',role:options.role??'SUPER_ADMIN',tokenVersion:0})},
  wallet:{findUniqueOrThrow:async()=>wallet,update:async({data})=>{events.push('wallet-update');wallet.balance=wallet.balance.add(data.balance.increment);return wallet;}},
  walletTransaction:{findUnique:async()=>ledger,create:async({data})=>{ledger=data;return data;}},
  order:{findUniqueOrThrow:async()=>order,update:async({data})=>Object.assign(order,data)},
  depositRequest:{findUniqueOrThrow:async()=>deposit,update:async({data})=>Object.assign(deposit,data)},
  paymentTransaction:{findUniqueOrThrow:async()=>payment,update:async({data})=>Object.assign(payment,data)},
  outboxEvent:{create:async()=>{}},orderStatusHistory:{create:async()=>{}},auditLog:{create:async()=>{}},
 };
 const service=new ManagementService({$transaction:async fn=>fn(tx)},{deposit:async()=>{credits++;},release:async()=>events.push('release')},{status:async()=>({status:'Pending'})},{get:()=>null},{add:async()=>{}});
 return {service,events,wallet,credits:()=>credits,ledger:()=>ledger};
}
test('provider balance uses consistent VND units and fails closed for unknown currencies',()=>{
 assert.equal(providerBalanceVnd('10','USD',25000).toNumber(),250000);
 assert.equal(providerBalanceVnd('10','VND',25000).toNumber(),10);
 assert.throws(()=>providerBalanceVnd('10','EUR',25000));
});
test('suspended user cannot use an otherwise valid JWT',async()=>{
 const request={cookies:{svn_access:'token'}};
 const guard=new JwtAuthGuard({getAllAndOverride:()=>false},{verifyAsync:async()=>superUser},{getOrThrow:()=>''},{user:{findUnique:async()=>({status:'SUSPENDED',role:'SUPER_ADMIN',tokenVersion:0})}});
 await assert.rejects(guard.canActivate({getHandler:()=>null,getClass:()=>null,switchToHttp:()=>({getRequest:()=>request})}));
});
test('reset token version immediately invalidates old access JWT',async()=>{
 const guard=new JwtAuthGuard({getAllAndOverride:()=>false},{verifyAsync:async()=>superUser},{getOrThrow:()=>''},{user:{findUnique:async()=>({status:'ACTIVE',role:'SUPER_ADMIN',tokenVersion:1})}});
 await assert.rejects(guard.canActivate({getHandler:()=>null,getClass:()=>null,switchToHttp:()=>({getRequest:()=>({cookies:{svn_access:'token'}})})}));
});
test('stale role in JWT never restores elevated privileges',async()=>{
 const request={cookies:{svn_access:'token'}};
 const guard=new JwtAuthGuard({getAllAndOverride:()=>false},{verifyAsync:async()=>superUser},{getOrThrow:()=>''},{user:{findUnique:async()=>({status:'ACTIVE',role:'CUSTOMER',email:'user@example.test',tokenVersion:0})}});
 assert.equal(await guard.canActivate({getHandler:()=>null,getClass:()=>null,switchToHttp:()=>({getRequest:()=>request})}),true);
 assert.equal(request.user.role,'CUSTOMER');
});
test('wallet adjustment is request-idempotent',async()=>{
 const f=fixture();const dto={amount:10,reason:'test reason',requestId:'same-key'};
 await f.service.adjustWallet('customer',dto,superUser);await f.service.adjustWallet('customer',dto,superUser);
 assert.equal(f.wallet.balance.toNumber(),110);
 assert.equal(f.events.filter(x=>x==='wallet-update').length,1);
});
test('cannot subtract held funds',async()=>{
 const f=fixture();await assert.rejects(f.service.adjustWallet('customer',{amount:-80,reason:'test reason',requestId:'key'},superUser),e=>e.code==='WALLET_ADJUSTMENT_EXCEEDS_AVAILABLE');
});
test('ordinary admin cannot credit manually',async()=>{
 const f=fixture({role:'ADMIN'});await assert.rejects(f.service.reconcilePayment('deposit',{paymentTransactionId:'payment',amountVnd:100000,reason:'verified reason'},{...superUser,role:'ADMIN'}),e=>e.code==='ADMIN_PERMISSION_DENIED');assert.equal(f.credits(),0);
});
test('manual credit rejects mismatch, already matched evidence, and over-credit',async()=>{
 for(const [options,amount,code] of [[{wrongAddress:true},100000,'PAYMENT_ADDRESS_MISMATCH'],[{alreadyMatched:true},100000,'PAYMENT_ALREADY_PROCESSED'],[{},100001,'PAYMENT_CREDIT_EXCEEDS_VERIFIED_AMOUNT']]){
  const f=fixture(options);await assert.rejects(f.service.reconcilePayment('deposit',{paymentTransactionId:'payment',amountVnd:amount,reason:'verified reason'},superUser),e=>e.code===code);assert.equal(f.credits(),0);
 }
});
test('manual credit uses saved USDT rate and verified received funds',async()=>{
 const f=fixture();const result=await f.service.reconcilePayment('deposit',{paymentTransactionId:'payment',amountVnd:100000,reason:'verified reason'},superUser);assert.equal(result.creditedVnd.toNumber(),100000);assert.equal(f.credits(),1);
});
test('admin cancellation cannot undo a worker-claimed order',async()=>{
 const f=fixture({orderStatus:'SUBMITTING'});await assert.rejects(f.service.orderAction('order',{action:'CANCEL_RELEASE',reason:'operator reason'},superUser),e=>e.code==='ADMIN_ACTION_NOT_ALLOWED');assert.ok(!f.events.includes('release'));assert.equal(f.events[0],'lock');
});
test('scheduled order can be canceled with a locked state recheck',async()=>{
 const f=fixture({orderStatus:'SCHEDULED'});const result=await f.service.orderAction('order',{action:'CANCEL_RELEASE',reason:'operator reason'},superUser);assert.equal(result.status,'CANCELED');assert.deepEqual(f.events,['lock','release']);
});
