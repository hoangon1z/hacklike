import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { providerBalanceVnd } from '../shared/provider-money';

export const LOW_PROVIDER_ALERT_VND = 100000;
const money=(value:Prisma.Decimal|number|string)=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(value))+' ₫';
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma:PrismaService,private readonly config:ConfigService){}
  private chatIds(){return [...new Set((this.config.get<string>('TELEGRAM_ADMIN_CHAT_ID')??'').split(',').map(value=>value.trim()).filter(value=>/^-?\d+$/.test(value)))];}
  configured(){return Boolean(this.config.get('TELEGRAM_BOT_TOKEN')&&this.chatIds().length);}
  async send(text:string){
    const token=this.config.get<string>('TELEGRAM_BOT_TOKEN'),chatIds=this.chatIds();
    if(!token||!chatIds.length)throw new Error('TELEGRAM_NOT_CONFIGURED');
    const deliveries=await Promise.allSettled(chatIds.map(async chatId=>{
      const response=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(8000)});
      const body=await response.json() as {ok?:boolean};
      if(!response.ok||body.ok!==true)throw new Error('TELEGRAM_SEND_FAILED');
    }));
    if(deliveries.some(delivery=>delivery.status==='rejected'))throw new Error('TELEGRAM_SEND_FAILED');
  }
  private async transition(key:string,active:boolean,text:string,recovery?:string){
    if(!this.configured())return;
    await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const previous=await tx.systemSetting.findUnique({where:{key}});
      if((previous?.value===true)===active)return;
      await tx.systemSetting.upsert({where:{key},create:{key,value:active,isPublic:false},update:{value:active}});
      if(active||recovery)await tx.outboxEvent.create({data:{id:randomUUID(),aggregateType:'ADMIN_ALERT',aggregateId:key,eventType:'TELEGRAM_ADMIN_ALERT',payload:{text:active?text:recovery!}}});
    });
  }
  async observeProviderBalance(balance:string,currency:string,required:Prisma.Decimal,orderId:string){
    // Alert failures must not change an order's financial or submission state.
    try {await this.observeLowBalance(balance,currency);}catch{}
  }
  async observeLowBalance(balance:string,currency:string){
    const rate=await this.prisma.systemSetting.findUnique({where:{key:'PROVIDER_RATE_MULTIPLIER'}});
    const available=providerBalanceVnd(balance,currency,Number(rate?.value??25000));
    await this.transition('TELEGRAM_PROVIDER_LOW_100K',available.lt(LOW_PROVIDER_ALERT_VND),
      '⚠️ Số dư web cha dưới 100.000 ₫\nSố dư: '+money(available)+'\nVui lòng nạp thêm vốn tại web cha. Hệ thống kiểm tra lại mỗi 3 phút.',
      '✅ Số dư web cha đã phục hồi\nSố dư: '+money(available)+'\nĐã đạt ngưỡng 100.000 ₫. Các đơn chờ vẫn được kiểm tra đủ tiền riêng trước khi gửi.');
  }
  async scanOrders(){
    if(!this.configured())return;
    const [waiting,manual]=await Promise.all([
      this.prisma.order.aggregate({where:{status:'WAITING_PROVIDER_BALANCE'},_count:{_all:true},_sum:{costAmount:true}}),
      this.prisma.$queryRaw<Array<{id:string;publicId:string;status:string}>>`
        SELECT o.id, o."publicId", o.status FROM "Order" o
        WHERE o.status::text IN ('SUBMISSION_UNKNOWN','MANUAL_REVIEW')
          AND NOT EXISTS (SELECT 1 FROM "OutboxEvent" e WHERE e.id = 'telegram-order-review-' || o.id)
        ORDER BY o."createdAt" ASC LIMIT 100
      `,
    ]);
    await this.transition('TELEGRAM_PROVIDER_WAITING_ORDERS',waiting._count._all>0,
      '⏳ Đơn đang chờ số dư web cha\nSố đơn: '+waiting._count._all+'\nTổng giá vốn dự kiến: '+money(waiting._sum.costAmount??0)+'\nVui lòng nạp web cha. Hệ thống kiểm tra lại sau 3 phút; không tạo hoặc gửi lại đơn thủ công.');
    if(manual.length)await this.prisma.outboxEvent.createMany({data:manual.map(order=>({
      id:'telegram-order-review-'+order.id,aggregateType:'ORDER',aggregateId:order.id,eventType:'TELEGRAM_ADMIN_ALERT',
      payload:{text:'🔎 Đơn cần kiểm tra thủ công\nMã đơn: '+order.publicId+'\nTrạng thái: '+order.status+'\nKiểm tra trong admin và đối soát web cha trước khi gửi lại để tránh trùng đơn.'},
    })),skipDuplicates:true});
  }
}
