ALTER TABLE "AppProductRecord"
ADD COLUMN "ignoreStock" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AppTechnicalSheetRecord"
ADD COLUMN "yieldDifferenceDestination" TEXT NOT NULL DEFAULT '',
ADD COLUMN "yieldDifferenceByproductName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "yieldDifferenceByproductTechnicalSheetId" INTEGER;
