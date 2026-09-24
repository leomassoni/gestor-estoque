CREATE TABLE "AppSubscriptionPlanRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "fortnightlyPriceCents" INTEGER NOT NULL,
    "semiannualPriceCents" INTEGER NOT NULL,
    "annualPriceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSubscriptionPlanRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppCompanySubscriptionRecord" (
    "companyId" INTEGER NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LIFETIME_FREE',
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "basePriceCents" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "contractedPriceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "currentPeriodStartedAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "asaasCustomerId" TEXT NOT NULL DEFAULT '',
    "asaasSubscriptionId" TEXT NOT NULL DEFAULT '',
    "lastPaymentStatus" TEXT NOT NULL DEFAULT '',
    "lifetimeAccess" BOOLEAN NOT NULL DEFAULT false,
    "founderPromotion" BOOLEAN NOT NULL DEFAULT false,
    "feedbackParticipant" BOOLEAN NOT NULL DEFAULT false,
    "dataDeletionScheduledAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppCompanySubscriptionRecord_pkey" PRIMARY KEY ("companyId")
);

CREATE TABLE "AppBillingPaymentRecord" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ASAAS',
    "providerPaymentId" TEXT NOT NULL,
    "providerCustomerId" TEXT NOT NULL DEFAULT '',
    "providerSubscriptionId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "billingType" TEXT NOT NULL DEFAULT '',
    "valueCents" INTEGER NOT NULL DEFAULT 0,
    "netValueCents" INTEGER,
    "dueDate" TEXT NOT NULL DEFAULT '',
    "paidAt" TEXT NOT NULL DEFAULT '',
    "invoiceUrl" TEXT NOT NULL DEFAULT '',
    "externalReference" TEXT NOT NULL DEFAULT '',
    "raw" JSONB NOT NULL,
    "createdAtRecord" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppBillingPaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppBillingEventRecord" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ASAAS',
    "providerEventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "companyId" INTEGER,
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "providerSubscriptionId" TEXT NOT NULL DEFAULT '',
    "externalReference" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "raw" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppBillingEventRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppCompanySubscriptionRecord_planId_idx" ON "AppCompanySubscriptionRecord"("planId");
CREATE INDEX "AppCompanySubscriptionRecord_status_idx" ON "AppCompanySubscriptionRecord"("status");
CREATE INDEX "AppCompanySubscriptionRecord_asaasSubscriptionId_idx" ON "AppCompanySubscriptionRecord"("asaasSubscriptionId");

CREATE UNIQUE INDEX "AppBillingPaymentRecord_provider_providerPaymentId_key" ON "AppBillingPaymentRecord"("provider", "providerPaymentId");
CREATE INDEX "AppBillingPaymentRecord_companyId_idx" ON "AppBillingPaymentRecord"("companyId");
CREATE INDEX "AppBillingPaymentRecord_providerSubscriptionId_idx" ON "AppBillingPaymentRecord"("providerSubscriptionId");
CREATE INDEX "AppBillingPaymentRecord_status_idx" ON "AppBillingPaymentRecord"("status");

CREATE UNIQUE INDEX "AppBillingEventRecord_provider_providerEventKey_key" ON "AppBillingEventRecord"("provider", "providerEventKey");
CREATE INDEX "AppBillingEventRecord_companyId_idx" ON "AppBillingEventRecord"("companyId");
CREATE INDEX "AppBillingEventRecord_eventType_idx" ON "AppBillingEventRecord"("eventType");
CREATE INDEX "AppBillingEventRecord_providerPaymentId_idx" ON "AppBillingEventRecord"("providerPaymentId");
CREATE INDEX "AppBillingEventRecord_providerSubscriptionId_idx" ON "AppBillingEventRecord"("providerSubscriptionId");
