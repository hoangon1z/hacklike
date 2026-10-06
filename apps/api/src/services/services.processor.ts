import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ServicesService } from './services.service';

@Processor('services',{concurrency:1})
export class ServicesProcessor extends WorkerHost implements OnModuleInit{
 constructor(private readonly services:ServicesService,@InjectQueue('services') private readonly queue:Queue){super()}
 async onModuleInit(){await this.queue.add('sync',{}, {jobId:'service-sync-scheduled',repeat:{every:10*60_000},removeOnComplete:50,removeOnFail:100})}
 async process(job:Job){if(job.name==='sync')return this.services.syncFromProvider()}
}
