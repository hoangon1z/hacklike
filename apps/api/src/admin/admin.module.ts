import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ServicesModule } from '../services/services.module';
import { AdminController } from './admin.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { ProviderModule } from '../provider/provider.module';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
@Module({imports:[ServicesModule,WalletsModule,ProviderModule,BullModule.registerQueue({name:'orders'})],controllers:[AdminController,ManagementController,FinanceController],providers:[ManagementService,FinanceService]})
export class AdminModule{}
