CREATE TABLE "AppManualProductionRequestRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "centerId" INTEGER NOT NULL,
    "sheetId" INTEGER NOT NULL,
    "desiredYield" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdByUserName" TEXT NOT NULL,
    "rootRequestId" INTEGER NOT NULL,
    "parentRequestId" INTEGER,
    "isDependencyRequest" BOOLEAN NOT NULL DEFAULT false,
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppManualProductionRequestRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppProductionDraftRecord" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "centerId" INTEGER NOT NULL,
    "sheetId" INTEGER NOT NULL,
    "startedAt" TEXT NOT NULL,
    "startedByUserId" INTEGER,
    "startedByUserName" TEXT NOT NULL,
    "desiredYield" TEXT NOT NULL,
    "finalYield" TEXT NOT NULL,
    "confirmedPh" TEXT NOT NULL,
    "confirmedBrix" TEXT NOT NULL,
    "ingredientOverrides" JSONB NOT NULL,
    "manualOverrideIngredientIds" INTEGER[],
    "consumptionSessionId" INTEGER,
    "manualRequestIds" INTEGER[],
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppProductionDraftRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppProductionDraftRecord_draftId_key" ON "AppProductionDraftRecord"("draftId");
CREATE INDEX "AppManualProductionRequestRecord_companyId_idx" ON "AppManualProductionRequestRecord"("companyId");
CREATE INDEX "AppManualProductionRequestRecord_centerId_idx" ON "AppManualProductionRequestRecord"("centerId");
CREATE INDEX "AppManualProductionRequestRecord_sheetId_idx" ON "AppManualProductionRequestRecord"("sheetId");
CREATE INDEX "AppManualProductionRequestRecord_rootRequestId_idx" ON "AppManualProductionRequestRecord"("rootRequestId");
CREATE INDEX "AppProductionDraftRecord_companyId_idx" ON "AppProductionDraftRecord"("companyId");
CREATE INDEX "AppProductionDraftRecord_centerId_idx" ON "AppProductionDraftRecord"("centerId");
CREATE INDEX "AppProductionDraftRecord_sheetId_idx" ON "AppProductionDraftRecord"("sheetId");
