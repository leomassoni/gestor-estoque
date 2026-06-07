ALTER TABLE "AppStockModuleSettingsRecord"
ADD COLUMN "salesImportDefaultHistoryMode" TEXT NOT NULL DEFAULT 'ROLLING_MONTHS',
ADD COLUMN "salesImportDefaultHistoryMonths" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "salesImportDefaultCoverageDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "salesImportDefaultSafetyMarginPercent" TEXT NOT NULL DEFAULT '20',
ADD COLUMN "salesImportAutoApplySuggestedMinimum" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "salesImportAllowManualMinimumOverride" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "salesImportUnmatchedRowPolicy" TEXT NOT NULL DEFAULT 'BLOCK',
ADD COLUMN "salesImportDuplicateRowPolicy" TEXT NOT NULL DEFAULT 'BLOCK';

ALTER TABLE "AppTechnicalSheetRecord"
ADD COLUMN "preparationLeadTimeDays" TEXT NOT NULL DEFAULT '';

CREATE TABLE "AppSalesImportTemplateRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "stockCenterId" INTEGER,
    "name" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "headerRow" INTEGER NOT NULL,
    "dataStartRow" INTEGER NOT NULL,
    "dateMode" TEXT NOT NULL,
    "dateColumn" TEXT NOT NULL,
    "dateCell" TEXT NOT NULL,
    "codeColumn" TEXT NOT NULL,
    "quantityColumn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSalesImportTemplateRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppSalesImportTemplateRecord_companyId_idx"
  ON "AppSalesImportTemplateRecord"("companyId");

CREATE INDEX "AppSalesImportTemplateRecord_stockCenterId_idx"
  ON "AppSalesImportTemplateRecord"("stockCenterId");

CREATE TABLE "AppSalesImportBatchRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "stockCenterId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "uploadedByUserId" INTEGER,
    "uploadedByUserName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "historyMode" TEXT NOT NULL,
    "historyMonths" INTEGER,
    "coverageDays" INTEGER NOT NULL,
    "safetyMarginPercent" TEXT NOT NULL,
    "postingMode" TEXT NOT NULL DEFAULT 'ANALYTICAL_ONLY',
    "status" TEXT NOT NULL,
    "importedAt" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSalesImportBatchRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppSalesImportBatchRecord_companyId_idx"
  ON "AppSalesImportBatchRecord"("companyId");

CREATE INDEX "AppSalesImportBatchRecord_stockCenterId_idx"
  ON "AppSalesImportBatchRecord"("stockCenterId");

CREATE INDEX "AppSalesImportBatchRecord_templateId_idx"
  ON "AppSalesImportBatchRecord"("templateId");

CREATE INDEX "AppSalesImportBatchRecord_status_idx"
  ON "AppSalesImportBatchRecord"("status");

CREATE TABLE "AppSalesImportRowRecord" (
    "id" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "stockCenterId" INTEGER NOT NULL,
    "sourceRowKey" TEXT NOT NULL,
    "consumedAt" TEXT NOT NULL,
    "companyProductId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "matchedTechnicalSheetId" INTEGER,
    "matchedKind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSalesImportRowRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppSalesImportRowRecord_batchId_idx"
  ON "AppSalesImportRowRecord"("batchId");

CREATE INDEX "AppSalesImportRowRecord_companyId_idx"
  ON "AppSalesImportRowRecord"("companyId");

CREATE INDEX "AppSalesImportRowRecord_stockCenterId_idx"
  ON "AppSalesImportRowRecord"("stockCenterId");

CREATE INDEX "AppSalesImportRowRecord_matchedTechnicalSheetId_idx"
  ON "AppSalesImportRowRecord"("matchedTechnicalSheetId");

CREATE INDEX "AppSalesImportRowRecord_status_idx"
  ON "AppSalesImportRowRecord"("status");

CREATE TABLE "AppSalesConsumptionRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "stockCenterId" INTEGER NOT NULL,
    "consumedAt" TEXT NOT NULL,
    "sourceBatchId" INTEGER NOT NULL,
    "sourceTechnicalSheetId" INTEGER NOT NULL,
    "sourceTechnicalSheetKind" TEXT NOT NULL,
    "ingredientProductId" TEXT NOT NULL,
    "quantityConsumed" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stockPostingStatus" TEXT NOT NULL,
    "stockMovementId" INTEGER,
    "postedAt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSalesConsumptionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppSalesConsumptionRecord_companyId_idx"
  ON "AppSalesConsumptionRecord"("companyId");

CREATE INDEX "AppSalesConsumptionRecord_stockCenterId_idx"
  ON "AppSalesConsumptionRecord"("stockCenterId");

CREATE INDEX "AppSalesConsumptionRecord_sourceBatchId_idx"
  ON "AppSalesConsumptionRecord"("sourceBatchId");

CREATE INDEX "AppSalesConsumptionRecord_sourceTechnicalSheetId_idx"
  ON "AppSalesConsumptionRecord"("sourceTechnicalSheetId");

CREATE INDEX "AppSalesConsumptionRecord_ingredientProductId_idx"
  ON "AppSalesConsumptionRecord"("ingredientProductId");

CREATE INDEX "AppSalesConsumptionRecord_stockPostingStatus_idx"
  ON "AppSalesConsumptionRecord"("stockPostingStatus");
