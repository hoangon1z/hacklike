import { Module } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { ProviderHealthService } from './provider-health.service';
@Module({ providers: [ProviderService,ProviderHealthService], exports: [ProviderService,ProviderHealthService] })
export class ProviderModule {}
