import { ConflictException, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WalletsService } from "../wallets/wallets.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { DomainError } from "../shared/domain-error";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    @InjectQueue("orders") private readonly queue: Queue,
  ) {}
  async create(userId: string, idempotencyKey: string, dto: CreateOrderDto) {
    if (!userId)
      throw new DomainError("UNAUTHORIZED", "auth.login_required", 401);
    if (!idempotencyKey || idempotencyKey.length < 12)
      throw new ConflictException("Idempotency-Key is required");
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return existing;
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() < Date.now() + 30_000)
      throw new DomainError(
        "INVALID_SCHEDULE_TIME",
        "order.schedule_too_soon",
        422,
      );
    if (scheduledAt && scheduledAt.getTime() > Date.now() + 90 * 86400_000)
      throw new DomainError(
        "INVALID_SCHEDULE_TIME",
        "order.schedule_too_far",
        422,
      );
    const order = await this.prisma.$transaction(async (tx) => {
      const service = await tx.service.findFirst({
        where: {
          id: dto.serviceId,
          adminEnabled: true,
          providerEnabled: true,
          systemEnabled: true,
        },
      });
      if (!service)
        throw new DomainError(
          "SERVICE_UNAVAILABLE",
          "service.not_available",
          409,
        );
      const lossProtection = await tx.systemSetting.findUnique({
        where: { key: "PREVENT_LOSS_SALES" },
      });
      const commentLines = (dto.comments ?? "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const customComments = service.providerType === "Custom Comments";
      if (customComments && (!commentLines.length || commentLines.length !== dto.quantity))
        throw new DomainError("INVALID_COMMENTS", "order.invalid_comments", 422);
      if (!customComments && commentLines.length)
        throw new DomainError("INVALID_COMMENTS", "order.invalid_comments", 422);
      if (
        lossProtection?.value !== false &&
        service.sellingRate.lt(service.providerRate)
      )
        throw new DomainError(
          "SERVICE_PRICE_UPDATED",
          "service.price_updated",
          409,
          { sellingRate: service.sellingRate.toNumber() },
        );
      if (dto.quantity < service.min || dto.quantity > service.max)
        throw new DomainError(
          "ORDER_QUANTITY_OUT_OF_RANGE",
          "order.quantity_out_of_range",
          422,
          { min: service.min, max: service.max },
        );
      const charge = service.sellingRate
        .mul(dto.quantity)
        .div(1000)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP);
      const cost = service.providerRate
        .mul(dto.quantity)
        .div(1000)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP);
      const publicId = `SVN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 5).toUpperCase()}`;
      const created = await tx.order.create({
        data: {
          publicId,
          userId,
          serviceId: service.id,
          idempotencyKey,
          link: dto.link,
          quantity: dto.quantity,
          comments: customComments ? commentLines.join("\n") : null,
          providerRateSnapshot: service.providerRate,
          sellingRateSnapshot: service.sellingRate,
          costAmount: cost,
          chargeAmount: charge,
          status: scheduledAt ? "SCHEDULED" : "FUNDS_RESERVED",
          scheduledAt,
        },
      });
      await this.wallets.reserve(
        tx,
        userId,
        charge,
        created.id,
        `reserve:${created.id}`,
      );
      await tx.orderStatusHistory.create({
        data: {
          orderId: created.id,
          fromStatus: "CREATED",
          toStatus: scheduledAt ? "SCHEDULED" : "FUNDS_RESERVED",
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "ORDER",
          aggregateId: created.id,
          eventType: "ORDER_CREATED",
          payload: { orderId: created.id },
        },
      });
      return created;
    });
    await this.queue.add(
      "submit",
      { orderId: order.id },
      { jobId: `submit-${order.id}`, attempts: 1, removeOnComplete: 1000 },
    );
    return order;
  }
  get(userId: string, publicId: string) {
    return this.prisma.order.findFirstOrThrow({
      where: { publicId, userId },
      include: {
        service: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
  }
  list(userId: string, group?: string) {
    return this.prisma.order.findMany({
      where: { userId, ...(group ? { service: { category: { name: group } } } : {}) },
      include: {
        service: {
          select: { displayName: true, category: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async cancelScheduled(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id, userId, status: "SCHEDULED" },
      });
      if (!order)
        throw new DomainError(
          "SCHEDULE_CANCEL_NOT_ALLOWED",
          "order.schedule_cancel_not_allowed",
          409,
        );
      await this.wallets.release(
        tx,
        userId,
        order.chargeAmount,
        order.id,
        "Hủy lịch chạy đơn",
      );
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELED",
          publicMessage: "Lịch chạy đã hủy và số dư giữ đã được hoàn lại.",
          nextRetryAt: null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: "SCHEDULED",
          toStatus: "CANCELED",
          reasonCode: "CUSTOMER_CANCELED_SCHEDULE",
        },
      });
      return updated;
    });
  }
}
