const { PrismaClient, UserRole } = require('@prisma/client');
const { hash } = require('bcryptjs');
const path = require('node:path');
const fs = require('node:fs');
const envPath=path.resolve(__dirname, '../../../.env');
if(fs.existsSync(envPath))process.loadEnvFile(envPath);
const prisma = new PrismaClient();
async function main(){
  const email=process.env.ADMIN_EMAIL;
  const password=process.env.ADMIN_PASSWORD;
  if(!email) throw new Error('Set ADMIN_EMAIL before promoting an account.');
  const normalizedEmail=email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))throw new Error('Invalid ADMIN_EMAIL.');
  const args=process.argv.slice(2);
  const role=args.includes('--role')?args[args.indexOf('--role')+1]:UserRole.SUPER_ADMIN;
  if(![UserRole.ADMIN,UserRole.SUPER_ADMIN].includes(role))throw new Error('Role must be ADMIN or SUPER_ADMIN.');
  if(password&&(password.length<12||Buffer.byteLength(password)>72))throw new Error('ADMIN_PASSWORD must be at least 12 characters and at most 72 UTF-8 bytes.');
  const passwordHash=password?await hash(password,12):undefined;
  const action=await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-users'))`;
    const existing=await tx.user.findUnique({where:{email:normalizedEmail}});
    if(!existing&&(!args.includes('--create')||!passwordHash))throw new Error('Account does not exist. Use --create and provide ADMIN_PASSWORD, or register first.');
    if(existing?.passwordChangeRequired&&!passwordHash)throw new Error('Provide a new ADMIN_PASSWORD before promoting an imported account.');
    const user=existing?await tx.user.update({where:{id:existing.id},data:{role,status:'ACTIVE',tokenVersion:{increment:1},...(passwordHash?{passwordHash,passwordChangeRequired:false}:{})}}):await tx.user.create({data:{email:normalizedEmail,displayName:'Quản trị viên',passwordHash,role,status:'ACTIVE',wallet:{create:{}}}});
    if(existing)await tx.refreshSession.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}});
    await tx.auditLog.create({data:{actorId:user.id,action:'ADMIN_CLI_BOOTSTRAP',entityType:'USER',entityId:user.id,after:{role,created:!existing,passwordReset:Boolean(passwordHash),reason:'Server operator bootstrap'}}});
    return existing?'updated':'created';
  });
  console.log(`Admin account ${action}; role=${role}. Existing wallet/history preserved; old sessions revoked.`);
}
main().catch(error=>{console.error(error.code?`Admin operation failed (${error.code}); rolled back.`:error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
