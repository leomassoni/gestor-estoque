CREATE TABLE "AppSalesPostingSettingsRecord" (
    "stockCenterId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "policies" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSalesPostingSettingsRecord_pkey" PRIMARY KEY ("stockCenterId")
);
CREATE INDEX "AppSalesPostingSettingsRecord_companyId_idx" ON "AppSalesPostingSettingsRecord"("companyId");

CREATE TABLE "AppSalesPostingOperationRecord" (
    "id" TEXT NOT NULL,
    "batchId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "stockCenterId" INTEGER NOT NULL,
    "engine" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "originalDemands" JSONB NOT NULL,
    "residual" JSONB NOT NULL,
    "allocations" JSONB NOT NULL,
    "covered" JSONB NOT NULL,
    "receipts" JSONB NOT NULL,
    "timing" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSalesPostingOperationRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppSalesPostingOperationRecord_batchId_key" ON "AppSalesPostingOperationRecord"("batchId");
CREATE INDEX "AppSalesPostingOperationRecord_companyId_stockCenterId_status_idx" ON "AppSalesPostingOperationRecord"("companyId", "stockCenterId", "status");

-- Coordinate every stock writer, including legacy CRUD, with the existing production transaction lock.
-- The lock lives only until commit; no browser session or counting session is locked.
CREATE FUNCTION gestor_lock_stock_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(194619801);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'AppInventoryRecord', 'AppInventoryCountSessionRecord', 'AppInventoryCountRecord',
    'AppPendingInventoryMovementRecord', 'AppTechnicalSheetRecord', 'AppProductRecord',
    'AppStockCenterRecord', 'AppSalesImportBatchRecord', 'AppSalesImportRowRecord',
    'AppSalesConsumptionRecord', 'AppSalesPostingSettingsRecord'
  ] LOOP
    EXECUTE format('CREATE TRIGGER gestor_stock_write_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION gestor_lock_stock_write()', table_name);
  END LOOP;
END;
$$;
