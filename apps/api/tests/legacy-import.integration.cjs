// Run only against an explicitly disposable database, never against production.
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {compare}=require('bcryptjs');
async function main(){
 if(!process.env.DATABASE_URL?.includes('/legacy_import_test'))throw new Error('Disposable legacy_import_test DB required');
 const db=new PrismaClient();
 const cli=path.resolve(__dirname,'../scripts/import-legacy-users.cjs'),file=path.resolve(__dirname,'fixtures/legacy-users.csv');
 function run(args,extra={}){const r=spawnSync(process.execPath,[cli,'--file',file,...args],{encoding:'utf8',env:{...process.env,...extra}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
 try{
  const dry=run([]);assert.equal(dry.newUsers,2);assert.equal(dry.openingBalanceVnd,'1234');assert.equal(await db.user.count(),0);
  const applied=run(['--apply','--expected-sha256',dry.sourceHash],{LEGACY_INITIAL_PASSWORD:'Test-password-only'});assert.equal(applied.newUsers,2);
  assert.equal(await db.user.count(),2);assert.equal(await db.walletTransaction.count({where:{type:'DEPOSIT'}}),0);
  const ledger=await db.walletTransaction.findMany();assert.equal(ledger.length,2);assert.ok(ledger.every(r=>r.type==='OPENING_BALANCE'));
  const users=await db.user.findMany({include:{legacyImport:true,wallet:true}});assert.ok(users.every(u=>u.passwordChangeRequired&&u.role==='CUSTOMER'));assert.notEqual(users[0].passwordHash,users[1].passwordHash);assert.equal(await compare('Test-password-only',users[0].passwordHash),true);
  assert.equal(users.reduce((sum,u)=>sum+Number(u.wallet.balance),0),1234);assert.equal(users.reduce((sum,u)=>sum+Number(u.legacyImport.historicalDeposited),0),6000);
  const replay=run(['--apply','--expected-sha256',dry.sourceHash],{LEGACY_INITIAL_PASSWORD:'Test-password-only'});assert.equal(replay.newUsers,0);assert.equal(replay.alreadyImported,2);assert.equal(await db.walletTransaction.count(),2);
  console.log('Disposable DB integration passed: migrations, dry-run, balances, salt, role, opening ledger, replay.');
 }finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
