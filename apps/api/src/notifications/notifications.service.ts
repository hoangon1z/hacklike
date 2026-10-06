import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { providerBalanceVnd } from "../shared/provider-money";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  async observeProviderBalance(
    balance: string,
    currency: string,
    required: Prisma.Decimal,
    orderId: string,
  ) {
    const now = new Date();
    const current = await this.prisma.providerState.findUnique({
      where: { id: "primary" },
    });
    const rate = await this.prisma.systemSetting.findUnique({where:{key:"PROVIDER_RATE_MULTIPLIER"}});
    const numericBalance = providerBalanceVnd(balance,currency,Number(rate?.value??25000));
    const low =
      numericBalance.lt(current?.lowBalanceThreshold ?? 2000000) ||
      numericBalance.lt(required);
    if (!low) {
      await this.providerHealthy(balance, currency);
      return;
    }
    await this.prisma.providerState.upsert({
      where: { id: "primary" },
      create: {
        id: "primary",
        balance,
        currency,
        status: "LOW_BALANCE",
        lastCheckedAt: now,
      },
      update: { balance, currency, status: "LOW_BALANCE", lastCheckedAt: now },
    });
    const token = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    const chatId = this.config.get<string>("TELEGRAM_ADMIN_CHAT_ID");
    if (!token || !chatId) return;
    const claimed = await this.prisma.providerState.updateMany({
      where: { id: "primary", incidentOpenedAt: null },
      data: { incidentOpenedAt: now },
    });
    if (claimed.count !== 1) return;
    const text = `Cảnh báo số dư nguồn thấp\nSố dư: ${balance} ${currency}\nNgưỡng cảnh báo: ${(current?.lowBalanceThreshold ?? new Prisma.Decimal(2000000)).toString()} VND\nChi phí đơn đang xét: ${required.toString()} VND\nMã đơn: ${orderId}`;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) throw new Error(`TELEGRAM_HTTP_${response.status}`);
    } catch {
      await this.prisma.providerState.updateMany({
        where: { id: "primary", incidentOpenedAt: now },
        data: { incidentOpenedAt: null },
      });
      /* Cảnh báo không được làm hỏng luồng retry đơn; lần kiểm tra sau sẽ gửi lại. */
    }
  }
  async providerHealthy(balance: string, currency: string) {
    await this.prisma.providerState.upsert({
      where: { id: "primary" },
      create: {
        id: "primary",
        balance,
        currency,
        status: "HEALTHY",
        lastCheckedAt: new Date(),
      },
      update: {
        balance,
        currency,
        status: "HEALTHY",
        lastCheckedAt: new Date(),
        incidentOpenedAt: null,
      },
    });
  }
}
