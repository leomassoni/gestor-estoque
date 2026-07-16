export type ControlUnit = 'MILLILITER' | 'GRAM' | 'UNIT' | 'COMBO'
export type PackageUnit = 'LITER' | 'MILLILITER' | 'KILOGRAM' | 'GRAM' | 'UNIT'
export type ScreenMode = 'list' | 'form'
export type ProductAction = 'disable' | 'enable' | 'delete'
export type CompanyUserRole = 'Administrativo' | 'Gestor' | 'Colaborador'
export type AppSection =
  | 'Produtos'
  | 'Itens'
  | 'FichasTecnicas'
  | 'Receituarios'
  | 'Configuracoes'
  | 'CentrosEstoque'
  | 'Inventario'
  | 'Desperdicio'
  | 'ConfiguracoesEstoque'
  | 'Requisicoes'
  | 'Suprimentos'
  | 'EntradaProducoes'
  | 'RelatoriosEstoque'
  | 'Empresa'
  | 'Usuarios'
  | 'PainelMaster'
export type TechnicalSheetKind = 'PREPARO' | 'EXECUCAO' | 'VENDA'
export type ServiceItemKind = 'UTENSILIO_ELETRONICO' | 'RECIPIENTE_SERVICO'
export type ServiceItemSizeUnit = 'MILLILITER' | 'GRAM' | 'CENTIMETER'
export type TechnicalSheetSettingsTab = TechnicalSheetKind

export type UserSectionAccess = Record<AppSection, boolean>
export type RecipeExecutionBlockKey =
  | 'baseSummary'
  | 'yieldControls'
  | 'costMetrics'
  | 'productImage'
  | 'description'
  | 'serviceItems'
  | 'ingredients'
  | 'garnishes'
  | 'preparationMode'
  | 'flavorProfile'
  | 'storytelling'
  | 'salesArguments'
  | 'harmonization'
export type RecipePreparoHeroFieldKey =
  | 'family'
  | 'subfamily'
  | 'sectors'
  | 'baseYield'
  | 'recipeCount'
  | 'desiredYield'
export type RecipeExecutionHeroFieldKey =
  | 'family'
  | 'subfamily'
  | 'sectors'
  | 'baseYield'
  | 'recipeCount'
  | 'desiredYield'
  | 'finalYield'
  | 'finalAlcoholPercentage'
  | 'finalCmvPercentage'
  | 'finalSalePrice'
export type RecipePreparoIngredientColumnKey = 'ingredient' | 'input' | 'manipulated' | 'yield' | 'alcohol'
export type RecipeExecutionIngredientColumnKey = 'ingredient' | 'quantity' | 'alcohol'
export type RecipeExecutionGarnishColumnKey = 'garnish' | 'quantity' | 'alcohol'
export type RecipePreparoServiceItemColumnKey = 'serviceItem' | 'quantity' | 'family' | 'material' | 'size' | 'emptyWeight'
export type RecipeExecutionServiceItemColumnKey = 'serviceItem' | 'size'
export type RecipePanelAccess = {
  showPreparoTab: boolean
  showExecucaoTab: boolean
  executionBlocks: Record<RecipeExecutionBlockKey, boolean>
  preparoHeroFields: Record<RecipePreparoHeroFieldKey, boolean>
  executionHeroFields: Record<RecipeExecutionHeroFieldKey, boolean>
  preparoIngredientColumns: Record<RecipePreparoIngredientColumnKey, boolean>
  executionIngredientColumns: Record<RecipeExecutionIngredientColumnKey, boolean>
  executionGarnishColumns: Record<RecipeExecutionGarnishColumnKey, boolean>
  preparoServiceItemColumns: Record<RecipePreparoServiceItemColumnKey, boolean>
  executionServiceItemColumns: Record<RecipeExecutionServiceItemColumnKey, boolean>
}
export type UserCatalogAccess = {
  sectorsCreate: boolean
  sectorsDelete: boolean
  familiesCreate: boolean
  familiesDelete: boolean
  subfamiliesCreate: boolean
  subfamiliesDelete: boolean
  flavorProfilesCreate: boolean
  flavorProfilesDelete: boolean
  itemTypesCreate: boolean
  itemTypesDelete: boolean
  materialsCreate: boolean
  materialsDelete: boolean
}

export type UserCompanyMembershipRecord = {
  id: number
  companyId: number
  role: CompanyUserRole
  sectors: string[]
  sectionAccess: UserSectionAccess
  catalogAccess: UserCatalogAccess
  recipePanelAccess: RecipePanelAccess
  accessProfileId: number | null
  isActive: boolean
}

export type AppUserRecord = {
  id: number
  fullName: string
  username: string
  password: string
  role: CompanyUserRole
  companyId: number | null
  companyIds: number[]
  sectors: string[]
  sectionAccess: UserSectionAccess
  catalogAccess: UserCatalogAccess
  recipePanelAccess: RecipePanelAccess
  accessProfileId: number | null
  isActive: boolean
  memberships: UserCompanyMembershipRecord[]
}

export type Session =
  | {
      kind: 'systemAdmin'
      user: {
        username: string
        fullName: string
      }
    }
  | {
      kind: 'appUser'
      user: AppUserRecord
    }
  | null

export type CompanyRecord = {
  id: number
  tradeName: string
  legalName: string
  cnpj: string
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  status: 'ATIVA' | 'INATIVA'
  linkedCompanyIds: number[]
}

export type PackageForm = {
  id: number
  internalCode: string
  barcode: string
  packageQuantity: string
  packageUnit: PackageUnit
  grossWeightGrams: string
  packagingWeightGrams: string
  purchasePrice: string
  openingQuantity: string
  isActive: boolean
}

