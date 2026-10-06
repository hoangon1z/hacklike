import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { ProviderModule } from '../provider/provider.module';
import { ServicesProcessor } from './services.processor';
@Module({ imports: [ProviderModule,BullModule.registerQueue({name:'services'})], controllers: [ServicesController], providers: [ServicesService,ServicesProcessor], exports: [ServicesService] })
export class ServicesModule {}
