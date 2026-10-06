import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, UserRole, UserStatus, OrderStatus, DepositStatus, DepositMethod } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { ProviderService } from '../provider/provider.service';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../auth/auth.types';
import { DomainError } from '../shared/domain-error';
import { CreateManagedUserDto, EditManagedUserDto, ResetManagedPasswordDto, WalletAdjustmentDto, ManagedOrderActionDto, PaymentReconcileDto, PageQuery,ManagedPaymentActionDto } from './dto/management.dto';

const userSelect={id:true,email:true,displayName:true,role:true,status:true,createdAt:true,wallet:{select:{balance:true,reserved:true}}} as const;
const pendingOrders:OrderStatus[]=['SCHEDULED','FUNDS_RESERVED','QUEUED','WAITING_PROVIDER_BALANCE','WAITING_PROVIDER_SYNC','PRICE_CONFLICT'];
function fail(code='ADMIN_ACTION_NOT_ALLOWED',status=409):never{throw new DomainError(code,'admin.action_not_allowed',status);}

@Injectable()
export class ManagementService {
 constructor(private readonly db:PrismaService,private readonly wallets:WalletsService,private readonly provider:ProviderService,private readonly config:ConfigService,@InjectQueue('orders') private readonly queue:Queue){}
 private async actor(tx:Prisma.TransactionClient,actor:AuthUser,superOnly=false){
  const current=await tx.user.findUnique({where:{id:actor.sub}});
  if(!current||current.status!=='ACTIVE'||!['ADMIN','SUPER_ADMIN'].includes(current.role)||(actor.v??0)!==current.tokenVersion||(superOnly&&current.role!=='SUPER_ADMIN'))fail('ADMIN_PERMISSION_DENIED',403);
  return current;
 }
 private audit(tx:Prisma.TransactionClient,actor:AuthUser,action:string,type:string,id:string,reason:string,after:Prisma.InputJsonObject,before?:Prisma.InputJsonObject){if(reason.trim().length<3)fail('REASON_REQUIRED',422);return tx.auditLog.create({data:{actorId:actor.sub,action,entityType:type,entityId:id,before,after:{...after,reason:reason.trim()}}});}
 private range(q:PageQuery){
  const from=q.from?new Date(q.from):undefined,to=q.to?new Date(q.to):undefined;
  if(from&&to&&from>to)fail('INVALID_DATE_RANGE',422);
  return from||to?{gte:from,lte:to}:undefined;
 }
 private pagination(q:PageQuery){return {skip:(q.page-1)*q.pageSize,take:q.pageSize};}
 async users(q:PageQuery){
  if(q.status&&!Object.values(UserStatus).includes(q.status as UserStatus))fail('INVALID_FILTER',422);
  const where:Prisma.UserWhereInput={status:q.status as UserStatus|undefined,createdAt:this.range(q),...(q.search?{OR:[{email:{contains:q.search,mode:'insensitive'}},{displayName:{contains:q.search,mode:'insensitive'}}]}:{})};
  const [items,total]=await this.db.$transaction([this.db.user.findMany({where,select:userSelect,orderBy:[{createdAt:'desc'},{id:'desc'}],...this.pagination(q)}),this.db.user.count({where})]);
  return {items,total,page:q.page,pageSize:q.pageSize};
 }
 async createUser(dto:CreateManagedUserDto,actor:AuthUser){
  const passwordHash=await hash(dto.password,12);
  try{return await this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-users'))`;
   const current=await this.actor(tx,actor);
   if(current.role!=='SUPER_ADMIN'&&dto.role!=='CUSTOMER')fail('SUPER_ADMIN_REQUIRED',403);
   const user=await tx.user.create({data:{email:dto.email.trim().toLowerCase(),displayName:dto.displayName.trim(),passwordHash,role:dto.role,status:dto.status,wallet:{create:{}}},select:userSelect});
   await this.audit(tx,actor,'USER_CREATE','USER',user.id,dto.reason,{email:user.email,role:user.role,status:user.status});return user;
  });}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')fail('EMAIL_ALREADY_EXISTS');throw e;}
 }
 async editUser(id:string,dto:EditManagedUserDto,actor:AuthUser){
  try{return await this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-users'))`;
   const current=await this.actor(tx,actor);
   const before=await tx.user.findUniqueOrThrow({where:{id}});
   if(current.role!=='SUPER_ADMIN'&&(before.role!=='CUSTOMER'||(dto.role&&dto.role!=='CUSTOMER')))fail('SUPER_ADMIN_REQUIRED',403);
   if(id===actor.sub&&((dto.status&&dto.status!=='ACTIVE')||(dto.role&&dto.role!==before.role)))fail('SELF_ADMIN_CHANGE_FORBIDDEN');
   const data={...(dto.email?{email:dto.email.trim().toLowerCase()}:{}),...(dto.displayName?{displayName:dto.displayName.trim()}:{}),...(dto.role?{role:dto.role}:{}),...(dto.status?{status:dto.status}:{})};
   const securityChange=Boolean(dto.email||dto.role||dto.status);
   const user=await tx.user.update({where:{id},data:{...data,...(securityChange?{tokenVersion:{increment:1}}:{})},select:userSelect});
   if(securityChange)await tx.refreshSession.updateMany({where:{userId:id,revokedAt:null},data:{revokedAt:new Date()}});
   await this.audit(tx,actor,'USER_UPDATE','USER',id,dto.reason,{email:user.email,name:user.displayName,role:user.role,status:user.status},{email:before.email,name:before.displayName,role:before.role,status:before.status});return user;
  });}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')fail('EMAIL_ALREADY_EXISTS');throw e;}
 }
 async resetPassword(id:string,dto:ResetManagedPasswordDto,actor:AuthUser){
  const passwordHash=await hash(dto.password,12);
  return this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-users'))`;
   const current=await this.actor(tx,actor);const target=await tx.user.findUniqueOrThrow({where:{id}});
   if(current.role!=='SUPER_ADMIN'&&target.role!=='CUSTOMER')fail('SUPER_ADMIN_REQUIRED',403);
   await tx.user.update({where:{id},data:{passwordHash,tokenVersion:{increment:1}}});
   await tx.refreshSession.updateMany({where:{userId:id,revokedAt:null},data:{revokedAt:new Date()}});
   await this.audit(tx,actor,'USER_PASSWORD_RESET','USER',id,dto.reason,{sessionsRevoked:true});return {updated:true};
  });
 }
 async adjustWallet(id:string,dto:WalletAdjustmentDto,actor:AuthUser){
  return this.db.$transaction(async tx=>{
   await this.actor(tx,actor,true);
   await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${id} FOR UPDATE`;
   const wallet=await tx.wallet.findUniqueOrThrow({where:{userId:id}}),amount=new Prisma.Decimal(dto.amount);
   const key=`admin-wallet:${dto.requestId}`;
   const previous=await tx.walletTransaction.findUnique({where:{idempotencyKey:key}});
   if(previous){if(previous.walletId!==wallet.id||!previous.amount.equals(amount)||previous.referenceId!==actor.sub)fail('IDEMPOTENCY_CONFLICT');return wallet;}
   if(wallet.balance.add(amount).lt(wallet.reserved))fail('WALLET_ADJUSTMENT_EXCEEDS_AVAILABLE');
   const updated=await tx.wallet.update({where:{id:wallet.id},data:{balance:{increment:amount},version:{increment:1}}});
   await tx.walletTransaction.create({data:{walletId:wallet.id,type:'ADMIN_ADJUSTMENT',amount,balanceAfter:updated.balance,referenceType:'ADMIN',referenceId:actor.sub,description:dto.reason,idempotencyKey:key}});
   await this.audit(tx,actor,'WALLET_ADJUSTMENT','USER',id,dto.reason,{amount:amount.toString(),balance:updated.balance.toString()},{balance:wallet.balance.toString()});return updated;
  });
 }
 async userDetail(id:string){
  const user=await this.db.user.findUniqueOrThrow({where:{id},select:userSelect});
  const [orders,deposits,ledger]=await Promise.all([this.db.order.count({where:{userId:id}}),this.db.walletTransaction.aggregate({where:{wallet:{userId:id},type:'DEPOSIT'},_sum:{amount:true}}),this.db.walletTransaction.findMany({where:{wallet:{userId:id}},orderBy:{createdAt:'desc'},take:50})]);
  const legacy=await this.db.legacyUserImport.findUnique({where:{userId:id},select:{historicalDeposited:true,openingBalance:true,legacyUsername:true,phone:true,legacyCreatedAt:true,importedAt:true}});
  return {user,orders,totalDeposited:new Prisma.Decimal(deposits._sum.amount??0).plus(legacy?.historicalDeposited??0),legacy,ledger};
 }
 async orders(q:PageQuery){
  if(q.status&&!Object.values(OrderStatus).includes(q.status as OrderStatus))fail('INVALID_FILTER',422);
  const where:Prisma.OrderWhereInput={status:q.status as OrderStatus|undefined,createdAt:this.range(q),...(q.search?{OR:[{publicId:{contains:q.search,mode:'insensitive'}},{providerOrderId:{contains:q.search}},{user:{email:{contains:q.search,mode:'insensitive'}}},{link:{contains:q.search}}]}:{})};
  const [items,total]=await this.db.$transaction([this.db.order.findMany({where,include:{user:{select:{email:true}},service:{select:{displayName:true,refill:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],...this.pagination(q)}),this.db.order.count({where})]);
  return {items,total,page:q.page,pageSize:q.pageSize};
 }
 async orderDetail(id:string){const order=await this.db.order.findUniqueOrThrow({where:{id},include:{service:{select:{displayName:true,refill:true}},user:{select:{email:true}},statusHistory:{orderBy:{createdAt:'asc'}},attempts:{orderBy:{attempt:'asc'}}}});return {...order,providerCommands:await this.db.adminProviderCommand.findMany({where:{orderId:id},orderBy:{createdAt:'desc'}})};}
 async orderAction(id:string,dto:ManagedOrderActionDto,actor:AuthUser){
  if(dto.action==='REFILL')return this.refill(id,dto,actor);
  // Check the source ID exists before committing reconciliation. Ownership must be independently verified by the operator.
  if(dto.action==='CONFIRM_SUBMITTED'){
   if(!dto.providerOrderId)fail('PROVIDER_ORDER_ID_REQUIRED',422);
   try{await this.provider.status(dto.providerOrderId);}catch{fail('PROVIDER_ORDER_NOT_VERIFIED');}
  }
  const result=await this.db.$transaction(async tx=>{
   await this.actor(tx,actor);
   await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
   const order=await tx.order.findUniqueOrThrow({where:{id}});
   let next=order.status;
   if(dto.action==='RETRY'){
    if(!['WAITING_PROVIDER_BALANCE','WAITING_PROVIDER_SYNC','PRICE_CONFLICT'].includes(order.status)||order.providerOrderId)fail();
    next='QUEUED';await tx.order.update({where:{id},data:{status:next,nextRetryAt:null}});
    await tx.outboxEvent.create({data:{aggregateType:'ORDER',aggregateId:id,eventType:'ORDER_CREATED',payload:{orderId:id}}});
   }else if(dto.action==='CANCEL_RELEASE'){
    if(order.providerOrderId||!pendingOrders.includes(order.status))fail();
    next='CANCELED';await this.wallets.release(tx,order.userId,order.chargeAmount,id,'Admin hủy đơn chưa gửi');
    await tx.order.update({where:{id},data:{status:next,nextRetryAt:null,publicMessage:'Đơn đã hủy, số tiền giữ đã được trả lại.'}});
   }else if(dto.action==='CONFIRM_SUBMITTED'){
    if(order.status!=='SUBMISSION_UNKNOWN'||order.providerOrderId)fail();
    next='SUBMITTED';await tx.order.update({where:{id},data:{status:next,providerOrderId:dto.providerOrderId,nextRetryAt:null}});
    await this.wallets.capture(tx,order.userId,order.chargeAmount,id);
   }else if(dto.action==='RESCHEDULE'){
    const time=dto.scheduledAt?new Date(dto.scheduledAt):null;
    if(order.status!=='SCHEDULED'||!time||time.getTime()<Date.now()+30000||time.getTime()>Date.now()+90*86400000)fail('INVALID_SCHEDULE_TIME',422);
    await tx.order.update({where:{id},data:{scheduledAt:time}});
   }else if(dto.action==='SYNC_STATUS'){
    if(!order.providerOrderId||!['SUBMITTED','IN_PROGRESS'].includes(order.status))fail();
   }else fail();
   if(next!==order.status)await tx.orderStatusHistory.create({data:{orderId:id,fromStatus:order.status,toStatus:next,reasonCode:dto.action,actorId:actor.sub}});
   await this.audit(tx,actor,`ORDER_${dto.action}`,'ORDER',id,dto.reason,{status:next,providerOrderId:dto.providerOrderId??order.providerOrderId,scheduledAt:dto.scheduledAt??null},{status:order.status});
   return tx.order.findUniqueOrThrow({where:{id}});
  });
  if(['SYNC_STATUS','CONFIRM_SUBMITTED'].includes(dto.action))await this.queue.add('status',{orderId:id},{jobId:`admin-status-${id}-${Date.now()}`,removeOnComplete:true});
  return result;
 }
 private async refill(id:string,dto:ManagedOrderActionDto,actor:AuthUser){
  const command=await this.db.$transaction(async tx=>{
   await this.actor(tx,actor);await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
   const order=await tx.order.findUniqueOrThrow({where:{id},include:{service:true}});
   if(!order.providerOrderId||!order.service.refill||!['COMPLETED','PARTIAL'].includes(order.status))fail();
   if(await tx.adminProviderCommand.findUnique({where:{orderId_kind:{orderId:id,kind:'REFILL'}}}))fail('PROVIDER_COMMAND_ALREADY_REQUESTED');
   const command=await tx.adminProviderCommand.create({data:{orderId:id,kind:'REFILL',actorId:actor.sub,reason:dto.reason}});
   await this.audit(tx,actor,'ORDER_REFILL_REQUEST','ORDER',id,dto.reason,{commandId:command.id});return {...command,providerOrderId:order.providerOrderId};
  });
  try{
   const result=await this.provider.refill(command.providerOrderId);
   if(!result.refill)throw new Error('REFILL_INVALID_RESPONSE');
   return await this.db.adminProviderCommand.update({where:{id:command.id},data:{status:'ACCEPTED',responseId:String(result.refill)}});
  }catch{
   await this.db.adminProviderCommand.update({where:{id:command.id},data:{status:'UNKNOWN'}});
   fail('PROVIDER_COMMAND_NEEDS_REVIEW');
  }
 }
 async payments(q:PageQuery){
  if(q.status&&!Object.values(DepositStatus).includes(q.status as DepositStatus))fail('INVALID_FILTER',422);
  if(q.method&&!Object.values(DepositMethod).includes(q.method as DepositMethod))fail('INVALID_FILTER',422);
  const where:Prisma.DepositRequestWhereInput={status:q.status as DepositStatus|undefined,method:q.method as DepositMethod|undefined,createdAt:this.range(q),...(q.search?{OR:[{publicId:{contains:q.search,mode:'insensitive'}},{user:{email:{contains:q.search,mode:'insensitive'}}},{paymentCode:{contains:q.search,mode:'insensitive'}}]}:{})};
  const [items,total]=await this.db.$transaction([this.db.depositRequest.findMany({where,include:{user:{select:{email:true}},paymentTransactions:{select:{id:true,provider:true,externalId:true,amount:true,txHash:true,network:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],...this.pagination(q)}),this.db.depositRequest.count({where})]);
  return {items,total,page:q.page,pageSize:q.pageSize};
 }
 async unmatched(q:PageQuery){
  const where:Prisma.PaymentTransactionWhereInput={depositRequestId:null,receivedAt:this.range(q),...(q.search?{OR:[{externalId:{contains:q.search}},{txHash:{contains:q.search}}]}:{})};
  const [items,total]=await this.db.$transaction([this.db.paymentTransaction.findMany({where,select:{id:true,provider:true,externalId:true,network:true,txHash:true,amount:true,receivedAt:true},orderBy:{receivedAt:'desc'},...this.pagination(q)}),this.db.paymentTransaction.count({where})]);return {items,total,page:q.page,pageSize:q.pageSize};
 }
 async reconcilePayment(id:string,dto:PaymentReconcileDto,actor:AuthUser){
  return this.db.$transaction(async tx=>{
   await this.actor(tx,actor,true);
   await tx.$queryRaw`SELECT id FROM "PaymentTransaction" WHERE id = ${dto.paymentTransactionId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "DepositRequest" WHERE id = ${id} FOR UPDATE`;
   const payment=await tx.paymentTransaction.findUniqueOrThrow({where:{id:dto.paymentTransactionId}}),request=await tx.depositRequest.findUniqueOrThrow({where:{id}});
   const key=`manual-payment:${payment.id}`;
   const previous=await tx.walletTransaction.findUnique({where:{idempotencyKey:key}});
   if(previous){if(payment.depositRequestId!==id||!previous.amount.equals(dto.amountVnd))fail('IDEMPOTENCY_CONFLICT');return request;}
   if(payment.depositRequestId||['COMPLETED','OVERPAID','REJECTED'].includes(request.status))fail('PAYMENT_ALREADY_PROCESSED');
   let available=payment.amount;
   if(request.method==='BANKING'){if(payment.provider!=='SEPAY')fail('PAYMENT_METHOD_MISMATCH');}
   else{
    if(payment.provider!=='BINANCE'||payment.network!==request.network||!request.usdtRate)fail('PAYMENT_METHOD_MISMATCH');
    const address=(payment.rawPayload as Record<string,unknown>)?.address;
    const matches=typeof address==='string'&&(request.network==='BSC'?address.toLowerCase()===request.destinationAddress?.toLowerCase():address===request.destinationAddress);
    if(!matches)fail('PAYMENT_ADDRESS_MISMATCH');
    available=payment.amount.mul(request.usdtRate).toDecimalPlaces(2,Prisma.Decimal.ROUND_DOWN);
   }
   const amount=new Prisma.Decimal(dto.amountVnd),remaining=request.requestedVnd.sub(request.creditedVnd??0);
   if(amount.gt(available)||amount.gt(remaining)||amount.lte(0))fail('PAYMENT_CREDIT_EXCEEDS_VERIFIED_AMOUNT');
   await this.wallets.deposit(tx,request.userId,amount,id,key,`Đối soát thủ công: ${dto.reason}`);
   await tx.paymentTransaction.update({where:{id:payment.id},data:{depositRequestId:id}});
   const credited=new Prisma.Decimal(request.creditedVnd??0).add(amount);
   const updated=await tx.depositRequest.update({where:{id},data:{creditedVnd:credited,status:credited.lt(request.requestedVnd)?'UNDERPAID':available.gt(amount)?'OVERPAID':'COMPLETED'}});
   await this.audit(tx,actor,'PAYMENT_MANUAL_CREDIT','DEPOSIT',id,dto.reason,{transactionId:payment.id,provider:payment.provider,externalId:payment.externalId,amountVnd:amount.toString()},{status:request.status,creditedVnd:String(request.creditedVnd??0)});return updated;
  });
 }
 async paymentDetail(id:string){return this.db.depositRequest.findUniqueOrThrow({where:{id},include:{user:{select:{email:true,displayName:true}},paymentTransactions:{select:{id:true,provider:true,externalId:true,amount:true,network:true,txHash:true,receivedAt:true}}}});}
 async importSepay(externalId:string,reason:string,actor:AuthUser){
  if(actor.role!=='SUPER_ADMIN')fail('SUPER_ADMIN_REQUIRED',403);
  if(!/^\d+$/.test(externalId))fail('INVALID_TRANSACTION_ID',422);
  const token=this.config.get<string>('SEPAY_API_TOKEN'),account=this.config.get<string>('SEPAY_ACCOUNT_NUMBER');
  if(!token||!account)fail('SEPAY_NOT_CONFIGURED');
  const response=await fetch(`https://my.sepay.vn/userapi/transactions/details/${externalId}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok)fail('PAYMENT_PROVIDER_UNAVAILABLE');
  const result=await response.json() as {transaction?:{id:string;account_number:string;amount_in:string;amount_out:string;transaction_date:string;transaction_content:string}};
  const transaction=result.transaction;
  if(!transaction||String(transaction.id)!==externalId||transaction.account_number!==account||Number(transaction.amount_in)<=0||Number(transaction.amount_out)>0)fail('PAYMENT_EVIDENCE_NOT_VERIFIED');
  const receivedAt=new Date(transaction.transaction_date.replace(' ','T')+'+07:00');if(!Number.isFinite(receivedAt.getTime()))fail('PAYMENT_EVIDENCE_NOT_VERIFIED');
  return this.db.$transaction(async tx=>{
   await this.actor(tx,actor,true);
   const existing=await tx.paymentTransaction.findUnique({where:{provider_externalId:{provider:'SEPAY',externalId}}});if(existing)return existing;
   const created=await tx.paymentTransaction.create({data:{provider:'SEPAY',externalId,amount:transaction.amount_in,rawPayload:transaction,receivedAt}});
   await this.audit(tx,actor,'PAYMENT_IMPORT_VERIFIED','PAYMENT',created.id,reason,{provider:'SEPAY',externalId});return created;
  });
 }
 async paymentAction(id:string,dto:ManagedPaymentActionDto,actor:AuthUser){
  return this.db.$transaction(async tx=>{
   await this.actor(tx,actor,true);await tx.$queryRaw`SELECT id FROM "DepositRequest" WHERE id = ${id} FOR UPDATE`;
   const request=await tx.depositRequest.findUniqueOrThrow({where:{id}});
   if(['COMPLETED','OVERPAID','REJECTED'].includes(request.status)||(dto.action==='REJECT'&&new Prisma.Decimal(request.creditedVnd??0).gt(0)))fail('PAYMENT_ALREADY_PROCESSED');
   const status=dto.action==='REJECT'?'REJECTED':'MANUAL_REVIEW';
   const updated=await tx.depositRequest.update({where:{id},data:{status}});
   await this.audit(tx,actor,`PAYMENT_${dto.action}`,'DEPOSIT',id,dto.reason,{status},{status:request.status});return updated;
  });
 }
 async paymentStats(q:PageQuery){
  const where:Prisma.WalletTransactionWhereInput={type:'DEPOSIT',createdAt:this.range(q)};
  const range=this.range(q),from=range?.gte??new Date('2000-01-01'),to=range?.lte??new Date();
  const [total,methodRows,statuses,unmatched]=await Promise.all([this.db.walletTransaction.aggregate({where,_sum:{amount:true},_count:true}),this.db.$queryRaw<Array<{method:string;count:bigint;amount:Prisma.Decimal}>>`SELECT d.method::text AS method, COUNT(*) AS count, SUM(w.amount) AS amount FROM "WalletTransaction" w JOIN "DepositRequest" d ON w."referenceId" = d.id WHERE w.type = 'DEPOSIT' AND w."referenceType" = 'DEPOSIT' AND w."createdAt" >= ${from} AND w."createdAt" <= ${to} GROUP BY d.method`,this.db.depositRequest.groupBy({by:['status'],where:{createdAt:this.range(q)},_count:true}),this.db.paymentTransaction.count({where:{depositRequestId:null,receivedAt:this.range(q)}})]);
  const methods=methodRows.map(row=>({method:row.method,_count:Number(row.count),_sum:{creditedVnd:row.amount}}));
  const rows=await this.db.walletTransaction.findMany({where:{...where,createdAt:{gte:new Date(Date.now()-30*86400000),...this.range(q)}},select:{amount:true,createdAt:true}});
  const daily:Record<string,number>={};for(const row of rows){const date=new Date(row.createdAt.getTime()+7*3600000).toISOString().slice(0,10);daily[date]=(daily[date]??0)+Number(row.amount);}
  return {creditedVnd:total._sum.amount??0,creditTransactions:total._count,methods,statuses,unmatched,daily:Object.entries(daily).sort().map(([date,amount])=>({date,amount}))};
 }
 async audits(q:PageQuery){
  const where:Prisma.AuditLogWhereInput={createdAt:this.range(q),...(q.search?{OR:[{action:{contains:q.search,mode:'insensitive'}},{entityId:{contains:q.search}},{actorId:{contains:q.search}}]}:{})};
  const [items,total]=await this.db.$transaction([this.db.auditLog.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],...this.pagination(q)}),this.db.auditLog.count({where})]);return {items,total,page:q.page,pageSize:q.pageSize};
 }
}
