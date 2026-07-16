ALTER TABLE "ProductPackage"
ADD COLUMN "companyPackageId" TEXT;

CREATE UNIQUE INDEX "ProductPackage_productId_companyPackageId_key"
ON "ProductPackage"("productId", "companyPackageId");

CREATE INDEX "ProductPackage_companyPackageId_idx"
ON "ProductPackage"("companyPackageId");
