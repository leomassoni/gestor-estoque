CREATE TABLE "AppProductRecord" (
  "id" TEXT NOT NULL,
  "companyId" INTEGER NOT NULL,
  "companyProductId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "controlUnit" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "subfamily" TEXT NOT NULL,
  "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "alcoholPercentage" TEXT NOT NULL,
  "densitySampleVolume" TEXT NOT NULL,
  "densitySampleWeight" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "technicalSheetId" INTEGER,
  "packages" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppProductRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppServiceItemRecord" (
  "id" TEXT NOT NULL,
  "companyId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "companyProductId" TEXT NOT NULL,
  "manufacturerCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sizeValue" TEXT NOT NULL,
  "sizeUnit" TEXT NOT NULL,
  "emptyWeight" TEXT NOT NULL,
  "controlUnit" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "subfamily" TEXT NOT NULL,
  "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "imageDataUrl" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "packages" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppServiceItemRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppTechnicalSheetRecord" (
  "id" INTEGER NOT NULL,
  "companyId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "companyProductId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "subfamily" TEXT NOT NULL,
  "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "outputQuantity" TEXT NOT NULL,
  "outputUnit" TEXT NOT NULL,
  "densitySampleVolume" TEXT NOT NULL,
  "densitySampleWeight" TEXT NOT NULL,
  "targetPh" TEXT NOT NULL,
  "targetBrix" TEXT NOT NULL,
  "portionSize" TEXT NOT NULL,
  "colorTagOne" TEXT NOT NULL,
  "colorTagTwo" TEXT NOT NULL,
  "desiredCmvPercentage" TEXT NOT NULL,
  "dilutionRatePercentage" TEXT NOT NULL,
  "imageDataUrl" TEXT NOT NULL,
  "finalSalePrice" TEXT NOT NULL,
  "flavorSweet" TEXT NOT NULL,
  "flavorSour" TEXT NOT NULL,
  "flavorBitter" TEXT NOT NULL,
  "flavorSalty" TEXT NOT NULL,
  "flavorUmami" TEXT NOT NULL,
  "storytelling" TEXT NOT NULL,
  "preparationMode" TEXT NOT NULL,
  "shelfLifeRoom" TEXT NOT NULL,
  "shelfLifeRefrigerated" TEXT NOT NULL,
  "shelfLifeFrozen" TEXT NOT NULL,
  "productionCenters" JSONB NOT NULL,
  "ingredients" JSONB NOT NULL,
  "garnishIngredients" JSONB NOT NULL,
  "serviceItems" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppTechnicalSheetRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppProductRecord_companyId_idx" ON "AppProductRecord"("companyId");
CREATE INDEX "AppProductRecord_technicalSheetId_idx" ON "AppProductRecord"("technicalSheetId");
CREATE INDEX "AppServiceItemRecord_companyId_idx" ON "AppServiceItemRecord"("companyId");
CREATE INDEX "AppTechnicalSheetRecord_companyId_idx" ON "AppTechnicalSheetRecord"("companyId");
CREATE INDEX "AppTechnicalSheetRecord_productId_idx" ON "AppTechnicalSheetRecord"("productId");
