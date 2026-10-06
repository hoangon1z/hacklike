ALTER TYPE "WalletTransactionType" ADD VALUE 'OPENING_BALANCE';
ALTER TABLE "User" ADD COLUMN "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "LegacyUserImport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "legacyUsername" TEXT NOT NULL,
  "phone" TEXT,
  "openingBalance" DECIMAL(20,2) NOT NULL,
  "historicalDeposited" DECIMAL(20,2) NOT NULL,
  "legacyCreatedAt" TIMESTAMP(3) NOT NULL,
  "rowHash" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegacyUserImport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegacyUserImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LegacyUserImport_userId_key" ON "LegacyUserImport"("userId");
CREATE UNIQUE INDEX "LegacyUserImport_email_key" ON "LegacyUserImport"("email");
