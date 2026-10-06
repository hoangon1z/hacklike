import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OutboxProcessor } from './outbox.processor';
@Module({imports:[BullModule.registerQueue({name:'outbox'},{name:'orders'})],providers:[OutboxProcessor]})
export class OutboxModule{}
