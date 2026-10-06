import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { ServicesModule } from './services/services.module';
import { OrdersModule } from './orders/orders.module';
import { ProviderModule } from './provider/provider.module';
import { WalletsModule } from './wallets/wallets.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { OutboxModule } from './outbox/outbox.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './config/validate-env';
import { AccountController, AnnouncementsController } from './account.controller';
import { AdminAuditInterceptor } from './admin/admin-audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'],validate:validateEnv }),
    ThrottlerModule.forRoot([{name:'default',ttl:60_000,limit:120}]),
    BullModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ connection: { url: config.get('REDIS_URL', 'redis://localhost:6379') } }) }),
    PrismaModule, AuthModule, ProviderModule, ServicesModule, WalletsModule, OrdersModule, AdminModule, PaymentsModule, OutboxModule,
  ],
  controllers: [HealthController, AccountController, AnnouncementsController],
  providers:[{provide:APP_GUARD,useClass:ThrottlerGuard},{provide:APP_INTERCEPTOR,useClass:AdminAuditInterceptor}],
})
export class AppModule {}
