import { Module } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { ProviderHealthService } from './provider-health.service';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({ imports:[NotificationsModule], providers: [ProviderService,ProviderHealthService], exports: [ProviderService,ProviderHealthService] })
export class ProviderModule {}
