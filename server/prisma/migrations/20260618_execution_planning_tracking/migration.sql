ALTER TABLE "AppRequisitionRecord"
ADD COLUMN "planningRootRequestId" INTEGER,
ADD COLUMN "planningSourceKind" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planningSourceCenterId" INTEGER,
ADD COLUMN "planningSourceCenterName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planningSourceSheetId" INTEGER,
ADD COLUMN "planningSourceSheetName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planningSourceQuantityLabel" TEXT NOT NULL DEFAULT '';

ALTER TABLE "AppManualProductionRequestRecord"
ADD COLUMN "planningSourceKind" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planningSourceCenterId" INTEGER,
ADD COLUMN "planningSourceCenterName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planningSourceSheetId" INTEGER,
ADD COLUMN "planningSourceSheetName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planningSourceQuantityLabel" TEXT NOT NULL DEFAULT '';
