import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ProviderService } from "../provider/provider.service";
import { WalletsService } from "../wallets/wallets.service";
import { NotificationsService } from "../notifications/notifications.service";
import { providerBalanceVnd } from "../shared/provider-money";

@Processor("orders", { concurrency: 10 })
export class OrderProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ProviderService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
    @InjectQueue("orders") private readonly queue: Queue,
  ) {
    super();
  }
  async onModuleInit() {
    await this.queue.add(
      "recover",
      {},
      {
        jobId: "orders-recovery",
        repeat: { every: 60_000 },
        removeOnComplete: 20,
        removeOnFail: 100,
      },
    );
  }
  async process(job: Job<{ orderId: string }>) {
    if (job.name === "recover") return this.recoverInterruptedOrders();
    if (job.name === "status") return this.syncStatus(job.data.orderId);
    if (job.name !== "submit") return;
    const order = await this.prisma.order.findUnique({
      where: { id: job.data.orderId },
      include: { service: true },
    });
    if (
      order?.status === "SCHEDULED" &&
      order.scheduledAt &&
      order.scheduledAt.getTime() > Date.now()
    ) {
      await this.queue.add(
        "submit",
        { orderId: order.id },
        {
          jobId: `scheduled-${order.id}`,
          delay: order.scheduledAt.getTime() - Date.now(),
          removeOnComplete: true,
        },
      );
      return;
    }
    if (
      !order ||
      order.providerOrderId ||
      ![
        "SCHEDULED",
        "FUNDS_RESERVED",
        "QUEUED",
        "WAITING_PROVIDER_BALANCE",
        "WAITING_PROVIDER_SYNC",
      ].includes(order.status)
    )
      return;
    let balance: { balance: string; currency: string };
    let availableVnd;
    try {
      balance = await this.provider.balance();
      const exchangeRate = await this.prisma.systemSetting.findUnique({where:{key:"PROVIDER_RATE_MULTIPLIER"}});
      availableVnd = providerBalanceVnd(balance.balance,balance.currency,Number(exchangeRate?.value??25000));
    } catch (error) {
      await this.prisma.order.updateMany({
        where: { id: order.id, status: order.status, providerOrderId: null },
        data: {
          status: "WAITING_PROVIDER_SYNC",
          nextRetryAt: new Date(Date.now() + 180_000),
          publicMessage: "Đơn đã được tiếp nhận và đang chờ hệ thống xử lý.",
        },
      });
      await this.queue.add(
        "submit",
        { orderId: order.id },
        {
          jobId: `retry-${order.id}-${Date.now()}`,
          delay: 180_000,
          removeOnComplete: true,
        },
      );
      return;
    }
    await this.notifications.observeProviderBalance(
      balance.balance,
      balance.currency,
      order.costAmount,
      order.publicId,
    );
    if (availableVnd.lt(order.costAmount)) {
      await this.prisma.order.updateMany({
        where: { id: order.id, status: order.status, providerOrderId: null },
        data: {
          status: "WAITING_PROVIDER_BALANCE",
          nextRetryAt: new Date(Date.now() + 180_000),
        },
      });
      await this.queue.add(
        "submit",
        { orderId: order.id },
        {
          jobId: `balance-${order.id}-${Date.now()}`,
          delay: 180_000,
          removeOnComplete: true,
        },
      );
      return;
    }
    if (order.service.providerRate.gt(order.sellingRateSnapshot)) {
      await this.prisma.order.updateMany({
        where: { id: order.id, status: order.status, providerOrderId: null },
        data: {
          status: "PRICE_CONFLICT",
          publicMessage: "Đơn đang được kiểm tra. Bạn không cần tạo lại đơn.",
        },
      });
      return;
    }
    const token = randomUUID();
    const claimed = await this.prisma.order.updateMany({
      where: {
        id: order.id,
        providerOrderId: null,
        OR: [{ status: { not: "SCHEDULED" } }, { scheduledAt: { lte: new Date() } }],
        status: {
          in: [
            "SCHEDULED",
            "FUNDS_RESERVED",
            "QUEUED",
            "WAITING_PROVIDER_BALANCE",
            "WAITING_PROVIDER_SYNC",
          ],
        },
      },
      data: { status: "SUBMITTING", submissionToken: token },
    });
    if (claimed.count !== 1) return;
    const attempt = await this.prisma.orderSubmissionAttempt.create({
      data: {
        orderId: order.id,
        attempt:
          (await this.prisma.orderSubmissionAttempt.count({
            where: { orderId: order.id },
          })) + 1,
        requestStartedAt: new Date(),
      },
    });
    try {
      const response = await this.provider.addOrder(
        order.service.providerServiceId,
        order.link,
        order.quantity,
        order.comments ?? undefined,
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            providerOrderId: String(response.order),
            status: "SUBMITTED",
            nextRetryAt: null,
          },
        });
        await tx.orderSubmissionAttempt.update({
          where: { id: attempt.id },
          data: { responseReceivedAt: new Date(), outcome: "ACCEPTED" },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: "SUBMITTING",
            toStatus: "SUBMITTED",
          },
        });
        await this.wallets.capture(
          tx,
          order.userId,
          order.chargeAmount,
          order.id,
        );
      });
      await this.queue.add(
        "status",
        { orderId: order.id },
        {
          jobId: `status-${order.id}-${Date.now()}`,
          delay: 180_000,
          removeOnComplete: true,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN";
      const knownBalanceError =
        /balance|fund|insufficient|not enough|số dư|không đủ|tài khoản/i.test(
          message,
        ) && message.startsWith("PROVIDER_REJECTED");
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: knownBalanceError
              ? "WAITING_PROVIDER_BALANCE"
              : "SUBMISSION_UNKNOWN",
            nextRetryAt: knownBalanceError
              ? new Date(Date.now() + 180_000)
              : null,
            publicMessage: knownBalanceError
              ? "Đơn đã được tiếp nhận và đang chờ xử lý."
              : "Đơn đang được kiểm tra. Bạn không cần tạo lại đơn.",
          },
        }),
        this.prisma.orderSubmissionAttempt.update({
          where: { id: attempt.id },
          data: {
            responseReceivedAt: new Date(),
            outcome: knownBalanceError ? "INSUFFICIENT_BALANCE" : "UNKNOWN",
            safeErrorCode: knownBalanceError
              ? "PROVIDER_BALANCE"
              : "AMBIGUOUS_RESPONSE",
          },
        }),
      ]);
      if (knownBalanceError)
        await this.queue.add(
          "submit",
          { orderId: order.id },
          {
            jobId: `balance-${order.id}-${Date.now()}`,
            delay: 180_000,
            removeOnComplete: true,
          },
        );
    }
  }
  private async recoverInterruptedOrders() {
    const now = new Date();
    const staleSubmittingBefore = new Date(Date.now() - 120_000);
    await this.prisma.order.updateMany({
      where: {
        status: "SUBMITTING",
        updatedAt: { lte: staleSubmittingBefore },
        providerOrderId: null,
      },
      data: {
        status: "SUBMISSION_UNKNOWN",
        nextRetryAt: null,
        publicMessage:
          "Nhà cung cấp chưa xác nhận kết quả gửi đơn. Đơn đang được đối soát để tránh gửi trùng; bạn không cần tạo lại đơn.",
      },
    });
    const waiting = await this.prisma.order.findMany({
      where: {
        status: { in: ["WAITING_PROVIDER_BALANCE", "WAITING_PROVIDER_SYNC"] },
        nextRetryAt: { lte: now },
      },
      select: { id: true },
      take: 200,
      orderBy: { nextRetryAt: "asc" },
    });
    const minute = Math.floor(Date.now() / 60_000);
    for (const order of waiting)
      await this.queue.add(
        "submit",
        { orderId: order.id },
        { jobId: `recovery-${order.id}-${minute}`, removeOnComplete: true },
      );
    const scheduled = await this.prisma.order.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: now } },
      select: { id: true },
      take: 200,
      orderBy: { scheduledAt: "asc" },
    });
    for (const order of scheduled)
      await this.queue.add(
        "submit",
        { orderId: order.id },
        {
          jobId: `scheduled-recovery-${order.id}-${minute}`,
          removeOnComplete: true,
        },
      );
    const staleStatuses = await this.prisma.order.findMany({
      where: {
        status: { in: ["SUBMITTED", "IN_PROGRESS"] },
        updatedAt: { lte: new Date(Date.now() - 300_000) },
      },
      select: { id: true },
      take: 200,
      orderBy: { updatedAt: "asc" },
    });
    for (const order of staleStatuses)
      await this.queue.add(
        "status",
        { orderId: order.id },
        {
          jobId: `status-recovery-${order.id}-${minute}`,
          removeOnComplete: true,
        },
      );
    return {
      waiting: waiting.length,
      scheduled: scheduled.length,
      statuses: staleStatuses.length,
    };
  }
  private async syncStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (
      !order?.providerOrderId ||
      ["COMPLETED", "PARTIAL", "CANCELED", "REFUNDED"].includes(order.status)
    )
      return;
    try {
      const result = await this.provider.status(order.providerOrderId);
      const map: Record<
        string,
        "SUBMITTED" | "IN_PROGRESS" | "COMPLETED" | "PARTIAL" | "CANCELED"
      > = {
        Pending: "SUBMITTED",
        Processing: "IN_PROGRESS",
        "In progress": "IN_PROGRESS",
        Completed: "COMPLETED",
        Partial: "PARTIAL",
        Canceled: "CANCELED",
      };
      const next = map[result.status] ?? "IN_PROGRESS";
      const remains = Math.max(
        0,
        Math.min(order.quantity, Number(result.remains) || 0),
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
        const current = await tx.order.findUniqueOrThrow({where:{id:order.id}});
        if (["COMPLETED", "PARTIAL", "CANCELED", "REFUNDED"].includes(current.status)) return;
        const finalStatus = next === "CANCELED" ? "REFUNDED" : next;
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: finalStatus,
            remains,
            startCount: Number(result.start_count) || null,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: current.status,
            toStatus: finalStatus,
          },
        });
        if (next === "CANCELED")
          await this.wallets.refund(
            tx,
            order.userId,
            order.chargeAmount,
            order.id,
            "Hoàn tiền đơn bị hủy",
          );
        if (next === "PARTIAL" && remains > 0)
          await this.wallets.refund(
            tx,
            order.userId,
            order.chargeAmount
              .mul(remains)
              .div(order.quantity)
              .toDecimalPlaces(2),
            order.id,
            "Hoàn tiền phần chưa thực hiện",
          );
      });
      if (!["COMPLETED", "PARTIAL", "CANCELED"].includes(next))
        await this.queue.add(
          "status",
          { orderId },
          {
            jobId: `status-${orderId}-${Date.now()}`,
            delay: 180_000,
            removeOnComplete: true,
          },
        );
    } catch {
      await this.queue.add(
        "status",
        { orderId },
        {
          jobId: `status-${orderId}-${Date.now()}`,
          delay: 300_000,
          removeOnComplete: true,
        },
      );
    }
  }
}