export type ProductRecord = {
  companyId: number
  ownerCompanyId: number
  id: string
  companyProductId: string
  name: string
  controlUnit: ControlUnit
  family: string
  subfamily: string
  sectors: string[]
  alcoholPercentage: string
  densitySampleVolume: string
  densitySampleWeight: string
  ignoreStock: boolean
  isActive: boolean
  packages: PackageForm[]
  technicalSheetId?: number
}

export type TechnicalSheetYieldDifferenceDestination = '' | 'WASTE' | 'BYPRODUCT'

export type ServiceItemRecord = {
  companyId: number
  id: string
  kind: ServiceItemKind
  companyProductId: string
  manufacturerCode: string
  name: string
  sizeValue: string
  sizeUnit: ServiceItemSizeUnit
  emptyWeight: string
  controlUnit: 'UNIT'
  family: string
  subfamily: string
  sectors: string[]
  imageDataUrl: string
  isActive: boolean
  packages: PackageForm[]
}

export type TechnicalSheetIngredient = {
  id: number
  productId: string
  productLabel: string
  quantity: string
  manipulatedQuantity: string
  yieldQuantity: string
  isActive: boolean
}

export type TechnicalSheetServiceItem = {
  id: number
  itemId: string
  itemLabel: string
  quantity: string
  isActive: boolean
}

export type FlavorProfileRecord = {
  id: string
  companyId: number
  name: string
  isActive: boolean
}

export type TechnicalSheetFlavorProfileRating = {
  flavorProfileId: string
  label: string
  value: string
}

export type TechnicalSheetProductionCenter = {
  stockCenterId: number
  minimumQuantity: string
}

export type TechnicalSheetSupplyRoute = {
  consumerCenterId: number
  supplierCenterId: number
}

export type TechnicalSheetRecord = {
  id: number
  companyId: number
  ownerCompanyId: number
  sharedCompanyIds: number[]
  kind: TechnicalSheetKind
  productId: string
  companyProductId: string
  name: string
  family: string
  subfamily: string
  sectors: string[]
  outputQuantity: string
  outputUnit: ControlUnit
  densitySampleVolume: string
  densitySampleWeight: string
  yieldDifferenceDestination: TechnicalSheetYieldDifferenceDestination
  yieldDifferenceByproductName: string
  yieldDifferenceByproductTechnicalSheetId: number | null
  targetPh: string
  targetBrix: string
  portionSize: string
  colorTagOne: string
  colorTagTwo: string
  desiredCmvPercentage: string
  dilutionRatePercentage: string
  imageDataUrl: string
  finalSalePrice: string
  flavorProfileRatings: TechnicalSheetFlavorProfileRating[]
  flavorSweet: string
  flavorSour: string
  flavorBitter: string
  flavorSalty: string
  flavorUmami: string
  storytelling: string
  salesArguments: string
  harmonization: string
  preparationMode: string
  preparationLeadTimeDays: string
  shelfLifeRoom: string
  shelfLifeRefrigerated: string
  shelfLifeFrozen: string
  productionCenters: TechnicalSheetProductionCenter[]
  supplyRoutes: TechnicalSheetSupplyRoute[]
  ingredients: TechnicalSheetIngredient[]
  garnishIngredients: TechnicalSheetIngredient[]
  serviceItems: TechnicalSheetServiceItem[]
  isActive: boolean
}

export type TechnicalSheetFormState = {
  kind: TechnicalSheetKind
  sharedCompanyIds: number[]
  companyProductId: string
  name: string
  family: string
  subfamily: string
  sectors: string[]
  outputQuantity: string
  outputUnit: ControlUnit
  densitySampleVolume: string
  densitySampleWeight: string
  yieldDifferenceDestination: TechnicalSheetYieldDifferenceDestination
  yieldDifferenceByproductName: string
  yieldDifferenceByproductTechnicalSheetId: number | null
  targetPh: string
  targetBrix: string
  portionSize: string
  colorTagOne: string
  colorTagTwo: string
  desiredCmvPercentage: string
  dilutionRatePercentage: string
  imageDataUrl: string
  finalSalePrice: string
  flavorProfileRatings: TechnicalSheetFlavorProfileRating[]
  flavorSweet: string
  flavorSour: string
  flavorBitter: string
  flavorSalty: string
  flavorUmami: string
  storytelling: string
  salesArguments: string
  harmonization: string
  preparationMode: string
  preparationLeadTimeDays: string
  shelfLifeRoom: string
  shelfLifeRefrigerated: string
  shelfLifeFrozen: string
  productionCenters: TechnicalSheetProductionCenter[]
  supplyRoutes: TechnicalSheetSupplyRoute[]
}

export type TechnicalSheetConfigurationFieldKey =
  | 'companyProductId'
  | 'sectors'
  | 'name'
  | 'family'
  | 'subfamily'
  | 'ingredients'
  | 'ingredientManipulatedQuantity'
  | 'outputQuantity'
  | 'outputUnit'
  | 'portionSize'
  | 'colorTagOne'
  | 'colorTagTwo'
  | 'productionCenters'
  | 'serviceItems'
  | 'densitySampleVolume'
  | 'densitySampleWeight'
  | 'targetPh'
  | 'targetBrix'
  | 'desiredCmvPercentage'
  | 'dilutionRatePercentage'
  | 'finalSalePrice'
  | 'imageDataUrl'
  | 'garnishIngredients'
  | 'flavorProfiles'
  | 'storytelling'
  | 'salesArguments'
  | 'harmonization'
  | 'preparationMode'
  | 'preparationLeadTimeDays'
  | 'shelfLifeRoom'
  | 'shelfLifeRefrigerated'
  | 'shelfLifeFrozen'

export type TechnicalSheetFieldConfiguration = {
  visible: boolean
  required: boolean
}

export type TechnicalSheetKindConfiguration = Record<TechnicalSheetConfigurationFieldKey, TechnicalSheetFieldConfiguration>
export type TechnicalSheetFormSettings = Record<TechnicalSheetKind, TechnicalSheetKindConfiguration>

