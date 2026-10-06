const { PrismaClient, UserRole } = require('@prisma/client');
const { hash } = require('bcryptjs');
const path = require('node:path');
process.loadEnvFile(path.resolve(__dirname, '../../../.env'));
const prisma = new PrismaClient();
async function main(){
  const email=process.env.ADMIN_EMAIL;
  const password=process.env.ADMIN_PASSWORD;
  if(!email) throw new Error('Set ADMIN_EMAIL before promoting an account.');
  const normalizedEmail=email.trim().toLowerCase();
  const existing=await prisma.user.findUnique({where:{email:normalizedEmail}});
  if(!existing) throw new Error('Account does not exist. Register on the website first.');
  const data={role:UserRole.SUPER_ADMIN,status:'ACTIVE'};
  if(password){
    if(password.length<12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
    data.passwordHash=await hash(password,12);
  }
  await prisma.user.update({where:{id:existing.id},data});
  console.log(`Existing account ${normalizedEmail} is now SUPER_ADMIN${password?' and its password was reset':''}.`);
}
main().finally(()=>prisma.$disconnect());
