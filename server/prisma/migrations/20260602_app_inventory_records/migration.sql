-- CreateTable
CREATE TABLE "AppInventoryStorageLocationRecord" (
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInventoryStorageLocationRecord_pkey" PRIMARY KEY ("companyId","name")
);

-- CreateTable
CREATE TABLE "AppInventoryRecord" (
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
    "discardedOpenSessionCount" INTEGER NOT NULL DEFAULT 0,
    "appliedPendingMovementCount" INTEGER NOT NULL DEFAULT 0,
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInventoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppInventoryCountSessionRecord" (
    "id" INTEGER NOT NULL,
    "inventoryId" INTEGER,
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

    CONSTRAINT "AppInventoryCountSessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppInventoryCountRecord" (
    "id" INTEGER NOT NULL,
    "inventoryId" INTEGER,
    "sessionId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "stockCenterId" INTEGER NOT NULL,
    "countedAt" TEXT NOT NULL,
    "storageLocation" TEXT NOT NULL,
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
    "productionExpectedYield" TEXT NOT NULL,
    "productionFinalYield" TEXT NOT NULL,
    "productionYieldDifference" TEXT NOT NULL,
    "productionTargetPh" TEXT NOT NULL,
    "productionConfirmedPh" TEXT NOT NULL,
    "productionTargetBrix" TEXT NOT NULL,
    "productionConfirmedBrix" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdByUserName" TEXT NOT NULL,
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInventoryCountRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppPendingInventoryMovementRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "stockCenterId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdByUserName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "session" JSONB NOT NULL,
    "records" JSONB NOT NULL,
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPendingInventoryMovementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppInventoryStorageLocationRecord_companyId_idx" ON "AppInventoryStorageLocationRecord"("companyId");

-- CreateIndex
CREATE INDEX "AppInventoryRecord_companyId_idx" ON "AppInventoryRecord"("companyId");
CREATE INDEX "AppInventoryRecord_stockCenterId_idx" ON "AppInventoryRecord"("stockCenterId");

-- CreateIndex
CREATE INDEX "AppInventoryCountSessionRecord_companyId_idx" ON "AppInventoryCountSessionRecord"("companyId");
CREATE INDEX "AppInventoryCountSessionRecord_inventoryId_idx" ON "AppInventoryCountSessionRecord"("inventoryId");
CREATE INDEX "AppInventoryCountSessionRecord_stockCenterId_idx" ON "AppInventoryCountSessionRecord"("stockCenterId");

-- CreateIndex
CREATE INDEX "AppInventoryCountRecord_companyId_idx" ON "AppInventoryCountRecord"("companyId");
CREATE INDEX "AppInventoryCountRecord_inventoryId_idx" ON "AppInventoryCountRecord"("inventoryId");
CREATE INDEX "AppInventoryCountRecord_sessionId_idx" ON "AppInventoryCountRecord"("sessionId");
CREATE INDEX "AppInventoryCountRecord_stockCenterId_idx" ON "AppInventoryCountRecord"("stockCenterId");

-- CreateIndex
CREATE INDEX "AppPendingInventoryMovementRecord_companyId_idx" ON "AppPendingInventoryMovementRecord"("companyId");
CREATE INDEX "AppPendingInventoryMovementRecord_stockCenterId_idx" ON "AppPendingInventoryMovementRecord"("stockCenterId");
CREATE INDEX "AppPendingInventoryMovementRecord_inventoryId_idx" ON "AppPendingInventoryMovementRecord"("inventoryId");
