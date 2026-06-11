ALTER TABLE "AppStockCenterRecord"
ADD COLUMN "salesImportSettings" JSONB NOT NULL DEFAULT '{"historyMode":"ROLLING_MONTHS","historyMonths":3,"coverageDays":7,"safetyMarginPercent":"20","consumptionMethod":"SIMPLE_AVERAGE","autoApplySuggestedMinimum":true,"allowManualMinimumOverride":true,"unmatchedRowPolicy":"BLOCK","duplicateRowPolicy":"BLOCK"}'::jsonb;
