// Integration tests use a fresh database, never production wallet data.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { PaymentsService } = require('../dist/payments/payments.service');
const { PaymentsController } = require('../dist/payments/payments.controller');
const { WalletsService } = require('../dist/wallets/wallets.service');
const { sepayAccounts, matchesSepayBank } = require('../dist/payments/sepay-config');

async function main() {
  const admin = new PrismaClient();
  const name = 'hacklike_sepay_test_' + randomBytes(6).toString('hex');
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/' + name;
  let db;
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    created = true;
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], {
      env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe',
    });
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const banks = [
      {id:'klb',bankName:'KienLongBank',bankCode:'KLB',accountNumber:'11111111',accountName:'TEST',virtualAccountNumber:'101499100000000001'},
      {id:'mb',bankName:'MBBank',bankCode:'MB',accountNumber:'22222222',accountName:'TEST'},
    ];
    const values = {SEPAY_API_TOKEN:'test',SEPAY_WEBHOOK_SECRET:'test-webhook-secret',SEPAY_BANK_ACCOUNTS:JSON.stringify(banks)};
    const config = {get:key=>values[key]};
    const payments = new PaymentsService(db,new WalletsService(),config);
    const controller = new PaymentsController(payments,config);
    await db.systemSetting.create({data:{key:'BANKING_ENABLED',value:true}});
    const user = await db.user.create({data:{email:'sepay-test@example.invalid',displayName:'Test',passwordHash:'not-a-login-hash',wallet:{create:{}}}});
    const create = (bankAccountId,amountVnd=100000) => payments.create(user.id,{method:'BANKING',amountVnd,bankAccountId});
    const balance = async()=>Number((await db.wallet.findUniqueOrThrow({where:{userId:user.id}})).balance);
    const payload = (id,deposit,bank,amount=100000) => ({id,transferType:'in',transferAmount:amount,accountNumber:bank.accountNumber,subAccount:bank.virtualAccountNumber,gateway:bank.bankName,content:'CHUYEN TIEN '+deposit.paymentCode});
    await assert.rejects(create(undefined));
    await assert.rejects(create('unknown'));
    const klb = await create('klb');
    const mb = await create('mb');
    assert.equal(klb.banking.accountNumber,banks[0].accountNumber);
    assert.equal(mb.banking.accountNumber,banks[1].accountNumber);
    assert.ok(matchesSepayBank(banks[0],banks[0].accountNumber,'KienlongBank',banks[0].virtualAccountNumber));
    await assert.rejects(controller.sepay('Apikey wrong',undefined,payload(1,klb,banks[0])));
    await assert.rejects(controller.sepay('Bearer test-webhook-secret',undefined,payload(1,klb,banks[0])));
    assert.equal(await balance(),0);
    const valid=payload(1,klb,banks[0]);
    await Promise.all([controller.sepay('Apikey test-webhook-secret',undefined,valid),controller.sepay('Apikey test-webhook-secret',undefined,valid)]);
    assert.equal(await balance(),100000);
    assert.equal(await db.paymentTransaction.count({where:{externalId:'1'}}),1);
    assert.equal(await db.walletTransaction.count({where:{type:'DEPOSIT'}}),1);
    const wrongBank=await payments.processSepay(payload(2,mb,banks[0]));
    assert.equal(wrongBank.matched,false);
    await payments.processSepay({...payload(3,mb,banks[1]),transferType:'out'});
    await payments.processSepay({...payload(4,mb,banks[1]),transferType:undefined});
    await payments.processSepay({...payload(5,mb,banks[1]),accountNumber:'wrong'});
    assert.equal(await balance(),100000);
    await payments.processSepay(payload(6,mb,banks[1],30000));
    assert.equal((await db.depositRequest.findUnique({where:{id:mb.id}})).status,'UNDERPAID');
    await payments.processSepay(payload(7,mb,banks[1],70000));
    assert.equal((await db.depositRequest.findUnique({where:{id:mb.id}})).status,'COMPLETED');
    assert.equal(await balance(),200000);
    const over=await create('mb');
    await payments.processSepay(payload(8,over,banks[1],150000));
    assert.equal((await db.depositRequest.findUnique({where:{id:over.id}})).status,'OVERPAID');
    assert.equal(await balance(),300000);
    const vaDeposit=await create('klb');
    assert.equal(vaDeposit.banking.virtualAccountNumber,banks[0].virtualAccountNumber);
    for (const override of [{subAccount:'wrong'}, {subAccount:undefined}, {accountNumber:'wrong'}, {gateway:'MBBank'}]) {
      const rejected=await payments.processSepay({...payload(90,vaDeposit,banks[0]),...override});
      assert.equal(rejected.matched,false);
    }
    assert.equal(await balance(),300000);
    assert.equal(await db.paymentTransaction.count({where:{externalId:'90'}}),0);
    await Promise.all([payments.processSepay(payload(91,vaDeposit,banks[0])),payments.processSepay(payload(91,vaDeposit,banks[0]))]);
    assert.equal(await balance(),400000);
    assert.equal((await db.depositRequest.findUnique({where:{id:vaDeposit.id}})).status,'COMPLETED');
    // A different configured VA cannot pay an existing deposit snapshot.
    values.SEPAY_BANK_ACCOUNTS=JSON.stringify([{...banks[0],virtualAccountNumber:'OTHER-VA'.replace('-','')},banks[1]]);
    const mismatch=await create('klb');
    values.SEPAY_BANK_ACCOUNTS=JSON.stringify(banks);
    assert.equal((await payments.processSepay(payload(92,mismatch,banks[0]))).matched,false);
    assert.equal(await balance(),400000);
    values.SEPAY_BANK_ACCOUNTS=JSON.stringify([{...banks[0],virtualAccountNumber:123},banks[1]]);
    assert.deepEqual(sepayAccounts(config),[]);
    values.SEPAY_BANK_ACCOUNTS=JSON.stringify([{...banks[0],depositsEnabled:false},banks[1]]);
    await assert.rejects(create('klb'));
    const single=await create(undefined);
    assert.equal(single.banking.id,'mb');
    // Disabled banks remain available solely for reconciling existing requests.
    const legacy=await db.depositRequest.create({data:{publicId:'DEP-LEGACY',userId:user.id,method:'BANKING',status:'WAITING',requestedVnd:100000,paymentCode:'SVN0123456789',banking:banks[0],expiresAt:new Date(Date.now()+60000)}});
    assert.equal((await payments.processSepay(payload(93,legacy,banks[0]))).matched,true);
    assert.equal(await balance(),500000);
    values.SEPAY_BANK_ACCOUNTS='invalid';
    assert.deepEqual(sepayAccounts(config),[]);
    await assert.rejects(create('mb'));
    console.log('PASS: VA snapshot and strict main-account/VA matching, wrong/missing VA rejection, VA duplicate safety, two bank snapshots, account selection, webhook authentication, concurrent duplicates, bank/account mismatch, outgoing/missing direction, partial payment, overpayment cap, invalid configuration.');
  } finally {
    if(db)await db.$disconnect();
    if(created)await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
    await admin.$disconnect();
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
