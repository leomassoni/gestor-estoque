ALTER TABLE "AppCompanyRecord"
ADD COLUMN "linkedCompanyIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "AppProductRecord"
ADD COLUMN "ownerCompanyId" INTEGER NOT NULL DEFAULT 0;

UPDATE "AppProductRecord"
SET "ownerCompanyId" = "companyId";

ALTER TABLE "AppTechnicalSheetRecord"
ADD COLUMN "ownerCompanyId" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sharedCompanyIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

UPDATE "AppTechnicalSheetRecord"
SET
  "ownerCompanyId" = "companyId",
  "sharedCompanyIds" = ARRAY["companyId"];

CREATE INDEX "AppProductRecord_ownerCompanyId_idx" ON "AppProductRecord"("ownerCompanyId");
CREATE INDEX "AppTechnicalSheetRecord_ownerCompanyId_idx" ON "AppTechnicalSheetRecord"("ownerCompanyId");
