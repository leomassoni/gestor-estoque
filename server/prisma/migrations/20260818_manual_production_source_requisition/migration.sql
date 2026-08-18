ALTER TABLE "AppManualProductionRequestRecord" ADD COLUMN "sourceRequisitionId" INTEGER;
ALTER TABLE "AppManualProductionRequestRecord" ADD COLUMN "sourceRequisitionGroupId" INTEGER;
ALTER TABLE "AppManualProductionRequestRecord" ADD COLUMN "sourceRequisitionLineKey" TEXT NOT NULL DEFAULT '';
CREATE INDEX "AppManualProductionRequestRecord_sourceRequisitionId_idx" ON "AppManualProductionRequestRecord"("sourceRequisitionId");
CREATE INDEX "AppManualProductionRequestRecord_sourceRequisitionGroupId_idx" ON "AppManualProductionRequestRecord"("sourceRequisitionGroupId");
