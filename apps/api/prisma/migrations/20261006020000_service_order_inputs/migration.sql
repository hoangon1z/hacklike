ALTER TABLE "Service" ADD COLUMN "providerType" TEXT NOT NULL DEFAULT 'Default', ADD COLUMN "providerDescription" TEXT;
ALTER TABLE "Order" ADD COLUMN "comments" TEXT;
