CREATE TABLE "AppStockCenterRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "userIds" INTEGER[],
    "responsibleUserIds" INTEGER[],
    "isProducer" BOOLEAN NOT NULL DEFAULT false,
    "producedTechnicalSheetIds" INTEGER[],
    "minimumStocks" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppStockCenterRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppStockCenterRecord_companyId_idx" ON "AppStockCenterRecord"("companyId");