export type TechnicalSheetSettingsRecord = {
  companyId: number
  settings: TechnicalSheetFormSettings
}

export type ProductFormState = {
  companyProductId: string
  name: string
  controlUnit: ControlUnit
  family: string
  subfamily: string
  sectors: string[]
  alcoholPercentage: string
  densitySampleVolume: string
  densitySampleWeight: string
  ignoreStock: boolean
}

export type ServiceItemFormState = {
  kind: ServiceItemKind
  companyProductId: string
  manufacturerCode: string
  name: string
  sizeValue: string
  sizeUnit: ServiceItemSizeUnit
  emptyWeight: string
  controlUnit: 'UNIT'
  family: string
  subfamily: string
  sectors: string[]
  imageDataUrl: string
}

export type ColumnKey =
  | 'product'
  | 'internalId'
  | 'companyId'
  | 'family'
  | 'subfamily'
  | 'sectors'
  | 'controlUnit'
  | 'unitCost'
  | 'costStatus'
  | 'packages'
  | 'status'

export type TechnicalSheetColumnKey =
  | 'product'
  | 'internalId'
  | 'kind'
  | 'companyId'
  | 'productionCenters'
  | 'costPerYield'
  | 'finalSalePrice'
  | 'linkedCompanies'
  | 'family'
  | 'subfamily'
  | 'sectors'
  | 'yield'
  | 'ingredients'
  | 'status'

export type ItemColumnKey =
  | 'item'
  | 'internalId'
  | 'companyId'
  | 'manufacturerCode'
  | 'kind'
  | 'family'
  | 'subfamily'
  | 'sizeCapacity'
  | 'sectors'
  | 'packages'
  | 'status'

export type SortDirection = 'asc' | 'desc'

export type ColumnSort<K extends string> = {
  key: K
  direction: SortDirection
}

export type SaveFeedback = {
  status: 'success' | 'error'
  title: string
  message: string
}

export type SaveProgressState = {
  title: string
  message: string
}

export type StockCountableKind = 'PREPARO' | 'PRODUTO' | 'ITEM'
export type WasteCountableKind = StockCountableKind | 'EXECUCAO'
export type SalesImportHistoryMode = 'ROLLING_MONTHS' | 'FULL_PERIOD' | 'SAME_PERIOD_LAST_YEAR'
export type SalesImportConsumptionMethod = 'SIMPLE_AVERAGE' | 'MEDIAN_DAILY'
export type SalesImportCoverageMode = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

export type StockCenterSalesImportSettings = {
  historyMode: SalesImportHistoryMode
  historyMonths: number
  coverageDays?: number
  coverageMode: SalesImportCoverageMode
  coverageWeekStartsOn: number
  safetyMarginPercent: string
  consumptionMethod: SalesImportConsumptionMethod
  mirrorDependentMinimums: boolean
  autoApplySuggestedMinimum: boolean
  allowManualMinimumOverride: boolean
  unmatchedRowPolicy: 'BLOCK' | 'SKIP'
  duplicateRowPolicy: 'BLOCK' | 'SKIP'
}

export type StockCenterMinimumStock = {
  kind: StockCountableKind
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  packageId: number | null
  minimumQuantity: string
  suggestedMinimumQuantity?: string
  minimumSource?: 'MANUAL' | 'SUGERIDO_VENDAS'
  realMinimumSource?: 'MANUAL' | 'SUGERIDO_VENDAS'
  suggestedContext?: 'CONSUMO_PROPRIO' | 'ESPELHO_ABASTECIMENTO'
  suggestedAt?: string
  overriddenAt?: string
}

export type StockCenterMinimumRow = {
  key: string
  kind: StockCountableKind
  name: string
  typeLabel: string
  family: string
  referenceLabel: string
  baseQuantity: number
  baseUnit: ControlUnit
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  packageId: number | null
}

export type StockCenterMinimumColumnKey = 'sheet' | 'type' | 'family' | 'reference' | 'yield' | 'minimum' | 'realMinimum' | 'consolidatedMinimum'
export type InventorySummaryColumnKey = 'date' | 'location' | 'product' | 'type' | 'recipient' | 'closed' | 'open' | 'total' | 'user'
export type ClosedInventoryColumnKey = 'id' | 'center' | 'date' | 'startedBy' | 'closedBy' | 'startedAt' | 'closedAt'
export type InventoryReviewColumnKey = 'product' | 'internalId' | 'companyId' | 'type' | 'family' | 'total' | 'unit' | 'status'
export type RequisitionDraftColumnKey = 'item' | 'type' | 'current' | 'minimum' | 'suggestion' | 'requested' | 'destination'
export type RequisitionFlowColumnKey = 'center' | 'status' | 'date' | 'items' | 'supply' | 'createdBy'
export type RequisitionHistoryColumnKey =
  | 'center'
  | 'status'
  | 'date'
  | 'sector'
  | 'items'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
  | 'destinations'
export type ReceiveReviewColumnKey = 'item' | 'type' | 'sent' | 'unit' | 'destination' | 'actions'
export type ProductionColumnKey = 'sheet' | 'priority' | 'current' | 'useMinimum' | 'realMinimum' | 'suggestion' | 'status'

export type StockCenterRecord = {
  id: number
  companyId: number
  name: string
  code: string
  sector: string
  userIds: number[]
  responsibleUserIds: number[]
  isProducer: boolean
  producedTechnicalSheetIds: number[]
  isDistributor: boolean
  distributesAllProducts: boolean
  distributedProductIds: string[]
  suppliedCenterIds: number[]
  minimumStocks: StockCenterMinimumStock[]
  salesImportSettings: StockCenterSalesImportSettings
  isActive: boolean
}

