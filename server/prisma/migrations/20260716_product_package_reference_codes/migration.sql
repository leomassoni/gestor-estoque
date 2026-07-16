CREATE TABLE "ProductPackageReferenceCode" (
    "id" TEXT NOT NULL,
    "productPackageId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductPackageReferenceCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductPackageReferenceCode_productPackageId_code_key"
ON "ProductPackageReferenceCode"("productPackageId", "code");

CREATE INDEX "ProductPackageReferenceCode_productPackageId_idx"
ON "ProductPackageReferenceCode"("productPackageId");

CREATE INDEX "ProductPackageReferenceCode_code_idx"
ON "ProductPackageReferenceCode"("code");

ALTER TABLE "ProductPackageReferenceCode" ADD CONSTRAINT "ProductPackageReferenceCode_productPackageId_fkey" FOREIGN KEY ("productPackageId") REFERENCES "ProductPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
