'use strict';
const fs=require('node:fs');
const {PrismaClient,Prisma}=require('@prisma/client');
const {hash}=require('bcryptjs');
const {parseLegacy,sha}=require('./legacy-csv.cjs');
async function classify(tx,rows){
  const existing=await tx.user.findMany({where:{email:{in:rows.map(r=>r.email)}},select:{email:true,legacyImport:{select:{rowHash:true}}}});
  const byEmail=new Map(existing.map(u=>[u.email,u]));
  const result={fresh:[],skipped:[],already:[],changed:[]};
  for(const row of rows){const user=byEmail.get(row.email);if(!user)result.fresh.push(row);else if(!user.legacyImport)result.skipped.push(row);else if(user.legacyImport.rowHash===row.rowHash)result.already.push(row);else result.changed.push(row);}
  return result;
}
function summary(result,sourceHash){const sum=key=>result.fresh.reduce((a,r)=>a.plus(r[key]),new Prisma.Decimal(0)).toString();return {sourceHash,newUsers:result.fresh.length,existingUsersNotModified:result.skipped.length,alreadyImported:result.already.length,changedSourceRows:result.changed.map(r=>r.line),openingBalanceVnd:sum('openingBalance'),historicalDepositedVnd:sum('historicalDeposited')};}
async function run(){
  const args=process.argv.slice(2);const file=args[args.indexOf('--file')+1];
  if(!args.includes('--file')||!file||file.startsWith('--'))throw new Error('Usage: --file /path/export_user.csv [--apply --expected-sha256 HASH] [--skip-existing]');
  const text=fs.readFileSync(file,'utf8'),sourceHash=sha(text),rows=parseLegacy(text);
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
  const apply=args.includes('--apply');
  if(apply&&args[args.indexOf('--expected-sha256')+1]!==sourceHash)throw new Error('Run dry-run first, then provide its sourceHash with --expected-sha256');
  const password=process.env.LEGACY_INITIAL_PASSWORD;
  if(apply&&(!password||password.length<12||Buffer.byteLength(password)>72))throw new Error('LEGACY_INITIAL_PASSWORD must be 12+ characters and at most 72 UTF-8 bytes');
  const db=new PrismaClient();
  try{
    if(!apply){const result=await classify(db,rows);console.log(JSON.stringify({mode:'DRY_RUN',...summary(result,sourceHash)},null,2));return;}
    // Unique salts for each account; no password is stored in the audit or output.
    const hashes=new Map();for(const row of rows)hashes.set(row.email,await hash(password,12));
    const report=await db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-users'))`;
      const result=await classify(tx,rows);
      if(result.changed.length)throw new Error('Previously imported rows have changed; manual reconciliation required');
      if(result.skipped.length&&!args.includes('--skip-existing'))throw new Error('Existing accounts found; review dry-run. --skip-existing preserves them unchanged');
      for(const row of result.fresh){
        const {line,rowHash,...snapshot}=row;
        const user=await tx.user.create({data:{email:row.email,displayName:row.legacyUsername,passwordHash:hashes.get(row.email),passwordChangeRequired:true,role:'CUSTOMER',status:'ACTIVE',createdAt:row.legacyCreatedAt,wallet:{create:{balance:row.openingBalance}},legacyImport:{create:{...snapshot,rowHash,sourceHash}}},include:{wallet:true}});
        await tx.walletTransaction.create({data:{walletId:user.wallet.id,type:'OPENING_BALANCE',amount:row.openingBalance,balanceAfter:row.openingBalance,referenceType:'LEGACY_IMPORT',referenceId:user.id,idempotencyKey:`legacy-opening:${row.email}`,description:'Số dư đầu kỳ chuyển từ website cũ; không phải nạp mới'}});
      }
      return summary(result,sourceHash);
    },{isolationLevel:'Serializable',timeout:120000});
    console.log(JSON.stringify({mode:'APPLIED',...report},null,2));
  }finally{await db.$disconnect();}
}
if(require.main===module)run().catch(error=>{console.error(error.code?`Import failed (${error.code}); rolled back.`:error.message);process.exitCode=1;});
module.exports={classify,summary};
