ALTER TABLE "AppAccessProfileRecord"
ADD COLUMN "recipePanelAccess" JSONB NOT NULL DEFAULT '{"showPreparoTab": true, "showExecucaoTab": true, "executionBlocks": {"baseSummary": true, "yieldControls": true, "costMetrics": true, "productImage": true, "description": true, "serviceItems": true, "ingredients": true, "garnishes": true, "preparationMode": true, "flavorProfile": true, "storytelling": true, "salesArguments": true, "harmonization": true}}'::jsonb;

ALTER TABLE "AppUserRecord"
ADD COLUMN "recipePanelAccess" JSONB NOT NULL DEFAULT '{"showPreparoTab": true, "showExecucaoTab": true, "executionBlocks": {"baseSummary": true, "yieldControls": true, "costMetrics": true, "productImage": true, "description": true, "serviceItems": true, "ingredients": true, "garnishes": true, "preparationMode": true, "flavorProfile": true, "storytelling": true, "salesArguments": true, "harmonization": true}}'::jsonb;

ALTER TABLE "AppUserCompanyMembershipRecord"
ADD COLUMN "recipePanelAccess" JSONB NOT NULL DEFAULT '{"showPreparoTab": true, "showExecucaoTab": true, "executionBlocks": {"baseSummary": true, "yieldControls": true, "costMetrics": true, "productImage": true, "description": true, "serviceItems": true, "ingredients": true, "garnishes": true, "preparationMode": true, "flavorProfile": true, "storytelling": true, "salesArguments": true, "harmonization": true}}'::jsonb;
