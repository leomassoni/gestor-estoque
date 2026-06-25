CREATE TABLE "AppWasteSessionRecord" (
  "id" INTEGER NOT NULL,
  "companyId" INTEGER NOT NULL,
  "stockCenterId" INTEGER NOT NULL,
  "countedAt" TEXT NOT NULL,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TEXT NOT NULL,
  "startedByUserId" INTEGER,
  "startedByUserName" TEXT NOT NULL,
  "closedAt" TEXT NOT NULL,
  "closedByUserId" INTEGER,
  "closedByUserName" TEXT NOT NULL,
  "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppWasteSessionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppWasteRecord" (
  "id" INTEGER NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "companyId" INTEGER NOT NULL,
  "stockCenterId" INTEGER NOT NULL,
  "countedAt" TEXT NOT NULL,
  "technicalSheetId" INTEGER,
  "productId" TEXT NOT NULL,
  "serviceItemId" TEXT NOT NULL,
  "packageId" INTEGER,
  "technicalSheetName" TEXT NOT NULL,
  "technicalSheetKind" TEXT NOT NULL,
  "recipientItemId" TEXT NOT NULL,
  "recipientLabel" TEXT NOT NULL,
  "closedItemsQuantity" TEXT NOT NULL,
  "hasOpenItems" BOOLEAN NOT NULL DEFAULT false,
  "openItemsGrossWeight" TEXT NOT NULL,
  "openItemsContainerQuantity" TEXT NOT NULL,
  "openItemsNetQuantity" TEXT NOT NULL,
  "totalCountedQuantity" TEXT NOT NULL,
  "totalCountedUnit" TEXT NOT NULL,
  "createdByUserId" INTEGER,
  "createdByUserName" TEXT NOT NULL,
  "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppWasteRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppWasteSessionRecord_companyId_idx" ON "AppWasteSessionRecord"("companyId");
CREATE INDEX "AppWasteSessionRecord_stockCenterId_idx" ON "AppWasteSessionRecord"("stockCenterId");
CREATE INDEX "AppWasteRecord_companyId_idx" ON "AppWasteRecord"("companyId");
CREATE INDEX "AppWasteRecord_sessionId_idx" ON "AppWasteRecord"("sessionId");
CREATE INDEX "AppWasteRecord_stockCenterId_idx" ON "AppWasteRecord"("stockCenterId");
