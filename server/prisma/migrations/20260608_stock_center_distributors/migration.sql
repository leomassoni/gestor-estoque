ALTER TABLE "AppStockCenterRecord"
ADD COLUMN "isDistributor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "distributesAllProducts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "distributedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "suppliedCenterIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
