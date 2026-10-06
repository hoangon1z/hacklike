CREATE TABLE "UsdtDepositAllocation" (
  "network" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "amount" DECIMAL(20,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("network", "address", "amount")
);
-- Never recycle previously issued amounts, including expired requests.
INSERT INTO "UsdtDepositAllocation" ("network", "address", "amount")
SELECT DISTINCT "network", CASE WHEN "network" = 'BSC' THEN LOWER("destinationAddress") ELSE "destinationAddress" END, "expectedUsdt"
FROM "DepositRequest"
WHERE "network" IS NOT NULL AND "destinationAddress" IS NOT NULL AND "expectedUsdt" IS NOT NULL
ON CONFLICT DO NOTHING;
