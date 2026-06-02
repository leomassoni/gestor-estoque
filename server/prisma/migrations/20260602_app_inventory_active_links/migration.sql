-- CreateTable
CREATE TABLE "AppInventoryActiveRecordLinkRecord" (
    "companyId" INTEGER NOT NULL,
    "userKey" TEXT NOT NULL,
    "inventoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInventoryActiveRecordLinkRecord_pkey" PRIMARY KEY ("companyId","userKey")
);

-- CreateTable
CREATE TABLE "AppInventoryActiveSessionLinkRecord" (
    "companyId" INTEGER NOT NULL,
    "userKey" TEXT NOT NULL,
    "sessionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInventoryActiveSessionLinkRecord_pkey" PRIMARY KEY ("companyId","userKey")
);

-- CreateIndex
CREATE INDEX "AppInventoryActiveRecordLinkRecord_companyId_idx" ON "AppInventoryActiveRecordLinkRecord"("companyId");

-- CreateIndex
CREATE INDEX "AppInventoryActiveSessionLinkRecord_companyId_idx" ON "AppInventoryActiveSessionLinkRecord"("companyId");
