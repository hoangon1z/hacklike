import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { BinanceService } from './binance.service';

@Processor('payments',{concurrency:1})
export class PaymentsProcessor extends WorkerHost implements OnModuleInit{
 constructor(private readonly binance:BinanceService,@InjectQueue('payments') private readonly queue:Queue){super()}
 async onModuleInit(){await this.queue.add('binance-reconcile',{}, {jobId:'binance-reconcile-scheduled',repeat:{every:60_000},removeOnComplete:100,removeOnFail:100})}
 async process(job:Job){if(job.name==='binance-reconcile')return this.binance.reconcile()}
}
