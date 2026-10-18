CREATE TABLE "AppProductionOperationRecord" (
    "key" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "centerId" INTEGER NOT NULL,
    "sheetId" INTEGER NOT NULL,
    "draftId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startResult" JSONB,
    "finishResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppProductionOperationRecord_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AppProductionOperationRecord_companyId_centerId_idx" ON "AppProductionOperationRecord"("companyId", "centerId");
CREATE INDEX "AppProductionOperationRecord_draftId_idx" ON "AppProductionOperationRecord"("draftId");
