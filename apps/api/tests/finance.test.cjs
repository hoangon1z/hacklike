const test=require('node:test');
const assert=require('node:assert/strict');
const {financePeriod,FinanceService}=require('../dist/admin/finance.service');
test('finance dates follow Vietnam midnight rather than host timezone',()=>{
 const now=new Date('2026-10-05T18:00:00Z');
 assert.equal(financePeriod('today',now).start.toISOString(),'2026-10-05T17:00:00.000Z');
 assert.equal(financePeriod('7d',now).start.toISOString(),'2026-09-29T17:00:00.000Z');
 assert.equal(financePeriod('30d',now).start.toISOString(),'2026-09-06T17:00:00.000Z');
 assert.equal(financePeriod('all',now).start.getTime(),0);
});
test('gross estimate separates deposits and customer wallet obligations',async()=>{
 let calls=0;
 const tx={
  $queryRaw:async()=>++calls===1?[{orders:1n,captured:120000,refunded:0,netCharged:120000,closedRevenue:120000,closedCostSnapshot:100000,runningCharged:0,runningCostSnapshot:0}]:[],
  walletTransaction:{groupBy:async()=>[{type:'DEPOSIT',_sum:{amount:200000}},{type:'ADMIN_ADJUSTMENT',_sum:{amount:5000}}]},
  wallet:{aggregate:async()=>({_sum:{balance:80000,reserved:10000}})},
  order:{groupBy:async()=>[]},
 };
 const result=await new FinanceService({$transaction:async cb=>cb(tx)}).overview('30d');
 assert.equal(result.estimatedGrossProfit,20000);
 assert.equal(result.customerDeposits,200000);
 assert.equal(result.customerWalletAvailable,70000);
 assert.equal(result.walletAdjustments,5000);
 assert.equal(result.sourceTopupsTracked,false);
});
