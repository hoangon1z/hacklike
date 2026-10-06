import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('outbox',{concurrency:1})
export class OutboxProcessor extends WorkerHost implements OnModuleInit{
 constructor(private readonly prisma:PrismaService,@InjectQueue('outbox') private readonly outbox:Queue,@InjectQueue('orders') private readonly orders:Queue){super()}
 async onModuleInit(){await this.outbox.add('dispatch',{}, {jobId:'outbox-dispatch-scheduled',repeat:{every:5000},removeOnComplete:20,removeOnFail:100})}
 async process(job:Job){if(job.name!=='dispatch')return;const events=await this.prisma.outboxEvent.findMany({where:{processedAt:null},orderBy:{createdAt:'asc'},take:100});for(const event of events){try{if(event.eventType==='ORDER_CREATED')await this.orders.add('submit',{orderId:event.aggregateId},{jobId:`submit-${event.aggregateId}`,removeOnComplete:1000});await this.prisma.outboxEvent.update({where:{id:event.id},data:{processedAt:new Date(),attempts:{increment:1}}})}catch{await this.prisma.outboxEvent.update({where:{id:event.id},data:{attempts:{increment:1}}})}}return {processed:events.length}}
}
