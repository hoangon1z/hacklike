import { Body, Controller, Get, Param, Patch, Put, Post } from "@nestjs/common";
import { ProviderHealthService } from '../provider/provider-health.service';
import { sepayConfigured } from '../payments/sepay-config';
import { Roles } from "../auth/roles.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ServicesService } from "../services/services.service";
import {
  BulkServicePricingDto,
  BulkServiceStatusDto,
  UpdateServiceDto,
} from "./dto/update-service.dto";
import { Prisma, UserRole } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { DomainError } from "../shared/domain-error";
import { AdminOrderAction, OrderActionDto } from "./dto/order-action.dto";
import { WalletsService } from "../wallets/wallets.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { AdjustWalletDto, UpdateUserDto } from "./dto/update-user.dto";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthUser } from "../auth/auth.types";
import { randomUUID } from "node:crypto";
import { ManagementService } from './management.service';
import { EditManagedUserDto, WalletAdjustmentDto, ManagedOrderActionDto } from './dto/management.dto';

const SETTING_KEYS = {
  supportTelegram: "SUPPORT_TELEGRAM",
  supportFanpage: "SUPPORT_FANPAGE",
  usdtRate: "USDT_RATE",
  providerRateMultiplier: "PROVIDER_RATE_MULTIPLIER",
  defaultMarkupPercent: "DEFAULT_MARKUP_PERCENT",
  minimumSafeMarginPercent: "MINIMUM_SAFE_MARGIN_PERCENT",
  bankingEnabled: "BANKING_ENABLED",
  usdtTrc20Enabled: "USDT_TRC20_ENABLED",
  usdtBep20Enabled: "USDT_BEP20_ENABLED",
  preventLossSales: "PREVENT_LOSS_SALES",
} as const;

