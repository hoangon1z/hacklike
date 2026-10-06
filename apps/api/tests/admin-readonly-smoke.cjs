// Optional integration check against the local database. GET requests only;
// no workers, payments, source orders or customer balances are changed.
require('dotenv').config({quiet:true});
require('reflect-metadata');
const assert=require('node:assert/strict');
const {Module,ValidationPipe}=require('@nestjs/common');
const {NestFactory,Reflector}=require('@nestjs/core');
const {JwtService}=require('@nestjs/jwt');
const {ConfigService}=require('@nestjs/config');
const {PrismaClient}=require('@prisma/client');
const {ManagementController}=require('../dist/admin/management.controller');
const {ManagementService}=require('../dist/admin/management.service');
const {JwtAuthGuard}=require('../dist/auth/jwt-auth.guard');
const {RolesGuard}=require('../dist/auth/roles.guard');
const {WalletsService}=require('../dist/wallets/wallets.service');
const {ProviderService}=require('../dist/provider/provider.service');
const {SafeExceptionFilter}=require('../dist/shared/safe-exception.filter');
const db=new PrismaClient();
let app;
(async()=>{
 const config=new ConfigService(process.env),jwt=new JwtService(),reflector=new Reflector();
 const service=new ManagementService(db,new WalletsService(),new ProviderService(config),config,{add:()=>{throw new Error('Queues are forbidden in read-only checks');}});
 class ReadOnlyModule{}
 Module({controllers:[ManagementController],providers:[{provide:ManagementService,useValue:service}]})(ReadOnlyModule);
 app=await NestFactory.create(ReadOnlyModule,{logger:false});
 app.use(require('cookie-parser')());app.setGlobalPrefix('api');
 app.useGlobalGuards(new JwtAuthGuard(reflector,jwt,config,db),new RolesGuard(reflector));
 app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));app.useGlobalFilters(new SafeExceptionFilter());
 await app.listen(0,'127.0.0.1');const origin=await app.getUrl();
 const admin=await db.user.findFirst({where:{role:'SUPER_ADMIN',status:'ACTIVE'}});assert.ok(admin,'No active Super Admin available');
 const token=await jwt.signAsync({sub:admin.id,email:admin.email,role:admin.role,v:admin.tokenVersion},{secret:process.env.JWT_ACCESS_SECRET,expiresIn:'60s'});
 for(const endpoint of ['users','orders','payments','payments/unmatched','payments/stats','audits']){
  const response=await fetch(`${origin}/api/admin/management/${endpoint}`,{headers:{Cookie:`svn_access=${token}`}});
  assert.equal(response.status,200,endpoint);assert.equal((await response.json()).success,true);
 }
 assert.equal((await fetch(`${origin}/api/admin/management/users`)).status,401);
 const customer=await db.user.findFirst({where:{role:'CUSTOMER',status:'ACTIVE'}});
 if(customer){const token=await jwt.signAsync({sub:customer.id,email:customer.email,role:'SUPER_ADMIN',v:customer.tokenVersion},{secret:process.env.JWT_ACCESS_SECRET,expiresIn:'60s'});assert.equal((await fetch(`${origin}/api/admin/management/users`,{headers:{Cookie:`svn_access=${token}`}})).status,403);}
 const oldToken=await jwt.signAsync({sub:admin.id,email:admin.email,role:admin.role,v:admin.tokenVersion-1},{secret:process.env.JWT_ACCESS_SECRET,expiresIn:'60s'});
 assert.equal((await fetch(`${origin}/api/admin/management/users`,{headers:{Cookie:`svn_access=${oldToken}`}})).status,401);
 console.log('Read-only HTTP smoke: 6 admin endpoints passed; anonymous/old token denied; customer role cannot be elevated by JWT.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{if(app)await app.close();await db.$disconnect();});
