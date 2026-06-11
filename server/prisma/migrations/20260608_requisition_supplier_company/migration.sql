ALTER TABLE "AppRequisitionRecord"
ADD COLUMN "supplyCompanyId" INTEGER,
ADD COLUMN "supplyCompanyName" TEXT NOT NULL DEFAULT '';
