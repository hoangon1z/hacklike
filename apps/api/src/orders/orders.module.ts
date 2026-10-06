import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderProcessor } from './orders.processor';
import { WalletsModule } from '../wallets/wallets.module';
import { ProviderModule } from '../provider/provider.module';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({ imports: [WalletsModule, ProviderModule, NotificationsModule, BullModule.registerQueue({ name: 'orders' })], controllers: [OrdersController], providers: [OrdersService, OrderProcessor] })
export class OrdersModule {}
