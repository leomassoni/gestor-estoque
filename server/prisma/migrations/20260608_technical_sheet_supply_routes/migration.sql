ALTER TABLE "AppTechnicalSheetRecord"
ADD COLUMN "supplyRoutes" JSONB NOT NULL DEFAULT '[]'::jsonb;