export type StockCenterFormState = {
  name: string
  code: string
  sector: string
  userIds: number[]
  responsibleUserIds: string[]
  isProducer: boolean
  producedTechnicalSheetIds: string[]
  isDistributor: boolean
  distributesAllProducts: boolean
  distributedProductIds: string[]
  suppliedCenterIds: string[]
  minimumStocks: StockCenterMinimumStock[]
  salesImportSettings: StockCenterSalesImportSettings
}

export type InventoryStorageLocationRecord = {
  companyId: number
  name: string
  isActive: boolean
}

export type InventoryRecord = {
  id: number
  companyId: number
  stockCenterId: number
  countedAt: string
  isClosed: boolean
  startedAt: string
  startedByUserId: number | null
  startedByUserName: string
  closedAt: string
  closedByUserId: number | null
  closedByUserName: string
  discardedOpenSessionCount: number
  appliedPendingMovementCount: number
}

export type InventoryActiveRecordLinkRecord = {
  companyId: number
  userKey: string
  inventoryId: number | null
}

export type InventoryCountSessionRecord = {
  id: number
  inventoryId: number | null
  companyId: number
  stockCenterId: number
  countedAt: string
  isClosed: boolean
  startedAt: string
  startedByUserId: number | null
  startedByUserName: string
  closedAt: string
  closedByUserId: number | null
  closedByUserName: string
}

export type InventoryActiveSessionLinkRecord = {
  companyId: number
  userKey: string
  sessionId: number | null
}

export type InventoryCountRecord = {
  id: number
  inventoryId: number | null
  sessionId: number
  companyId: number
  stockCenterId: number
  countedAt: string
  storageLocation: string
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  packageId: number | null
  technicalSheetName: string
  technicalSheetKind: StockCountableKind | 'VENDA'
  recipientItemId: string
  recipientLabel: string
  closedItemsQuantity: string
  hasOpenItems: boolean
  openItemsGrossWeight: string
  openItemsContainerQuantity: string
  openItemsNetQuantity: string
  totalCountedQuantity: string
  totalCountedUnit: 'MILLILITER' | 'GRAM' | 'UNIT'
  productionExpectedYield?: string
  productionFinalYield?: string
  productionYieldDifference?: string
  productionTargetPh?: string
  productionConfirmedPh?: string
  productionTargetBrix?: string
  productionConfirmedBrix?: string
  createdByUserId: number | null
  createdByUserName: string
}

export type WasteSessionRecord = {
  id: number
  companyId: number
  stockCenterId: number
  countedAt: string
  isClosed: boolean
  startedAt: string
  startedByUserId: number | null
  startedByUserName: string
  closedAt: string
  closedByUserId: number | null
  closedByUserName: string
}

export type WasteRecord = {
  id: number
  sessionId: number
  companyId: number
  stockCenterId: number
  countedAt: string
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  packageId: number | null
  technicalSheetName: string
  technicalSheetKind: StockCountableKind
  recipientItemId: string
  recipientLabel: string
  closedItemsQuantity: string
  hasOpenItems: boolean
  openItemsGrossWeight: string
  openItemsContainerQuantity: string
  openItemsNetQuantity: string
  totalCountedQuantity: string
  totalCountedUnit: 'MILLILITER' | 'GRAM' | 'UNIT'
  createdByUserId: number | null
  createdByUserName: string
}

export type PendingInventoryMovementRecord = {
  id: number
  companyId: number
  stockCenterId: number
  inventoryId: number
  createdAt: string
  createdByUserId: number | null
  createdByUserName: string
  description: string
  session: InventoryCountSessionRecord
  records: InventoryCountRecord[]
}

export type InventoryFormState = {
  stockCenterId: string
  countedAt: string
  storageLocation: string
  technicalSheetLabel: string
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  recipientLabel: string
  recipientItemId: string
  closedItemsQuantity: string
  hasOpenItems: '' | 'true' | 'false'
  openItemsGrossWeight: string
  openItemsContainerQuantity: string
}

export type InventoryContainerOption = {
  id: string
  label: string
  emptyWeight: number
  referenceQuantity: number
  packageId: number | null
  isFallbackOption: boolean
}

export type InventoryCountableItem = {
  key: string
  kind: StockCountableKind
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  companyProductId: string
  name: string
  family: string
  internalId: string
  controlUnit: Exclude<ControlUnit, 'COMBO'>
  baseQuantity: number
}

export type WasteCountableItem = {
  key: string
  kind: WasteCountableKind
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  companyProductId: string
  name: string
  family: string
  internalId: string
  controlUnit: Exclude<ControlUnit, 'COMBO'>
  baseQuantity: number
}

export type WasteMovementEntry = {
  kind: StockCountableKind
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  packageId: number | null
  technicalSheetName: string
  technicalSheetKind: StockCountableKind
  totalQuantity: number
  totalUnit: 'MILLILITER' | 'GRAM' | 'UNIT'
}

export type WasteHistoryRow = {
  key: string
  status: 'APLICADO' | 'PENDENTE'
  centerName: string
  countedAt: string
  createdAt: string
  createdByUserName: string
  locationLabel: string
  title: string
  itemCount: number
  records: InventoryCountRecord[]
}

export type RequisitionStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT_TO_SUPPLIES'
  | 'READY_TO_RECEIVE'
  | 'RECEIVED'
  | 'CANCELLED'

export type RequisitionLineRecord = {
  key: string
  kind: StockCountableKind
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  packageId: number | null
  itemName: string
  itemTypeLabel: string
  family: string
  suggestedQuantity: string
  requestedQuantity: string
  requestUnitLabel: string
  currentQuantity: string
  currentUnitLabel: string
  minimumDefinitionLabel: string
  destinationType: 'COMPRAS' | 'SUPRIMENTOS' | 'PRODUCOES'
  destinationCenterId: number | null
  destinationCenterName: string
  destinationLabel: string
  supplierCenterId?: number | null
  supplierCenterName?: string
  supplierCompanyId?: number | null
  supplierCompanyName?: string
  receiptStatus?: 'PENDING' | 'RECEIVED' | 'NOT_RECEIVED'
  receiptResolvedAt?: string
  receiptResolvedByUserId?: number | null
  receiptResolvedByUserName?: string
  receiptSessionId?: number | null
}

