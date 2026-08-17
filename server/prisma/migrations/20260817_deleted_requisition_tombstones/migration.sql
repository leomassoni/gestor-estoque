CREATE TABLE "AppDeletedRequisitionRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER,
    "stockCenterId" INTEGER,
    "stockCenterName" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppDeletedRequisitionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppDeletedRequisitionRecord_companyId_idx" ON "AppDeletedRequisitionRecord"("companyId");
CREATE INDEX "AppDeletedRequisitionRecord_stockCenterId_idx" ON "AppDeletedRequisitionRecord"("stockCenterId");
