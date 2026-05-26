-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "ProductMeasurementUnit" AS ENUM ('LITER', 'MILLILITER', 'KILOGRAM', 'GRAM');

-- CreateEnum
CREATE TYPE "ProductMeasurementKind" AS ENUM ('VOLUME', 'MASS');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "taxId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Establishment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyProductId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "barcode" TEXT,
    "measurementKind" "ProductMeasurementKind" NOT NULL,
    "measurementUnit" "ProductMeasurementUnit" NOT NULL,
    "normalizedUnit" "ProductMeasurementUnit" NOT NULL,
    "alcoholPercentage" DECIMAL(65,30),
    "densityFactor" DECIMAL(65,30),
    "densitySampleVolumeMl" DECIMAL(65,30),
    "densitySampleWeightGrams" DECIMAL(65,30),
    "familyId" TEXT,
    "subfamilyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFamily" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSubfamily" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubfamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSector" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPackage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "internalCode" TEXT NOT NULL,
    "label" TEXT,
    "barcode" TEXT,
    "packageQuantity" DECIMAL(65,30) NOT NULL,
    "packageUnit" "ProductMeasurementUnit" NOT NULL,
    "normalizedQuantity" DECIMAL(65,30) NOT NULL,
    "normalizedUnit" "ProductMeasurementUnit" NOT NULL,
    "purchasePrice" DECIMAL(65,30),
    "grossWeightGrams" DECIMAL(65,30),
    "packagingWeightGrams" DECIMAL(65,30),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productPackageId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minQuantity" DECIMAL(65,30),
    "openingQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productPackageId" TEXT,
    "performedByUserId" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_taxId_key" ON "Company"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_companyId_userId_key" ON "Membership"("companyId", "userId");

-- CreateIndex
CREATE INDEX "Establishment_companyId_idx" ON "Establishment"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Establishment_companyId_code_key" ON "Establishment"("companyId", "code");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE INDEX "Product_familyId_idx" ON "Product"("familyId");

-- CreateIndex
CREATE INDEX "Product_subfamilyId_idx" ON "Product"("subfamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_companyProductId_key" ON "Product"("companyId", "companyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_barcode_key" ON "Product"("companyId", "barcode");

-- CreateIndex
CREATE INDEX "Sector_companyId_idx" ON "Sector"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_companyId_name_key" ON "Sector"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_companyId_code_key" ON "Sector"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProductFamily_companyId_idx" ON "ProductFamily"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFamily_companyId_name_key" ON "ProductFamily"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFamily_companyId_code_key" ON "ProductFamily"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProductSubfamily_companyId_idx" ON "ProductSubfamily"("companyId");

-- CreateIndex
CREATE INDEX "ProductSubfamily_familyId_idx" ON "ProductSubfamily"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubfamily_familyId_name_key" ON "ProductSubfamily"("familyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubfamily_companyId_code_key" ON "ProductSubfamily"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProductSector_sectorId_idx" ON "ProductSector"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSector_productId_sectorId_key" ON "ProductSector"("productId", "sectorId");

-- CreateIndex
CREATE INDEX "ProductPackage_productId_isDefault_idx" ON "ProductPackage"("productId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPackage_productId_label_key" ON "ProductPackage"("productId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPackage_productId_barcode_key" ON "ProductPackage"("productId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPackage_productId_internalCode_key" ON "ProductPackage"("productId", "internalCode");

-- CreateIndex
CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");

-- CreateIndex
CREATE INDEX "InventoryItem_productPackageId_idx" ON "InventoryItem"("productPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_establishmentId_productId_productPackageId_key" ON "InventoryItem"("establishmentId", "productId", "productPackageId");

-- CreateIndex
CREATE INDEX "StockMovement_companyId_performedAt_idx" ON "StockMovement"("companyId", "performedAt");

-- CreateIndex
CREATE INDEX "StockMovement_establishmentId_performedAt_idx" ON "StockMovement"("establishmentId", "performedAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_performedAt_idx" ON "StockMovement"("productId", "performedAt");

-- CreateIndex
CREATE INDEX "StockMovement_productPackageId_performedAt_idx" ON "StockMovement"("productPackageId", "performedAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subfamilyId_fkey" FOREIGN KEY ("subfamilyId") REFERENCES "ProductSubfamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sector" ADD CONSTRAINT "Sector_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFamily" ADD CONSTRAINT "ProductFamily_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubfamily" ADD CONSTRAINT "ProductSubfamily_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubfamily" ADD CONSTRAINT "ProductSubfamily_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSector" ADD CONSTRAINT "ProductSector_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSector" ADD CONSTRAINT "ProductSector_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackage" ADD CONSTRAINT "ProductPackage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productPackageId_fkey" FOREIGN KEY ("productPackageId") REFERENCES "ProductPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productPackageId_fkey" FOREIGN KEY ("productPackageId") REFERENCES "ProductPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

