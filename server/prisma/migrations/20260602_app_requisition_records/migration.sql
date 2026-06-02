CREATE TABLE "AppRequisitionRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "requisitionGroupId" INTEGER NOT NULL,
    "stockCenterId" INTEGER NOT NULL,
    "stockCenterName" TEXT NOT NULL,
    "supplyCenterId" INTEGER,
    "supplyCenterName" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "countedAt" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "editScope" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdByUserName" TEXT NOT NULL,
    "approvedAt" TEXT NOT NULL,
    "approvedByUserId" INTEGER,
    "approvedByUserName" TEXT NOT NULL,
    "sentAt" TEXT NOT NULL,
    "sentByUserId" INTEGER,
    "sentByUserName" TEXT NOT NULL,
    "preparedAt" TEXT NOT NULL,
    "preparedByUserId" INTEGER,
    "preparedByUserName" TEXT NOT NULL,
    "receivedAt" TEXT NOT NULL,
    "receivedByUserId" INTEGER,
    "receivedByUserName" TEXT NOT NULL,
    "lastUpdatedAt" TEXT NOT NULL,
    "lastUpdatedByUserId" INTEGER,
    "lastUpdatedByUserName" TEXT NOT NULL,
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRequisitionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppRequisitionNotificationRecord" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "requisitionId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRequisitionNotificationRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppRequisitionRecord_companyId_idx" ON "AppRequisitionRecord"("companyId");
CREATE INDEX "AppRequisitionRecord_stockCenterId_idx" ON "AppRequisitionRecord"("stockCenterId");
CREATE INDEX "AppRequisitionRecord_status_idx" ON "AppRequisitionRecord"("status");
CREATE INDEX "AppRequisitionNotificationRecord_companyId_idx" ON "AppRequisitionNotificationRecord"("companyId");
CREATE INDEX "AppRequisitionNotificationRecord_userId_idx" ON "AppRequisitionNotificationRecord"("userId");
CREATE INDEX "AppRequisitionNotificationRecord_requisitionId_idx" ON "AppRequisitionNotificationRecord"("requisitionId");