export type RequisitionRecord = {
  id: number
  companyId: number
  requisitionGroupId: number
  planningRootRequestId?: number | null
  planningSourceKind?: 'PREPARO' | 'EXECUCAO' | ''
  planningSourceCenterId?: number | null
  planningSourceCenterName?: string
  planningSourceSheetId?: number | null
  planningSourceSheetName?: string
  planningSourceQuantityLabel?: string
  stockCenterId: number
  stockCenterName: string
  supplyCenterId: number | null
  supplyCenterName: string
  supplyCompanyId: number | null
  supplyCompanyName: string
  sector: string
  countedAt: string
  status: RequisitionStatus
  editScope: 'FULL' | 'LINES_ONLY'
  lines: RequisitionLineRecord[]
  createdAt: string
  createdByUserId: number | null
  createdByUserName: string
  approvedAt: string
  approvedByUserId: number | null
  approvedByUserName: string
  sentAt: string
  sentByUserId: number | null
  sentByUserName: string
  preparedAt: string
  preparedByUserId: number | null
  preparedByUserName: string
  receivedAt: string
  receivedByUserId: number | null
  receivedByUserName: string
  lastUpdatedAt: string
  lastUpdatedByUserId: number | null
  lastUpdatedByUserName: string
}

export type RequisitionFormState = {
  stockCenterId: string
}

export type RequisitionDraftLine = RequisitionLineRecord

export type RequisitionNotificationRecord = {
  id: number
  companyId: number
  userId: number
  requisitionId: number
  message: string
  createdAt: string
  isRead: boolean
}

export type ProductionRequestRow = {
  sheetId: number
  centerId: number
  centerName: string
  sheetName: string
  internalId: string
  family: string
  currentQuantity: number
  currentQuantityLabel: string
  useMinimumQuantity: number
  useMinimumLabel: string
  realMinimumQuantity: number
  realMinimumLabel: string
  suggestedProductionQuantity: number
  suggestedProductionLabel: string
  baseUnitLabel: string
  priority: number
  statusLabel: string
  shortageLineCount: number
  shortageLines: RequisitionLineRecord[]
  dependencyRequests: Array<{ centerId: number; sheetId: number; desiredYield: number }>
  manualRequestIds: number[]
  cancellableManualRequestIds: number[]
}

export type ProductionDraftState = {
  draftId: number | null
  centerId: number
  sheetId: number
  startedAt: string
  startedByUserId: number | null
  startedByUserName: string
  desiredYield: string
  finalYield: string
  confirmedPh: string
  confirmedBrix: string
  ingredientOverrides: Record<number, string>
  manualOverrideIngredientIds: number[]
  consumptionSessionId?: number | null
  manualRequestIds?: number[]
}

export type ManualProductionRequestRecord = {
  id: number
  companyId: number
  centerId: number
  sheetId: number
  desiredYield: string
  createdAt: string
  createdByUserId: number | null
  createdByUserName: string
  rootRequestId: number
  parentRequestId: number | null
  isDependencyRequest: boolean
  planningSourceKind?: 'PREPARO' | 'EXECUCAO' | ''
  planningSourceCenterId?: number | null
  planningSourceCenterName?: string
  planningSourceSheetId?: number | null
  planningSourceSheetName?: string
  planningSourceQuantityLabel?: string
}

export type ExecutionProductionPlanningRow = {
  rootRequestId: number
  centerId: number
  centerName: string
  executionSheetId: number
  executionSheetName: string
  requestedQuantityLabel: string
  createdAt: string
  createdByUserName: string
  productionCount: number
  requisitionCount: number
  cancellableRequisitionCount: number
  movedRequisitionCount: number
}

export type ManualProductionPreviewProductionEntry = {
  centerId: number
  centerName: string
  sheetId: number
  sheetName: string
  desiredYield: number
  isDependencyRequest: boolean
}

export type ManualProductionPreviewShortageGroup = {
  centerId: number
  centerName: string
  lines: RequisitionLineRecord[]
}

export type ManualProductionPreviewState = {
  sourceKind: 'PREPARO' | 'EXECUCAO'
  centerId: number
  centerName: string
  sheetId: number
  sheetName: string
  desiredYield: number
  desiredYieldLabel: string
  plannedProductions: ManualProductionPreviewProductionEntry[]
  shortageGroups: ManualProductionPreviewShortageGroup[]
}

export type TechnicalSheetShareCascadePreviewState = {
  mode: 'share' | 'unshare'
  targetCompanyIds: number[]
  targetCompanyLabels: string[]
  dependencySheets: Array<{
    id: number
    name: string
    status: 'already_shared' | 'share_now' | 'candidate_unshare'
    targetCompanyLabels: string[]
    impactedMotherNames: string[]
    selectedForUnshare: boolean
  }>
}

export type TechnicalSheetCopyState = {
  sourceSheetId: number
  sourceSheetName: string
  sourceSheetKind: TechnicalSheetKind
  destinationCompanyId: number | null
  destinationCompanyInput: string
  newName: string
  errorMessage: string
}

export type TechnicalSheetCopyPreviewState = {
  sourceSheet: TechnicalSheetRecord
  targetCompanyId: number
  targetCompanyLabel: string
  newName: string
  dependencySheets: Array<{
    id: number
    name: string
    status: 'already_shared' | 'share_now'
    targetCompanyLabels: string[]
  }>
  willResetProductionCenters: boolean
}

