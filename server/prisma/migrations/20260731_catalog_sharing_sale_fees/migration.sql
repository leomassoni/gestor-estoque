CREATE TABLE "AppCatalogSharingSaleFeeRecord" (
  "ownerCompanyId" INTEGER NOT NULL,
  "targetCompanyId" INTEGER NOT NULL,
  "preparationSaleFeePercentage" TEXT NOT NULL,
  "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppCatalogSharingSaleFeeRecord_pkey" PRIMARY KEY ("ownerCompanyId", "targetCompanyId")
);

CREATE INDEX "AppCatalogSharingSaleFeeRecord_targetCompanyId_idx" ON "AppCatalogSharingSaleFeeRecord"("targetCompanyId");
