CREATE TABLE "AppFlavorProfileRecord" (
  "id" TEXT NOT NULL,
  "companyId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppFlavorProfileRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppFlavorProfileRecord_companyId_idx" ON "AppFlavorProfileRecord"("companyId");

ALTER TABLE "AppTechnicalSheetRecord"
ADD COLUMN "flavorProfileRatings" JSONB NOT NULL DEFAULT '[]';
