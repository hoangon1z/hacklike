import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

export type BinanceDeposit = { id:string; amount:string; coin:string; network:string; status:number; address:string; txId:string; insertTime:number; travelRuleStatus?:number };
type TronScanTransfer = { transaction_id?:string; to_address?:string; block_ts?:number; confirmed?:boolean; contractRet?:string; quant?:string; tokenInfo?:{tokenId?:string;tokenAbbr?:string;tokenDecimal?:number|string} };
const TRON_USDT_CONTRACT='TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export function depositIdentity(remote:BinanceDeposit) {
  if(remote.coin!=='USDT'||remote.status!==1||(remote.travelRuleStatus!==undefined&&remote.travelRuleStatus!==0))return null;
  const sourceNetwork=remote.network?.toUpperCase();
  const network=['TRX','TRC20'].includes(sourceNetwork)?'TRX':['BSC','BEP20'].includes(sourceNetwork)?'BSC':null;
  if(!network||!remote.id||!remote.txId||!remote.address||!Number.isSafeInteger(remote.insertTime)||remote.insertTime<=0)return null;
  let amount:Prisma.Decimal;
  try{amount=new Prisma.Decimal(remote.amount);}catch{return null;}
  if(!amount.isFinite()||amount.lte(0))return null;
  return {network,address:network==='BSC'?remote.address.toLowerCase():remote.address,amount,receivedAt:new Date(remote.insertTime)};
}