@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly management: ManagementService,
    private readonly services: ServicesService,
    private readonly config: ConfigService,
    private readonly providerHealth: ProviderHealthService,
    private readonly wallets: WalletsService,
    @InjectQueue("orders") private readonly ordersQueue: Queue,
  ) {}
  @Get("dashboard") async dashboard() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [
      users,
      totalOrders,
      todayOrders,
      completed,
      attention,
      serviceCount,
      activeServices,
      provider,
      payments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { createdAt: { gte: start } } }),
      this.prisma.order.count({ where: { status: "COMPLETED" } }),
      this.prisma.order.count({
        where: {
          status: {
            in: [
              "WAITING_PROVIDER_BALANCE",
              "WAITING_PROVIDER_SYNC",
              "PRICE_CONFLICT",
              "SUBMISSION_UNKNOWN",
              "MANUAL_REVIEW",
            ],
          },
        },
      }),
      this.prisma.service.count(),
      this.prisma.service.count({
        where: {
          adminEnabled: true,
          providerEnabled: true,
          systemEnabled: true,
        },
      }),
      this.prisma.providerState.findUnique({ where: { id: "primary" } }),
      this.prisma.paymentTransaction.count(),
    ]);
    const revenue = await this.prisma.order.aggregate({
      _sum: { chargeAmount: true, costAmount: true },
      where: {
        createdAt: { gte: start },
        status: { in: ["SUBMITTED", "IN_PROGRESS", "COMPLETED", "PARTIAL"] },
      },
    });
    const charge = Number(revenue._sum.chargeAmount ?? 0),
      cost = Number(revenue._sum.costAmount ?? 0);
    const queues = await this.prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: {
        status: {
          in: [
            "WAITING_PROVIDER_BALANCE",
            "WAITING_PROVIDER_SYNC",
            "PRICE_CONFLICT",
            "SUBMISSION_UNKNOWN",
            "MANUAL_REVIEW",
          ],
        },
      },
    });
    return {
      success: true,
      data: {
        users,
        totalOrders,
        todayOrders,
        completed,
        attention,
        serviceCount,
        activeServices,
        payments,
        revenue: charge,
        profit: charge - cost,
        provider: provider
          ? {
              balance: provider.balance,
              currency: provider.currency,
              status: provider.status,
              lastCheckedAt: provider.lastCheckedAt,
            }
          : null,
        providerConfigured: Boolean(this.config.get("SMM_PROVIDER_API_KEY")),
        queues,
      },
    };
  }
  @Get("users") async users() {
    return {
      success: true,
      data: await this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
          wallet: { select: { balance: true, reserved: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  @Patch("users/:id") async updateUser(@Param("id") id:string,@Body() dto:EditManagedUserDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.management.editUser(id,dto,actor)};}
  @Patch("users/:id/wallet") async adjustWallet(@Param("id") id:string,@Body() dto:WalletAdjustmentDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.management.adjustWallet(id,dto,actor)};}
  @Get("services") async servicesList() {
    return {
      success: true,
      data: await this.prisma.service.findMany({
        include: { category: true },
        orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      }),
    };
  }
  @Patch("services/:id") async updateService(
    @Param("id") id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const current = await this.prisma.service.findUniqueOrThrow({
      where: { id },
    });
    const margin =
      dto.minimumSafeMargin === undefined
        ? current.minimumSafeMargin
        : new Prisma.Decimal(dto.minimumSafeMargin);
    const rate = this.services.calculateSellingRate(
      current.providerRate,
      dto.pricingMode ?? current.pricingMode,
      dto.markupValue === undefined
        ? current.markupValue
        : new Prisma.Decimal(dto.markupValue),
    );
    if (
      dto.adminEnabled !== false &&
      !this.services.isSellingRateSafe(current.providerRate, rate, margin)
    )
      throw new DomainError(
        "UNSAFE_SELLING_PRICE",
        "service.unsafe_selling_price",
        409,
      );
    return {
      success: true,
      data: await this.prisma.service.update({
        where: { id },
        data: {
          ...dto,
          sellingRate: rate,
          systemEnabled: this.services.isSellingRateSafe(
            current.providerRate,
            rate,
            margin,
          ),
        },
      }),
    };
  }
  @Patch("services-status/bulk") async bulkServiceStatus(
    @Body() dto: BulkServiceStatusDto,
  ) {
    if (dto.enabled) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.ids } },
      });
      if (
        services.some(
          (service) =>
            !this.services.isSellingRateSafe(
              service.providerRate,
              service.sellingRate,
              service.minimumSafeMargin,
            ),
        )
      )
        throw new DomainError(
          "UNSAFE_SELLING_PRICE",
          "service.unsafe_selling_price",
          409,
        );
    }
    const result = await this.prisma.service.updateMany({
      where: { id: { in: dto.ids } },
      data: { adminEnabled: dto.enabled },
    });
    return { success: true, data: { updated: result.count } };
  }
  @Patch("services-pricing/bulk") async bulkServicePricing(
    @Body() dto: BulkServicePricingDto,
  ) {
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.ids } },
    });
    let suspended = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const service of services) {
        const markup = new Prisma.Decimal(dto.markupValue);
        const margin = new Prisma.Decimal(dto.minimumSafeMargin);
        const sellingRate = this.services.calculateSellingRate(
          service.providerRate,
          dto.pricingMode,
          markup,
        );
        const safe = this.services.isSellingRateSafe(
          service.providerRate,
          sellingRate,
          margin,
        );
        if (!safe) suspended++;
        await tx.service.update({
          where: { id: service.id },
          data: {
            pricingMode: dto.pricingMode,
            markupValue: markup,
            minimumSafeMargin: margin,
            sellingRate,
            systemEnabled: safe,
          },
        });
      }
    });
    return { success: true, data: { updated: services.length, suspended } };
  }
  @Get("orders") async orders() {
    return {
      success: true,
      data: await this.prisma.order.findMany({
        include: {
          user: { select: { email: true, displayName: true } },
          service: { select: { displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  @Patch("orders/:id/action") async orderAction(@Param("id") id:string,@Body() dto:ManagedOrderActionDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.management.orderAction(id,dto,actor)};}
  @Get("payments/unmatched") async unmatchedPayments() {
    return { success: true, data: await this.prisma.paymentTransaction.findMany({ where: { provider: "BINANCE", depositRequestId: null }, select: { id: true, externalId: true, network: true, txHash: true, amount: true, receivedAt: true }, orderBy: { receivedAt: "desc" }, take: 100 }) };
  }
  @Get("payments") async payments() {
    return {
      success: true,
      data: await this.prisma.depositRequest.findMany({
        include: {
          user: { select: { email: true, displayName: true } },
          paymentTransactions: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  @Get("system") async system() {
    const [provider, users, services, orders, jobs] = await Promise.all([
      this.prisma.providerState.findUnique({ where: { id: "primary" } }),
      this.prisma.user.count(),
      this.prisma.service.count(),
      this.prisma.order.count(),
      this.prisma.outboxEvent.count({ where: { processedAt: null } }),
    ]);
    return {
      success: true,
      data: {
        database: { status: "ACTIVE", users, services, orders },
        provider: {
          configured: this.providerHealth.configured(),
          state: provider,
        },
        payments: {
          sepayConfigured: sepayConfigured(this.config),
          binanceConfigured: Boolean(
            this.config.get("BINANCE_API_KEY") &&
              this.config.get("BINANCE_API_SECRET"),
          ),
        },
        outboxPending: jobs,
      },
    };
  }
  @Post('system/provider/check') async checkProvider() {
    await this.providerHealth.check();
    return this.system();
  }
  @Get("settings") async settings() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    });
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const provider = await this.prisma.providerState.findUnique({
      where: { id: "primary" },
    });
    return {
      success: true,
      data: {
        supportTelegram: values.SUPPORT_TELEGRAM ?? "",
        supportFanpage: values.SUPPORT_FANPAGE ?? "",
        usdtRate: values.USDT_RATE ?? null,
        providerRateMultiplier: values.PROVIDER_RATE_MULTIPLIER ?? 25000,
        defaultMarkupPercent: values.DEFAULT_MARKUP_PERCENT ?? 20,
        minimumSafeMarginPercent: values.MINIMUM_SAFE_MARGIN_PERCENT ?? 2,
        providerLowBalanceThreshold: Number(
          provider?.lowBalanceThreshold ?? 2000000,
        ),
        bankingEnabled: values.BANKING_ENABLED ?? false,
        usdtTrc20Enabled: values.USDT_TRC20_ENABLED ?? false,
        usdtBep20Enabled: values.USDT_BEP20_ENABLED ?? false,
        preventLossSales: values.PREVENT_LOSS_SALES ?? true,
        readiness: {
          bankingCredentials: sepayConfigured(this.config),
          usdtCredentials: Boolean(
            this.config.get("BINANCE_API_KEY") &&
              this.config.get("BINANCE_API_SECRET"),
          ),
        },
      },
    };
  }
  @Put("settings") async updateSettings(@Body() dto: UpdateSettingsDto) {
    const entries = Object.entries(dto).filter(
      ([key, value]) =>
        key !== "providerLowBalanceThreshold" && value !== undefined,
    ) as Array<[keyof typeof SETTING_KEYS, unknown]>;
    await this.prisma.$transaction(async (tx) => {
      for (const [field, value] of entries)
        await tx.systemSetting.upsert({
          where: { key: SETTING_KEYS[field] },
          create: {
            key: SETTING_KEYS[field],
            value: value as Prisma.InputJsonValue,
            isPublic: [
              "supportTelegram",
              "supportFanpage",
              "usdtRate",
              "bankingEnabled",
              "usdtTrc20Enabled",
              "usdtBep20Enabled",
            ].includes(field),
          },
          update: { value: value as Prisma.InputJsonValue },
        });
      if (dto.providerLowBalanceThreshold !== undefined)
        await tx.providerState.upsert({
          where: { id: "primary" },
          create: {
            id: "primary",
            lowBalanceThreshold: dto.providerLowBalanceThreshold,
          },
          update: { lowBalanceThreshold: dto.providerLowBalanceThreshold },
        });
    });
    return this.settings();
  }
}
