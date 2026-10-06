import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderService } from './provider.service';
import { providerBalanceVnd } from '../shared/provider-money';

@Injectable()
export class ProviderHealthService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<unknown>;
  constructor(private readonly db: PrismaService, private readonly provider: ProviderService, private readonly config: ConfigService) {}
  configured() { return Boolean(this.config.get('SMM_PROVIDER_URL') && this.config.get('SMM_PROVIDER_API_KEY')); }
  onModuleInit() {
    void this.check().catch(() => {});
    this.timer = setInterval(() => { void this.check().catch(() => {}); }, 180_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  check() {
    if (this.pending) return this.pending;
    this.pending = this.run().finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async run() {
    // Serialize checks across API replicas without blocking orders or retrying submissions.
    return this.db.$transaction(async tx => {
      const [lock] = await tx.$queryRaw<Array<{locked: boolean}>>`SELECT pg_try_advisory_xact_lock(hashtext('provider-health-check')) AS locked`;
      if (!lock.locked) return tx.providerState.findUnique({where:{id:'primary'}});
      const now = new Date();
      let status = 'NOT_CONFIGURED';
      let snapshot: {balance: string; currency: string} | undefined;
      if (this.configured()) {
        try {
          const result = await this.provider.balance();
          if (!result || !/^\d+(\.\d+)?$/.test(String(result.balance)) || !['VND','USD'].includes(result.currency)) throw new Error('INVALID_PROVIDER_BALANCE');
          const rate = await tx.systemSetting.findUnique({where:{key:'PROVIDER_RATE_MULTIPLIER'}});
          const current = await tx.providerState.findUnique({where:{id:'primary'}});
          const available = providerBalanceVnd(result.balance,result.currency,Number(rate?.value ?? 25000));
          snapshot = {balance:String(result.balance),currency:result.currency};
          status = available.lte(current?.lowBalanceThreshold ?? 2000000) ? 'LOW_BALANCE' : 'HEALTHY';
        } catch { status = 'UNAVAILABLE'; }
      }
      // Preserve the last known balance and notification incident on failed checks.
      return tx.providerState.upsert({where:{id:'primary'},create:{id:'primary',status,lastCheckedAt:now,...snapshot},update:{status,lastCheckedAt:now,...snapshot}});
    }, {timeout:20_000});
  }
}