@Injectable()
export class BinanceService {
  constructor(private readonly config:ConfigService,private readonly prisma:PrismaService,private readonly wallets:WalletsService){}
  configured(){return Boolean(this.config.get('BINANCE_API_KEY')&&this.config.get('BINANCE_API_SECRET'))}
  private async serverTime(){
    const response=await fetch('https://api.binance.com/api/v3/time',{signal:AbortSignal.timeout(15000)});
    const result=await response.json() as {serverTime:number};
    if(!response.ok||!Number.isSafeInteger(result.serverTime))throw new Error('BINANCE_TIME_UNAVAILABLE');
    return result.serverTime;
  }
  private async history(){
    const key=this.config.get<string>('BINANCE_API_KEY'),secret=this.config.get<string>('BINANCE_API_SECRET');
    if(!key||!secret)return [];
    const endTime=await this.serverTime();
    const startTime=endTime-89*86400000;
    const rows:BinanceDeposit[]=[];
    for(let offset=0;offset<100000;offset+=1000){
      const timestamp=offset===0?endTime:await this.serverTime();
      const params=new URLSearchParams({coin:'USDT',startTime:String(startTime),endTime:String(endTime),limit:'1000',offset:String(offset),timestamp:String(timestamp),recvWindow:'10000'});
      params.set('signature',createHmac('sha256',secret).update(params.toString()).digest('hex'));
      const response=await fetch(`https://api.binance.com/sapi/v1/capital/deposit/hisrec?${params}`,{headers:{'X-MBX-APIKEY':key},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`BINANCE_HTTP_${response.status}`);
      const page=await response.json() as BinanceDeposit[];
      if(!Array.isArray(page))throw new Error('BINANCE_INVALID_HISTORY');
      rows.push(...page);
      if(page.length<1000)return rows;
    }
    throw new Error('BINANCE_HISTORY_PAGE_LIMIT');
  }
  private async tronHistory(){
    const address=this.config.get<string>('BINANCE_TRC20_ADDRESS')?.trim();
    if(!address)return [];
    const minimum=Date.now()-89*86400000,rows:BinanceDeposit[]=[];
    for(let start=0;start<10000;start+=200){
      const params=new URLSearchParams({limit:'200',start:String(start),sort:'-timestamp',count:'true',relatedAddress:address});
      const response=await fetch(`https://apilist.tronscanapi.com/api/token_trc20/transfers?${params}`,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`TRONSCAN_HTTP_${response.status}`);
      const result=await response.json() as {token_transfers?:TronScanTransfer[]};
      if(!Array.isArray(result.token_transfers))throw new Error('TRONSCAN_INVALID_HISTORY');
      for(const transfer of result.token_transfers){
        const decimals=Number(transfer.tokenInfo?.tokenDecimal);
        if(transfer.tokenInfo?.tokenId!==TRON_USDT_CONTRACT||transfer.tokenInfo?.tokenAbbr!=='USDT'||decimals!==6||transfer.to_address!==address||transfer.confirmed!==true||transfer.contractRet!=='SUCCESS'||!transfer.transaction_id?.match(/^[a-f0-9]{64}$/i)||!Number.isSafeInteger(transfer.block_ts)||Number(transfer.block_ts)<=0)continue;
        let amount:Prisma.Decimal;
        try{amount=new Prisma.Decimal(String(transfer.quant)).div(new Prisma.Decimal(10).pow(decimals));}catch{continue;}
        if(!amount.isFinite()||amount.lte(0))continue;
        rows.push({id:transfer.transaction_id,amount:amount.toFixed(),coin:'USDT',network:'TRX',status:1,address,txId:transfer.transaction_id,insertTime:Number(transfer.block_ts),travelRuleStatus:0});
      }
      const oldest=result.token_transfers.reduce((value,row)=>Math.min(value,Number(row.block_ts)||value),Number.MAX_SAFE_INTEGER);
      if(result.token_transfers.length<200||oldest<minimum)return rows;
    }
    throw new Error('TRONSCAN_HISTORY_PAGE_LIMIT');
  }
  private async applyDeposit(remote:BinanceDeposit){
    const identity=depositIdentity(remote);
    if(!identity)return false;
    const {network,address,amount,receivedAt}=identity;
    try{
      return await this.prisma.$transaction(async tx=>{
        // Serialize matching and crediting across worker instances.
        const lockKey=`binance:${network}:${address}:${amount.toFixed()}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const duplicate=await tx.paymentTransaction.findFirst({where:{OR:[{provider:'BINANCE',externalId:remote.id},{network,txHash:remote.txId,logIndex:0}]}});
        if(duplicate)return false;
        const candidates=await tx.depositRequest.findMany({where:{
          method:network==='TRX'?'USDT_TRC20':'USDT_BEP20',
          network,
          destinationAddress:network==='BSC'?{equals:address,mode:'insensitive'}:address,
          expectedUsdt:amount,
          createdAt:{lte:receivedAt},
          expiresAt:{gte:receivedAt},
        },orderBy:{id:'asc'},take:2});
        const payment={provider:'BINANCE',externalId:remote.id,network,txHash:remote.txId,logIndex:0,amount,rawPayload:remote as unknown as Prisma.InputJsonObject,receivedAt};
        if(candidates.length!==1){
          // Keep unmatched funds visible to an operator; never choose an arbitrary customer.
          await tx.paymentTransaction.create({data:payment});
          if(candidates.length>1)await tx.depositRequest.updateMany({where:{id:{in:candidates.map(x=>x.id)},status:{in:['WAITING','CONFIRMING','EXPIRED']}},data:{status:'MANUAL_REVIEW'}});
          return false;
        }
        const candidate=candidates[0];
        await tx.$queryRaw`SELECT id FROM "DepositRequest" WHERE id = ${candidate.id} FOR UPDATE`;
        const request=await tx.depositRequest.findUniqueOrThrow({where:{id:candidate.id}});
        if(!['WAITING','CONFIRMING','EXPIRED'].includes(request.status)){
          await tx.paymentTransaction.create({data:payment});
          return false;
        }
        await tx.paymentTransaction.create({data:{...payment,depositRequestId:request.id}});
        // Idempotency belongs to the request, not only the remote transaction.
        await this.wallets.deposit(tx,request.userId,request.requestedVnd,request.id,`deposit:binance:request:${request.id}`,'Nạp USDT tự động');
        await tx.depositRequest.update({where:{id:request.id},data:{status:'COMPLETED',creditedVnd:request.requestedVnd}});
        return true;
      },{timeout:15000});
    }catch(error){
      // Database uniqueness is the final guard if another ingestion path races.
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return false;
      throw error;
    }
  }
  async reconcile(){
    if(!this.configured())return {checked:0,credited:0};
    let deposits:BinanceDeposit[];
    try{deposits=await this.history();}
    catch(error){
      const code=error instanceof Error?error.message:'';
      if(!['BINANCE_TIME_UNAVAILABLE','BINANCE_HTTP_451'].includes(code))throw error;
      deposits=await this.tronHistory();
    }
    let credited=0;
    for(const remote of deposits)if(await this.applyDeposit(remote))credited++;
    await this.prisma.depositRequest.updateMany({where:{method:{in:['USDT_TRC20','USDT_BEP20']},status:{in:['CREATED','WAITING','CONFIRMING']},expiresAt:{lt:new Date()}},data:{status:'EXPIRED'}});
    return {checked:deposits.length,credited};
  }
}
