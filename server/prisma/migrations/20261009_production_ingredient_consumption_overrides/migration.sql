ALTER TABLE "AppProductionDraftRecord"
ADD COLUMN "ingredientConsumptionOverrides" JSONB NOT NULL DEFAULT '{}'::jsonb;