export type TechnicalSheetDiscardTarget = 'technicalSheetForm' | 'technicalSheetProductModal' | 'technicalSheetServiceItemModal' | 'packageModal'

export type ManualSupplyDraftLine = {
  id: number
  itemKey: string
  quantity: string
}

export type ProductExportState = {
  format: 'pdf' | 'xlsx'
  includePackages: boolean
}

export type RecipeExportState = {
  format: 'pdf' | 'xlsx'
  scope: 'current' | 'all'
}

export type TechnicalSheetExportState = {
  kind: TechnicalSheetKind
  format: 'pdf' | 'xlsx'
  scope: 'current' | 'all'
  technicalSheetId: number | null
}

export type RequisitionExportState = {
  requisitionId: number
  format: 'pdf' | 'xlsx'
}

export type StockReportExportState = {
  format: 'pdf' | 'xlsx'
}

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AuditResult = 'SUCCESS' | 'WARNING' | 'ERROR'
export type AuditActorKind = 'SYSTEM_ADMIN' | 'APP_USER' | 'SYSTEM'
export type AuditPanelTab = 'AUDITORIA' | 'ALERTAS' | 'IMPACTOS'

export type AuditLogRecord = {
  id: number
  companyId: number
  actorUserId: number | null
  actorUserName: string
  actorUsername: string
  actorRole: string
  actorKind: AuditActorKind
  module: string
  actionKey: string
  actionLabel: string
  targetType: string
  targetId: string
  targetLabel: string
  summary: string
  impactSummary: string
  severity: AuditSeverity
  result: AuditResult
  relatedCompanyIds: number[]
  details: Record<string, unknown>
  occurredAt: string
}

export type StockReportTab =
  | 'POSICAO'
  | 'MOVIMENTACOES'
  | 'DESPERDICIO_CONSOLIDADO'
  | 'DESPERDICIO_LANCAMENTOS'
  | 'VENDAS_IMPORTADAS'
  | 'VENDAS_IMPORTADAS_AUDITORIA'
  | 'SUGESTAO_MINIMO'
  | 'INVENTARIOS'
  | 'INVENTARIO_PRODUTOS'
  | 'MINIMOS'
  | 'VARIACAO'
  | 'DIVERGENCIA'
  | 'VALORIZACAO'
  | 'REQUISICOES'
  | 'TRANSFERENCIAS'
  | 'PRODUCOES'
  | 'OCORRENCIAS'
  | 'PRODUTIVIDADE'
  | 'MINIMO_REAL'
  | 'DEPENDENCIAS'
  | 'COBERTURA'
  | 'COMPROMETIDO'
export type StockPositionReportScope = 'GLOBAL' | 'CENTROS'
export type StockReportColumnKey =
  | 'main'
  | 'internalId'
  | 'companyId'
  | 'packageId'
  | 'kind'
  | 'family'
  | 'center'
  | 'date'
  | 'status'
  | 'operation'
  | 'recorded'
  | 'quantity'
  | 'yieldExpected'
  | 'yieldDifference'
  | 'ph'
  | 'brix'
  | 'position'
  | 'minimum'
  | 'unitCost'
  | 'totalCost'
  | 'unit'
  | 'user'

export type StockReportRow = {
  id: string
  sessionId?: number
  inventoryId?: number
  main: string
  secondary: string
  internalId: string
  companyId: string
  packageId: string
  kind: string
  family: string
  center: string
  date: string
  status: string
  operation?: string
  recorded?: string
  quantity: string
  yieldExpected?: string
  yieldDifference?: string
  ph?: string
  brix?: string
  position?: string
  minimum?: string
  unitCost?: string
  totalCost?: string
  unit: string
  user: string
  sortValues?: Partial<Record<StockReportColumnKey, string | number>>
}

export type StockReportAggregationMetadata = {
  main: string
  secondary: string
  internalId: string
  companyId: string
  kind: string
  family: string
  unit: string
}

export type SavedStockReportModel = {
  id: number
  companyId: number
  userId: number | null
  name: string
  baseTab: StockReportTab
  columnVisibility: Record<StockReportColumnKey, boolean>
  columnOrder: StockReportColumnKey[]
  columnSort: ColumnSort<StockReportColumnKey> | null
  centerScope: StockPositionReportScope
  centerNames: string[]
  createdAt: string
  updatedAt: string
}

export type StockReportBuilderFormState = {
  id: number | null
  name: string
  baseTab: StockReportTab
  selectedColumns: StockReportColumnKey[]
  columnSortKey: StockReportColumnKey | ''
  columnSortDirection: 'asc' | 'desc'
  centerScope: StockPositionReportScope
  centerNames: string[]
}

export type RecipeExportRenderState = {
  recipes: RecipePanelComputedData[]
  tab: RecipePanelTab
  scope: RecipeExportState['scope']
}

export type ServiceItemActionState = {
  action: ProductAction
  itemId: string
}

export type TechnicalSheetDraftState = {
  form: TechnicalSheetFormState
  draftProductId: string
  outputQuantityMode: 'auto' | 'manual'
  sectorInput: string
  sharedCompanyInput: string
  productionCenterInput: string
  ingredients: TechnicalSheetIngredient[]
  editingIngredientId: number | null
  garnishIngredients: TechnicalSheetIngredient[]
  editingGarnishIngredientId: number | null
  serviceItems: TechnicalSheetServiceItem[]
  editingServiceItemId: number | null
  packages: PackageForm[]
  editingId: number | null
  pendingIngredientId: number | null
  pendingGarnishIngredientId: number | null
  pendingServiceItemId: number | null
}

export type TechnicalSheetIngredientMetrics = {
  ingredientId: number
  costPerUnit: number
  inputQuantity: number
  manipulatedQuantity: number
  yieldQuantity: number
  recipeCost: number
  lossQuantity: number
  lossCost: number
  alcoholPercentage: number
  productUnitLabel: string
}

