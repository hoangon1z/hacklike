import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DepositMethod, Prisma } from '@prisma/client';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { DomainError } from '../shared/domain-error';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma:PrismaService,private readonly wallets:WalletsService,private readonly config:ConfigService){}
  private async settings(){const rows=await this.prisma.systemSetting.findMany({where:{key:{in:['USDT_RATE','BANKING_ENABLED','USDT_TRC20_ENABLED','USDT_BEP20_ENABLED']}}});return Object.fromEntries(rows.map(x=>[x.key,x.value]));}
  async create(userId:string,dto:CreateDepositDto){
    const settings=await this.settings();
    const bankingReady=Boolean(this.config.get('SEPAY_API_TOKEN')&&this.config.get('SEPAY_WEBHOOK_SECRET')&&this.config.get('SEPAY_BANK_NAME')&&this.config.get('SEPAY_ACCOUNT_NUMBER')&&this.config.get('SEPAY_ACCOUNT_NAME')&&settings.BANKING_ENABLED===true);
    const usdtReady=Boolean(this.config.get('BINANCE_API_KEY')&&this.config.get('BINANCE_API_SECRET'));
    if(dto.method===DepositMethod.BANKING&&!bankingReady) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE','payment.method_unavailable',409);
    if(dto.method===DepositMethod.USDT_TRC20&&(!usdtReady||settings.USDT_TRC20_ENABLED!==true)) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE','payment.method_unavailable',409);
    if(dto.method===DepositMethod.USDT_BEP20&&(!usdtReady||settings.USDT_BEP20_ENABLED!==true)) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE','payment.method_unavailable',409);
    const rate=Number(settings.USDT_RATE??0);if(dto.method!==DepositMethod.BANKING&&rate<=0) throw new DomainError('USDT_RATE_UNAVAILABLE','payment.rate_unavailable',409);
    const code=`SVN${randomBytes(5).toString('hex').toUpperCase()}`;
    const network=dto.method===DepositMethod.USDT_TRC20?'TRX':dto.method===DepositMethod.USDT_BEP20?'BSC':null;
    const configuredAddress=network?this.config.get<string>(network==='TRX'?'BINANCE_TRC20_ADDRESS':'BINANCE_BEP20_ADDRESS')?.trim():null;
    const address=network==='BSC'?configuredAddress?.toLowerCase():configuredAddress;
    if(network&&!address) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE','payment.address_unavailable',409);
    const deposit=await this.createRequest(userId,dto,network,address??null,rate,code);
    return {...deposit,banking:dto.method===DepositMethod.BANKING?{bankName:this.config.get('SEPAY_BANK_NAME')??'',accountNumber:this.config.get('SEPAY_ACCOUNT_NUMBER')??'',accountName:this.config.get('SEPAY_ACCOUNT_NAME')??''}:null};
  }
  private async createRequest(userId:string,dto:CreateDepositDto,network:string|null,address:string|null,rate:number,code:string){
    for(let attempt=0;attempt<12;attempt++){
      const expectedUsdt=network?new Prisma.Decimal(dto.amountVnd).div(rate).toDecimalPlaces(6,Prisma.Decimal.ROUND_UP).add(new Prisma.Decimal(randomInt(1,10000)).div(1_000_000)):null;
      try{
        return await this.prisma.$transaction(async tx=>{
          if(network&&address&&expectedUsdt)await tx.usdtDepositAllocation.create({data:{network,address,amount:expectedUsdt}});
          return tx.depositRequest.create({data:{publicId:`DEP-${randomUUID().slice(0,8).toUpperCase()}`,userId,method:dto.method,status:'WAITING',requestedVnd:dto.amountVnd,usdtRate:network?rate:null,expectedUsdt,paymentCode:code,network,destinationAddress:address,expiresAt:new Date(Date.now()+30*60_000)}});
        });
      }catch(error){
        if(!(network&&error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'))throw error;
      }
    }
    throw new DomainError('PAYMENT_REQUEST_BUSY','payment.request_busy',409);
  }
  list(userId:string){return this.prisma.depositRequest.findMany({where:{userId},orderBy:{createdAt:'desc'},take:50});}
  async processSepay(payload:Record<string,unknown>){
    const externalId=String(payload.id??payload.transactionId??'');
    const content=[payload.code,payload.content,payload.description].filter(x=>typeof x==='string').join(' ');
    let amount:Prisma.Decimal;
    try{amount=new Prisma.Decimal(String(payload.transferAmount??payload.amountIn??payload.amount??'0'));}catch{throw new DomainError('INVALID_WEBHOOK','payment.invalid_webhook',422);}
    if(!externalId||!amount.isFinite()||amount.lte(0))throw new DomainError('INVALID_WEBHOOK','payment.invalid_webhook',422);
    if(payload.transferType&&payload.transferType!=='in')return {matched:false};
    const account=this.config.get<string>('SEPAY_ACCOUNT_NUMBER');
    if(!account||String(payload.accountNumber??'')!==account)return {matched:false};
    const match=content.toUpperCase().match(/SVN[A-F0-9]{10}/)?.[0];
    return this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'sepay:'+externalId}))`;
      const existing=await tx.paymentTransaction.findUnique({where:{provider_externalId:{provider:'SEPAY',externalId}}});
      if(existing)return {matched:Boolean(existing.depositRequestId),duplicate:true};
      const found=match?await tx.depositRequest.findUnique({where:{paymentCode:match}}):null;
      if(found)await tx.$queryRaw`SELECT id FROM "DepositRequest" WHERE id = ${found.id} FOR UPDATE`;
      const deposit=found?await tx.depositRequest.findUnique({where:{id:found.id}}):null;
      if(!deposit||deposit.method!=='BANKING'||['REJECTED','MANUAL_REVIEW','COMPLETED','OVERPAID'].includes(deposit.status)){
        await tx.paymentTransaction.create({data:{provider:'SEPAY',externalId,amount,rawPayload:payload as Prisma.InputJsonObject,receivedAt:new Date()}});
        return {matched:false};
      }
      await tx.paymentTransaction.create({data:{depositRequestId:deposit.id,provider:'SEPAY',externalId,amount,rawPayload:payload as Prisma.InputJsonObject,receivedAt:new Date()}});
      const previous=deposit.creditedVnd??new Prisma.Decimal(0),remaining=Prisma.Decimal.max(deposit.requestedVnd.sub(previous),0),creditedNow=Prisma.Decimal.min(amount,remaining),creditedTotal=previous.add(creditedNow);
      if(creditedNow.gt(0))await this.wallets.deposit(tx,deposit.userId,creditedNow,deposit.id,`deposit:sepay:${externalId}`,'Nạp tiền qua chuyển khoản');
      const totalReceived=(await tx.paymentTransaction.aggregate({_sum:{amount:true},where:{depositRequestId:deposit.id,provider:'SEPAY'}}))._sum.amount??new Prisma.Decimal(0);
      await tx.depositRequest.update({where:{id:deposit.id},data:{status:creditedTotal.lt(deposit.requestedVnd)?'UNDERPAID':totalReceived.gt(deposit.requestedVnd)?'OVERPAID':'COMPLETED',creditedVnd:creditedTotal}});
      return {matched:true,duplicate:false};
    });
  }
}
