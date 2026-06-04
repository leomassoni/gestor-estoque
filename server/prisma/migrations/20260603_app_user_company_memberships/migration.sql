CREATE TABLE "AppUserCompanyMembershipRecord" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "sectors" TEXT[],
    "sectionAccess" JSONB NOT NULL,
    "catalogAccess" JSONB NOT NULL,
    "accessProfileId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUserCompanyMembershipRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppUserCompanyMembershipRecord_userId_companyId_key"
  ON "AppUserCompanyMembershipRecord"("userId", "companyId");

CREATE INDEX "AppUserCompanyMembershipRecord_companyId_idx"
  ON "AppUserCompanyMembershipRecord"("companyId");

CREATE INDEX "AppUserCompanyMembershipRecord_accessProfileId_idx"
  ON "AppUserCompanyMembershipRecord"("accessProfileId");

ALTER TABLE "AppUserCompanyMembershipRecord"
  ADD CONSTRAINT "AppUserCompanyMembershipRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "AppUserRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