export type TechnicalSheetTotals = {
  totalRecipeCost: number
  totalInputQuantity: number
  suggestedYield: number
  totalYield: number
  yieldDifferenceQuantity: number
  finalAlcoholPercentage: number
  portionsYield: number
  costPerPortion: number
  portionSize: number
  suggestedSalePrice: number
  desiredCmvPercentage: number
  finalSalePrice: number
  finalCmvPercentage: number
}

export type RecipePanelTab = 'PREPARO' | 'EXECUCAO'

export type RecipePanelIngredientMetrics = {
  id: number
  productId: string
  label: string
  unitLabel: string
  inputQuantity: number
  manipulatedQuantity: number
  yieldQuantity: number
  scaledInputQuantity: number
  scaledManipulatedQuantity: number
  scaledYieldQuantity: number
  costPerUnit: number
  scaledCost: number
  lossQuantity: number
  lossCost: number
  alcoholPercentage: number
}

export type RecipePanelServiceItemMetrics = {
  id: number
  itemId: string
  label: string
  quantity: number
  scaledQuantity: number
  family: string
  subfamily: string
  sizeLabel: string
  emptyWeight: string
  imageDataUrl: string
}

export type RecipePanelComputedData = {
  sheet: TechnicalSheetRecord
  baseYield: number
  desiredYield: number
  recipeCount: number
  multiplier: number
  ingredientMetrics: RecipePanelIngredientMetrics[]
  garnishMetrics: RecipePanelIngredientMetrics[]
  serviceItemMetrics: RecipePanelServiceItemMetrics[]
  totalRecipeCost: number
  finalAlcoholPercentage: number
  portionSize: number
  portionsYield: number
  costPerPortion: number
  desiredCmvPercentage: number
  suggestedSalePrice: number
  finalSalePrice: number
  finalCmvPercentage: number
}

export type TechnicalSheetExportRenderState = {
  technicalSheets: RecipePanelComputedData[]
  kind: TechnicalSheetKind
  scope: TechnicalSheetExportState['scope']
}

export type PreparationModeMetricPart =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'ingredient'
      text: string
      quantityLabel: string
    }

export type TechnicalSheetDescriptionNode = {
  label: string
  preparationId: number | null
  children: TechnicalSheetDescriptionNode[]
}

export type TechnicalSheetGeneratedDescription = {
  summary: string
  mainIngredients: TechnicalSheetDescriptionNode[]
  finalization: TechnicalSheetDescriptionNode[]
  hasContent: boolean
}

export type SectorHideState = {
  sector: string
  impactedProducts: string[]
  impactedUsers: string[]
  orphanProducts: string[]
  orphanUsers: string[]
  resolution: 'replace' | 'inactivate'
  replacementSector: string
}

export type TaxonomyDeleteKind =
  | 'productFamily'
  | 'productSubfamily'
  | 'serviceItemFamily'
  | 'serviceItemSubfamily'

export type TaxonomyDeleteState = {
  kind: TaxonomyDeleteKind
  value: string
  impactedProducts: string[]
  impactedTechnicalSheets: string[]
  impactedServiceItems: string[]
  resolution: 'replace' | 'inactivate'
  replacementValue: string
}

export type InventoryStorageLocationDeleteState = {
  location: string
  impactedCounts: string[]
  resolution: 'replace' | 'inactivate'
  replacementLocation: string
}

export type InventoryCountDeleteState = {
  id: number
  countedAt: string
  technicalSheetName: string
  storageLocation: string
  bypassOwnership: boolean
}

export type InventorySessionCloseState = {
  id: number
  countedAt: string
  stockCenterName: string
}

export type InventoryCloseState = {
  id: number
  countedAt: string
  stockCenterName: string
}

export type InventoryLeaveState = {
  id: number
  countedAt: string
  stockCenterName: string
}

export type InventoryDeleteState = {
  id: number
  countedAt: string
  stockCenterName: string
}

export type InventorySessionDeleteState = {
  id: number
  countedAt: string
  stockCenterName: string
}

export type InventoryReviewModalState = {
  id: number
  countedAt: string
  stockCenterName: string
}

export type ClosedInventorySummaryModalState = {
  id: number
  countedAt: string
  stockCenterName: string
  startedAt: string
  startedByUserName: string
  closedAt: string
  closedByUserName: string
  readOnly: boolean
}

export type InventoryCountHistoryModalState = {
  id: number
  countedAt: string
  stockCenterName: string
  isClosed: boolean
}

export type InventoryReviewRow = {
  key: string
  name: string
  internalId: string
  companyProductId: string
  kindLabel: string
  family: string
  totalCountedQuantity: number
  totalCountedLabel: string
  unitLabel: string
  statusLabel: string
  isZero: boolean
}

export type InventoryCountHistoryDraft = {
  storageLocation: string
  recipientItemId: string
  closedItemsQuantity: string
  hasOpenItems: 'true' | 'false'
  openItemsGrossWeight: string
  openItemsContainerQuantity: string
}

export type InventoryCountHistoryDisplayRow = {
  rowKey: string
  record: InventoryCountRecord | null
  stockRow: StockCenterMinimumRow | null
  name: string
  kind: StockCountableKind
  family: string
  baseUnit: ControlUnit
}

