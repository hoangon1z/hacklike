import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OutboxProcessor } from './outbox.processor';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({imports:[NotificationsModule,BullModule.registerQueue({name:'outbox'},{name:'orders'})],providers:[OutboxProcessor]})
export class OutboxModule{}
