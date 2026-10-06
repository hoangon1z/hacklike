import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export function financePeriod(period: string, now = new Date()) {
  const end = new Date(now);
  const vietnamDay = new Date(now.getTime() + 7 * 3600000);
  const start = new Date(Date.UTC(vietnamDay.getUTCFullYear(), vietnamDay.getUTCMonth(), vietnamDay.getUTCDate()) - 7 * 3600000);
  if (period === '7d') start.setUTCDate(start.getUTCDate() - 6);
  if (period === '30d') start.setUTCDate(start.getUTCDate() - 29);
  return { start: period === 'all' ? new Date(0) : start, end };
}

@Injectable()
export class FinanceService {
  constructor(private readonly db: PrismaService) {}
  async overview(period: string) {
    const {start,end} = financePeriod(period);
    return this.db.$transaction(async tx => {
      // Order report uses creation-date cohorts; wallet cash movements use event dates.
      // Cost is the immutable price snapshot, NOT proof of a source debit/refund.
      const scope = Prisma.sql`o."createdAt" >= ${start} AND o."createdAt" <= ${end}`;
      const [rows] = await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        WITH scoped AS (SELECT o.* FROM "Order" o WHERE ${scope}), movement AS (
          SELECT w."referenceId", -SUM(CASE WHEN w.type='ORDER_CAPTURE' THEN w.amount ELSE 0 END) AS captured,
            SUM(CASE WHEN w.type='REFUND' THEN w.amount ELSE 0 END) AS refunded
          FROM "WalletTransaction" w JOIN scoped o ON o.id=w."referenceId"
          WHERE w."referenceType"='ORDER' AND w.type IN ('ORDER_CAPTURE','REFUND') GROUP BY w."referenceId"
        ), ledger AS (
          SELECT o.*, COALESCE(m.captured,0) AS captured, COALESCE(m.refunded,0) AS refunded,
            o.status IN ('COMPLETED','PARTIAL','REFUNDED') AS closed
          FROM scoped o LEFT JOIN movement m ON m."referenceId"=o.id
        ) SELECT COUNT(*) AS "orders", COALESCE(SUM(captured),0) AS "captured",
          COALESCE(SUM(refunded),0) AS "refunded",
          COALESCE(SUM(captured-refunded),0) AS "netCharged",
          COALESCE(SUM(CASE WHEN closed THEN captured-refunded ELSE 0 END),0) AS "closedRevenue",
          COALESCE(SUM(CASE WHEN closed AND "providerOrderId" IS NOT NULL THEN "costAmount" ELSE 0 END),0) AS "closedCostSnapshot",
          COALESCE(SUM(CASE WHEN NOT closed THEN captured-refunded ELSE 0 END),0) AS "runningCharged",
          COALESCE(SUM(CASE WHEN status IN ('SUBMITTED','IN_PROGRESS') THEN "costAmount" ELSE 0 END),0) AS "runningCostSnapshot",
          COUNT(*) FILTER (WHERE status='COMPLETED') AS "completed",
          COUNT(*) FILTER (WHERE status IN ('SUBMITTED','IN_PROGRESS','SUBMITTING')) AS "running",
          COUNT(*) FILTER (WHERE status='SCHEDULED') AS "scheduled",
          COUNT(*) FILTER (WHERE status IN ('WAITING_PROVIDER_BALANCE','WAITING_PROVIDER_SYNC','PRICE_CONFLICT','SUBMISSION_UNKNOWN','MANUAL_REVIEW')) AS "attention",
          COUNT(*) FILTER (WHERE status IN ('PARTIAL','REFUNDED') AND "providerOrderId" IS NOT NULL) AS "sourceRefundReview",
          COUNT(*) FILTER (WHERE closed AND "providerOrderId" IS NOT NULL AND captured-refunded < "costAmount") AS "negativeEstimate",
          COUNT(*) FILTER (WHERE status='COMPLETED' AND captured=0 AND "chargeAmount">0) AS "missingCapture"
        FROM ledger`);
      const [movements,wallets,statuses,daily,topServices] = await Promise.all([
        tx.walletTransaction.groupBy({by:['type'],where:{createdAt:{gte:start,lte:end}},_sum:{amount:true},_count:{_all:true}}),
        tx.wallet.aggregate({_sum:{balance:true,reserved:true}}),
        tx.order.groupBy({by:['status'],where:{createdAt:{gte:start,lte:end}},_count:{_all:true}}),
        tx.$queryRaw<Array<{day:string;amount:Prisma.Decimal}>>(Prisma.sql`SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS day,
          -SUM(amount) AS amount FROM "WalletTransaction" WHERE type='ORDER_CAPTURE' AND "createdAt">=${period==='all'?financePeriod('30d',end).start:start} AND "createdAt"<=${end} GROUP BY day ORDER BY day`),
        tx.$queryRaw<Array<{name:string;orders:bigint;amount:Prisma.Decimal}>>(Prisma.sql`SELECT s."displayName" AS name, COUNT(*) AS orders, SUM(o."chargeAmount") AS amount
          FROM "Order" o JOIN "Service" s ON s.id=o."serviceId" WHERE ${scope} GROUP BY s.id,s."displayName" ORDER BY COUNT(*) DESC LIMIT 5`),
      ]);
      const financial = Object.fromEntries(Object.entries(rows).map(([key,value])=>[key,Number(value)]));
      const movement = (type:string)=>Number(movements.find(row=>row.type===type)?._sum.amount??0);
      const balance=Number(wallets._sum.balance??0),reserved=Number(wallets._sum.reserved??0);
      return {period,from:start.toISOString(),to:end.toISOString(),...financial,
        estimatedGrossProfit:financial.closedRevenue-financial.closedCostSnapshot,
        customerDeposits:movement('DEPOSIT'),walletAdjustments:movement('ADMIN_ADJUSTMENT'),
        refundsInPeriod:movement('REFUND'),customerWalletBalance:balance,customerWalletReserved:reserved,
        customerWalletAvailable:balance-reserved,
        statuses:statuses.map(row=>({status:row.status,count:row._count._all})),
        daily:daily.map(row=>({day:row.day,amount:Number(row.amount)})),
        topServices:topServices.map(row=>({name:row.name,orders:Number(row.orders),amount:Number(row.amount)})),
        sourceTopupsTracked:false,operatingExpensesTracked:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