export type StockModuleSettingsRecord = {
  companyId: number
  inventorySummaryEditProfileIds: number[]
  inventorySummaryDeleteProfileIds: number[]
  closedInventoryReopenProfileIds: number[]
  closedInventoryDeleteProfileIds: number[]
  salesImportDefaultHistoryMode: 'ROLLING_MONTHS' | 'FULL_PERIOD' | 'SAME_PERIOD_LAST_YEAR'
  salesImportDefaultHistoryMonths: number
  salesImportDefaultCoverageDays: number
  salesImportDefaultSafetyMarginPercent: string
  salesImportAutoApplySuggestedMinimum: boolean
  salesImportAllowManualMinimumOverride: boolean
  salesImportUnmatchedRowPolicy: 'BLOCK' | 'SKIP'
  salesImportDuplicateRowPolicy: 'BLOCK' | 'SKIP'
  legacyInventorySummaryEditRoles?: CompanyUserRole[]
  legacyInventorySummaryDeleteRoles?: CompanyUserRole[]
  legacyClosedInventoryReopenRoles?: CompanyUserRole[]
  legacyClosedInventoryDeleteRoles?: CompanyUserRole[]
}

export type SalesImportTemplateRecord = {
  id: number
  companyId: number
  stockCenterId: number | null
  name: string
  sheetName: string
  headerRow: number
  dataStartRow: number
  dateMode: 'COLUMN' | 'FIXED_CELL'
  dateColumn: string
  dateCell: string
  codeColumn: string
  quantityColumn: string
  isActive: boolean
}

export type SalesImportWorkbookCell = string | number | boolean | Date | null

export type SalesImportWorkbookSheet = {
  name: string
  rows: SalesImportWorkbookCell[][]
}

export type SalesImportBatchRecord = {
  id: number
  companyId: number
  stockCenterId: number
  templateId: number | null
  uploadedByUserId: number | null
  uploadedByUserName: string
  fileName: string
  historyMode: 'ROLLING_MONTHS' | 'FULL_PERIOD' | 'SAME_PERIOD_LAST_YEAR'
  historyMonths: number | null
  coverageDays: number
  coverageMode?: SalesImportCoverageMode
  coverageWeekStartsOn?: number
  safetyMarginPercent: string
  postingMode: 'ANALYTICAL_ONLY' | 'POST_PENDING' | 'POST_IMMEDIATE'
  status: 'DRAFT' | 'IMPORTED' | 'READY_TO_POST' | 'POST_QUEUED' | 'POSTED' | 'CANCELLED'
  importedAt: string
  summary: Record<string, unknown>
}

export type SalesImportRowRecord = {
  id: number
  batchId: number
  companyId: number
  stockCenterId: number
  sourceRowKey: string
  consumedAt: string
  companyProductId: string
  quantity: string
  matchedTechnicalSheetId: number | null
  matchedKind: '' | 'EXECUCAO' | 'VENDA'
  status: 'MATCHED' | 'UNMATCHED' | 'ERROR'
  errorMessage: string
}

export type SalesImportPreviewRow = {
  sourceRowKey: string
  consumedAt: string
  companyProductId: string
  quantity: string
  matchedTechnicalSheetId: number | null
  matchedKind: '' | 'EXECUCAO' | 'VENDA'
  status: 'MATCHED' | 'UNMATCHED' | 'ERROR'
  errorMessage: string
}

export type SalesConsumptionRecord = {
  id: number
  companyId: number
  stockCenterId: number
  consumedAt: string
  sourceBatchId: number
  sourceTechnicalSheetId: number
  sourceTechnicalSheetKind: 'EXECUCAO' | 'VENDA'
  ingredientProductId: string
  quantityConsumed: string
  unit: string
  stockPostingStatus: 'ANALYTICAL' | 'PENDING' | 'POSTED' | 'CANCELLED'
  stockMovementId: number | null
  postedAt: string
}

export type SalesImportResolvableRow = Pick<SalesImportPreviewRow, 'sourceRowKey' | 'consumedAt' | 'companyProductId' | 'quantity'>

export type ProductActionState = {
  action: ProductAction
  productId: string
}

export type TechnicalSheetActionState = {
  action: ProductAction
  technicalSheetId: number
}

export type ProductDisableImpactState = {
  productId: string
  productName: string
  linkedTechnicalSheetName: string | null
  impactedSheets: Array<{
    id: number
    name: string
    selectedForRemoval: boolean
  }>
  impactedStockCenters: string[]
}

export type TechnicalSheetDisableImpactState = {
  technicalSheetId: number
  technicalSheetName: string
  linkedProductName: string | null
  impactedMotherSheets: Array<{
    id: number
    name: string
    selectedForRemoval: boolean
    impactedSharedCompanyLabels: string[]
  }>
  impactedStockCenters: string[]
}

export type PackageEditorContext = 'product' | 'technicalSheet' | 'serviceItem'

export type CompanyFormState = {
  tradeName: string
  legalName: string
  cnpj: string
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  linkedCompanyIds: number[]
}

export type UserFormState = {
  fullName: string
  username: string
  password: string
  role: CompanyUserRole
  companyIds: number[]
  sectors: string[]
  sectionAccess: UserSectionAccess
  catalogAccess: UserCatalogAccess
  recipePanelAccess: RecipePanelAccess
  accessProfileId: string
  memberships: Array<{
    companyId: number
    accessProfileId: string
    role: CompanyUserRole
    sectors: string[]
    sectionAccess: UserSectionAccess
    catalogAccess: UserCatalogAccess
    recipePanelAccess: RecipePanelAccess
    isActive: boolean
  }>
}

export type AccessProfileRecord = {
  id: number
  companyId: number
  name: string
  role: CompanyUserRole
  sectionAccess: UserSectionAccess
  catalogAccess: UserCatalogAccess
  recipePanelAccess: RecipePanelAccess
  isActive: boolean
}

export type AccessProfileFormState = {
  name: string
  sectionAccess: UserSectionAccess
  catalogAccess: UserCatalogAccess
  recipePanelAccess: RecipePanelAccess
  stockPermissions: {
    inventorySummaryEdit: boolean
    inventorySummaryDelete: boolean
    closedInventoryReopen: boolean
    closedInventoryDelete: boolean
  }
}

export type UserPanelTab = 'users' | 'profiles'

export type PreparationModeInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ingredientNames: string[]
}
