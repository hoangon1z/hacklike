import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Processor('outbox',{concurrency:1})
export class OutboxProcessor extends WorkerHost implements OnModuleInit {
  private lastScan=0;
  constructor(private readonly prisma:PrismaService,@InjectQueue('outbox') private readonly outbox:Queue,@InjectQueue('orders') private readonly orders:Queue,private readonly notifications:NotificationsService){super();}
  async onModuleInit(){await this.outbox.add('dispatch',{}, {jobId:'outbox-dispatch-scheduled',repeat:{every:5000},removeOnComplete:20,removeOnFail:100});}
  async process(job:Job){
    if(job.name!=='dispatch')return;
    // Always dispatch order jobs before Telegram. A Telegram outage cannot block purchases.
    const events=await this.prisma.outboxEvent.findMany({where:{processedAt:null,eventType:{not:'TELEGRAM_ADMIN_ALERT'}},orderBy:{createdAt:'asc'},take:100});
    for(const event of events){try{
      if(event.eventType==='ORDER_CREATED')await this.orders.add('submit',{orderId:event.aggregateId},{jobId:`submit-${event.aggregateId}`,removeOnComplete:1000});
      await this.prisma.outboxEvent.update({where:{id:event.id},data:{processedAt:new Date(),attempts:{increment:1}}});
    }catch{await this.prisma.outboxEvent.update({where:{id:event.id},data:{attempts:{increment:1}}});}}
    if(Date.now()-this.lastScan>=60_000){this.lastScan=Date.now();try{await this.notifications.scanOrders();}catch{}}
    if(!this.notifications.configured())return {processed:events.length};
    const alerts=await this.prisma.outboxEvent.findMany({where:{processedAt:null,eventType:'TELEGRAM_ADMIN_ALERT'},orderBy:{createdAt:'asc'},take:100});
    let dispatched=0;
    for(const alert of alerts){
      const payload=alert.payload as {text?:string;retryAt?:string};
      if(payload.retryAt&&Date.parse(payload.retryAt)>Date.now())continue;
      if(dispatched++>=10)break;
      try {await this.prisma.$transaction(async tx=>{
        const [lock]=await tx.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(hashtext(${alert.id})) AS locked`;
        if(!lock.locked)return;
        const current=await tx.outboxEvent.findUnique({where:{id:alert.id}});
        if(!current||current.processedAt)return;
        const data=current.payload as {text?:string;retryAt?:string};
        if(data.retryAt&&Date.parse(data.retryAt)>Date.now())return;
        try {
          if(!data.text)throw new Error('INVALID_ALERT');
          await this.notifications.send(data.text);
          await tx.outboxEvent.update({where:{id:alert.id},data:{processedAt:new Date(),attempts:{increment:1}}});
        }catch{
          const delay=Math.min(3600000,30000*2**Math.min(current.attempts,7));
          await tx.outboxEvent.update({where:{id:alert.id},data:{attempts:{increment:1},payload:{...data,retryAt:new Date(Date.now()+delay).toISOString()}}});
        }
      },{timeout:15000});}catch{}
    }
    return {processed:events.length};
  }
}
