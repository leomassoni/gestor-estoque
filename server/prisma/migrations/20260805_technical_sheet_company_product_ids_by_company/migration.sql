ALTER TABLE "AppTechnicalSheetRecord"
ADD COLUMN "companyProductIdsByCompanyId" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "AppTechnicalSheetRecord"
SET "companyProductIdsByCompanyId" = CASE
  WHEN trim("companyProductId") <> '' THEN jsonb_build_object("ownerCompanyId"::text, "companyProductId")
  ELSE '{}'::jsonb
END;
