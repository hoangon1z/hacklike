import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WalletsModule } from '../wallets/wallets.module';
import { BinanceService } from './binance.service';
import { PaymentsController } from './payments.controller';
import { PaymentsProcessor } from './payments.processor';
import { PaymentsService } from './payments.service';
@Module({imports:[WalletsModule,BullModule.registerQueue({name:'payments'})],controllers:[PaymentsController],providers:[PaymentsService,BinanceService,PaymentsProcessor]})
export class PaymentsModule{}
