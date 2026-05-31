CREATE TABLE "AppCompanyRecord" (
  "id" INTEGER NOT NULL,
  "tradeName" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "cnpj" TEXT NOT NULL,
  "cep" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "complement" TEXT NOT NULL,
  "neighborhood" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppCompanyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppAccessProfileRecord" (
  "id" INTEGER NOT NULL,
  "companyId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "sectionAccess" JSONB NOT NULL,
  "catalogAccess" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppAccessProfileRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppUserRecord" (
  "id" INTEGER NOT NULL,
  "fullName" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "companyId" INTEGER,
  "companyIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sectionAccess" JSONB NOT NULL,
  "catalogAccess" JSONB NOT NULL,
  "accessProfileId" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppUserRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppStockModuleSettingsRecord" (
  "companyId" INTEGER NOT NULL,
  "inventorySummaryEditProfileIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "inventorySummaryDeleteProfileIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "closedInventoryReopenProfileIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "closedInventoryDeleteProfileIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppStockModuleSettingsRecord_pkey" PRIMARY KEY ("companyId")
);

CREATE UNIQUE INDEX "AppAccessProfileRecord_companyId_name_key" ON "AppAccessProfileRecord"("companyId", "name");
CREATE INDEX "AppAccessProfileRecord_companyId_idx" ON "AppAccessProfileRecord"("companyId");
CREATE UNIQUE INDEX "AppUserRecord_username_key" ON "AppUserRecord"("username");
CREATE INDEX "AppUserRecord_companyId_idx" ON "AppUserRecord"("companyId");
CREATE INDEX "AppUserRecord_accessProfileId_idx" ON "AppUserRecord"("accessProfileId");
