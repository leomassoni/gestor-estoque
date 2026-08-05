ALTER TABLE "AppServiceItemRecord" ADD COLUMN "ownerCompanyId" INTEGER;

UPDATE "AppServiceItemRecord"
SET "ownerCompanyId" = "companyId"
WHERE "ownerCompanyId" IS NULL;

ALTER TABLE "AppServiceItemRecord" ALTER COLUMN "ownerCompanyId" SET NOT NULL;

CREATE INDEX "AppServiceItemRecord_ownerCompanyId_idx" ON "AppServiceItemRecord"("ownerCompanyId");
