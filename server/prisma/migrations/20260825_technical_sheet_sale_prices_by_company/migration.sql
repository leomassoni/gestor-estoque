ALTER TABLE "AppTechnicalSheetRecord"
ADD COLUMN "finalSalePricesByCompanyId" JSONB NOT NULL DEFAULT '{}'::jsonb;
