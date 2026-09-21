ALTER TABLE "AppTechnicalSheetRecord"
ADD COLUMN "companyProductIdAliasesByCompanyId" JSONB NOT NULL DEFAULT '{}'::jsonb;
