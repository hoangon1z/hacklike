ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED' AFTER 'CREATED';

ALTER TABLE "Order" ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE INDEX "Order_status_scheduledAt_idx" ON "Order"("status", "scheduledAt");
