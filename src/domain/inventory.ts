import type {
  AppUserRecord,
  ControlUnit,
  InventoryContainerOption,
  InventoryCountRecord,
  InventoryCountSessionRecord,
  InventoryCountableItem,
  InventoryRecord,
  PackageForm,
  ProductRecord,
  ServiceItemRecord,
  StockCenterMinimumColumnKey,
  StockCenterMinimumRow,
  StockCenterMinimumStock,
  StockCountableKind,
  StockReportRow,
  TechnicalSheetRecord,
  WasteCountableItem,
  WasteCountableKind,
  WasteSessionRecord,
} from '../types/domain'
import {
  formatControlUnitShort,
  formatCurrencyLabel,
  formatDecimal,
  normalizeRegistrationText,
  parseDecimal,
} from '../utils/core'
import {
  calculateNormalizedPackageQuantity,
  calculatePackagingWeight,
  getInventoryClosedItemReferenceQuantity,
  getStockCenterBaseQuantity,
  getTechnicalSheetBaseYield,
} from './technicalSheets'

export function canManageInventoryCountRecord(
  record: InventoryCountRecord,
  currentAppUser: AppUserRecord | null,
  canDeleteRecords: boolean,
  inventoryCountSessionById: Map<number, InventoryCountSessionRecord>,
  inventoryRecordById: Map<number, InventoryRecord>,
) {
  const sessionRecord = inventoryCountSessionById.get(record.sessionId) ?? null
  if (sessionRecord?.isClosed) {
    const inventoryRecord = sessionRecord.inventoryId !== null ? inventoryRecordById.get(sessionRecord.inventoryId) ?? null : null
    if (inventoryRecord?.isClosed || !inventoryRecord) {
      return false
    }
  }

  if (canDeleteRecords) {
    return true
  }

  if (!currentAppUser) {
    return false
  }

  return record.createdByUserId === currentAppUser.id
}

export function canManageInventoryCountHistoryRecord(
  record: InventoryCountRecord,
  currentAppUser: AppUserRecord | null,
  canDeleteRecords: boolean,
) {
  if (canDeleteRecords) {
    return true
  }

  if (!currentAppUser) {
    return false
  }

  return record.createdByUserId === currentAppUser.id
}

export function canManageInventoryCountSessionRecord(
  sessionRecord: InventoryCountSessionRecord,
  currentAppUser: AppUserRecord | null,
  canDeleteRecords: boolean,
) {
  if (canDeleteRecords) {
    return true
  }

  if (!currentAppUser) {
    return false
  }

  return sessionRecord.startedByUserId === currentAppUser.id
}

export function canManageWasteSessionRecord(
  sessionRecord: WasteSessionRecord,
  currentAppUser: AppUserRecord | null,
  canDeleteRecords: boolean,
) {
  if (canDeleteRecords) {
    return true
  }

  if (!currentAppUser) {
    return false
  }

  return sessionRecord.startedByUserId === currentAppUser.id
}

export function canManageInventoryRecord(
  inventoryRecord: InventoryRecord,
  currentAppUser: AppUserRecord | null,
  canDeleteRecords: boolean,
) {
  if (canDeleteRecords) {
    return true
  }

  if (!currentAppUser) {
    return false
  }

  return inventoryRecord.startedByUserId === currentAppUser.id
}

export function getStockCountableKindLabel(kind: StockCountableKind | 'VENDA') {
  switch (kind) {
    case 'PREPARO':
      return 'Pre-preparo'
    case 'PRODUTO':
      return 'Produto'
    case 'ITEM':
      return 'Item'
    case 'VENDA':
      return 'Venda'
  }
}

export function getWasteCountableKindLabel(kind: WasteCountableKind) {
  if (kind === 'EXECUCAO') {
    return 'Execucao'
  }

  return getStockCountableKindLabel(kind)
}

export function buildStockCenterMinimumEntryKey(entry: {
  kind: StockCountableKind
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
  packageId: number | null
}) {
  if (entry.kind === 'PREPARO') {
    return `PREPARO:${entry.technicalSheetId ?? ''}`
  }

  if (entry.kind === 'PRODUTO') {
    return `PRODUTO:${entry.productId}:${entry.packageId ?? ''}`
  }

  return `ITEM:${entry.serviceItemId}`
}

export function buildInventoryCountableItemKey(item: {
  kind: StockCountableKind
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
}) {
  if (item.kind === 'PREPARO') {
    return `PREPARO:${item.technicalSheetId ?? ''}`
  }

  if (item.kind === 'PRODUTO') {
    return `PRODUTO:${item.productId}`
  }

  return `ITEM:${item.serviceItemId}`
}

export function buildWasteCountableItemKey(item: {
  kind: WasteCountableKind
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
}) {
  if (item.kind === 'EXECUCAO') {
    return `EXECUCAO:${item.technicalSheetId ?? ''}`
  }

  return buildInventoryCountableItemKey({
    kind: item.kind,
    technicalSheetId: item.technicalSheetId,
    productId: item.productId,
    serviceItemId: item.serviceItemId,
  })
}

export function mapWasteCountableItemToInventoryCountableItem(
  item: WasteCountableItem | null,
): InventoryCountableItem | null {
  if (!item || item.kind === 'EXECUCAO') {
    return null
  }

  return {
    key: item.key,
    kind: item.kind,
    technicalSheetId: item.technicalSheetId,
    productId: item.productId,
    serviceItemId: item.serviceItemId,
    companyProductId: item.companyProductId,
    name: item.name,
    family: item.family,
    internalId: item.internalId,
    controlUnit: item.controlUnit,
    baseQuantity: item.baseQuantity,
  }
}

export function getProductDensityFactor(product: ProductRecord) {
  const volume = parseDecimal(product.densitySampleVolume)
  const weight = parseDecimal(product.densitySampleWeight)
  if (volume && volume > 0 && weight && weight > 0) {
    return weight / volume
  }

  return 1
}

export function buildProductPackageLabel(product: ProductRecord, packageForm: PackageForm) {
  const quantity = calculateNormalizedPackageQuantity(packageForm, product.controlUnit)
  const quantityLabel =
    quantity > 0 ? `${formatDecimal(quantity)} ${formatControlUnitShort(product.controlUnit)}` : 'SEM QUANTIDADE'
  return `${packageForm.internalCode || `EMB-${packageForm.id}`} • ${quantityLabel}`
}

export function expandStockReportRowsByProductPackages(
  baseRow: StockReportRow,
  product: ProductRecord,
  baseQuantity: number,
  options: {
    minimumQuantity?: number
    positionQuantity?: number
    recordedQuantity?: number
    unitCost?: number
  } = {},
) {
  const { minimumQuantity, positionQuantity, recordedQuantity, unitCost = 0 } = options
  const activePackages = product.packages.filter((packageForm) => packageForm.isActive)
  if (activePackages.length === 0) {
    return [baseRow]
  }

  const baseUnitLabel = formatControlUnitShort(product.controlUnit)
  const expandedRows = activePackages.reduce<StockReportRow[]>((rows, packageForm) => {
      const packageQuantity = calculateNormalizedPackageQuantity(packageForm, product.controlUnit)
      if (packageQuantity <= 0) {
        return rows
      }

      const packageEquivalent = baseQuantity / packageQuantity
      const packageIdentifier = packageForm.internalCode || `EMB-${packageForm.id}`
      const packageUnitCost = unitCost * packageQuantity
      const packageTotalCost = unitCost * baseQuantity

      rows.push({
        ...baseRow,
        id: `${baseRow.id}-pkg-${packageForm.id}`,
        secondary: [baseRow.secondary, packageIdentifier].filter(Boolean).join(' • '),
        packageId: packageIdentifier,
        recorded: typeof recordedQuantity === 'number' ? formatDecimal(recordedQuantity / packageQuantity) : baseRow.recorded,
        quantity: formatDecimal(packageEquivalent),
        position: typeof positionQuantity === 'number' ? formatDecimal(positionQuantity / packageQuantity) : baseRow.position,
        minimum: typeof minimumQuantity === 'number' ? formatDecimal(minimumQuantity / packageQuantity) : baseRow.minimum,
        unitCost: formatCurrencyLabel(packageUnitCost),
        totalCost: formatCurrencyLabel(packageTotalCost),
        unit: `${formatDecimal(packageQuantity)} ${baseUnitLabel}`,
        sortValues: {
          ...baseRow.sortValues,
          recorded: typeof recordedQuantity === 'number' ? recordedQuantity / packageQuantity : baseRow.sortValues?.recorded,
          quantity: packageEquivalent,
          position: typeof positionQuantity === 'number' ? positionQuantity / packageQuantity : baseRow.sortValues?.position,
          minimum: typeof minimumQuantity === 'number' ? minimumQuantity / packageQuantity : baseRow.sortValues?.minimum,
          unitCost: packageUnitCost,
          totalCost: packageTotalCost,
        },
      } satisfies StockReportRow)
      return rows
    }, [])

  return expandedRows.length > 0 ? expandedRows : [baseRow]
}

export function buildServiceItemPackageLabel(packageForm: PackageForm) {
  const quantity = calculateNormalizedPackageQuantity(packageForm, 'UNIT')
  const quantityLabel = quantity > 0 ? `${formatDecimal(quantity)} UN` : 'SEM QUANTIDADE'
  return `${packageForm.internalCode || `EMB-${packageForm.id}`} • ${quantityLabel}`
}

export function buildServiceItemInventoryLabel(item: ServiceItemRecord) {
  return item.kind === 'RECIPIENTE_SERVICO' ? 'Recipiente' : 'Utensilio/Eletronico'
}

export function isOperationalInventoryMovementLocation(value: string) {
  const normalizedValue = normalizeRegistrationText(value)
  return (
    normalizedValue === 'ENTRADA DE PRODUCAO' ||
    normalizedValue === 'SAIDA PARA PRODUCAO' ||
    normalizedValue === 'SAIDA PARA REQUISICAO' ||
    normalizedValue === 'SAIDA POR VENDAS IMPORTADAS' ||
    normalizedValue === 'ESTORNO DE VENDAS IMPORTADAS' ||
    normalizedValue === 'RECEBIMENTO DE REQUISICAO' ||
    normalizedValue.startsWith('SAIDA POR DESPERDICIO')
  )
}

export function isOutboundOperationalInventoryMovementLocation(value: string) {
  const normalizedValue = normalizeRegistrationText(value)
  return (
    normalizedValue === 'SAIDA PARA PRODUCAO' ||
    normalizedValue === 'SAIDA PARA REQUISICAO' ||
    normalizedValue === 'SAIDA POR VENDAS IMPORTADAS' ||
    normalizedValue.startsWith('SAIDA POR DESPERDICIO')
  )
}

export function isWasteInventoryMovementLocation(value: string) {
  return normalizeRegistrationText(value).startsWith('SAIDA POR DESPERDICIO')
}

export function buildWasteMovementLocationLabel(location: string) {
  const normalizedLocation = normalizeRegistrationText(location)
  return normalizedLocation ? `SAIDA POR DESPERDICIO • ${normalizedLocation}` : 'SAIDA POR DESPERDICIO'
}

export function extractWasteOccurrenceLocationLabel(value: string) {
  const normalizedValue = normalizeRegistrationText(value)
  if (!normalizedValue.startsWith('SAIDA POR DESPERDICIO')) {
    return normalizedValue
  }

  const [, ...parts] = normalizedValue.split('•')
  return parts.join('•').trim() || 'SEM LOCAL INFORMADO'
}

export function isWasteDraftInventoryMovementLocation(value: string) {
  return normalizeRegistrationText(value).startsWith('RASCUNHO DE DESPERDICIO')
}

export function getInventoryTrackedMovementQuantity(record: InventoryCountRecord) {
  return Math.abs(parseDecimal(record.totalCountedQuantity) ?? 0)
}

export function buildInventoryRecipientOptionsForContext(params: {
  countableItem: InventoryCountableItem | null
  sheet: TechnicalSheetRecord | null
  product: ProductRecord | null
  serviceItem: ServiceItemRecord | null
  serviceItemsById: Map<string, ServiceItemRecord>
}) {
  const { countableItem, product, serviceItem, serviceItemsById, sheet } = params

  if (sheet) {
    const fallbackReferenceQuantity = parseDecimal(sheet.portionSize) ?? getTechnicalSheetBaseYield(sheet)
    return [
      {
        id: 'PREPARO:NONE',
        label: 'SEM RECIPIENTE',
        emptyWeight: 0,
        referenceQuantity: fallbackReferenceQuantity > 0 ? fallbackReferenceQuantity : getTechnicalSheetBaseYield(sheet),
        packageId: null,
        isFallbackOption: true,
      },
      ...sheet.serviceItems
        .filter((linkedServiceItem) => linkedServiceItem.isActive)
        .map<InventoryContainerOption | null>((linkedServiceItem) => {
          const recipient = serviceItemsById.get(linkedServiceItem.itemId) ?? null
          return recipient && recipient.isActive
            ? {
                id: recipient.id,
                label: recipient.name,
                emptyWeight: parseDecimal(recipient.emptyWeight) ?? 0,
                referenceQuantity: getTechnicalSheetBaseYield(sheet),
                packageId: null,
                isFallbackOption: false,
              }
            : null
        })
        .filter((item): item is InventoryContainerOption => item !== null),
    ].sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
  }

  if (product) {
    return [
      {
        id: 'PACKAGE:NONE',
        label: 'SEM EMBALAGEM',
        emptyWeight: 0,
        referenceQuantity: product.controlUnit === 'UNIT' ? 1 : 1000,
        packageId: null,
        isFallbackOption: true,
      },
      ...product.packages
        .filter((item) => item.isActive)
        .map((item) => ({
          id: `PACKAGE:${item.id}`,
          label: buildProductPackageLabel(product, item),
          emptyWeight:
            parseDecimal(item.packagingWeightGrams) ??
            calculatePackagingWeight(item, product.controlUnit, getProductDensityFactor(product)) ??
            0,
          referenceQuantity: calculateNormalizedPackageQuantity(item, product.controlUnit),
          packageId: item.id,
          isFallbackOption: false,
        })),
    ].sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
  }

  if (serviceItem) {
    return [
      {
        id: 'ITEM:UNIT',
        label: 'UNIDADE',
        emptyWeight: 0,
        referenceQuantity: 1,
        packageId: null,
        isFallbackOption: true,
      },
      ...serviceItem.packages
        .filter((item) => item.isActive)
        .map((item) => ({
          id: `ITEM_PACKAGE:${item.id}`,
          label: buildServiceItemPackageLabel(item),
          emptyWeight: 0,
          referenceQuantity: calculateNormalizedPackageQuantity(item, 'UNIT'),
          packageId: item.id,
          isFallbackOption: false,
        })),
    ].sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
  }

  if (countableItem?.kind === 'ITEM') {
    return [
      {
        id: 'ITEM:UNIT',
        label: 'UNIDADE',
        emptyWeight: 0,
        referenceQuantity: 1,
        packageId: null,
        isFallbackOption: true,
      },
    ]
  }

  return []
}

export function getInventoryDensityFactorForContext(params: {
  countableItem: InventoryCountableItem | null
  sheet: TechnicalSheetRecord | null
  product: ProductRecord | null
}) {
  const { countableItem, product, sheet } = params
  if (sheet) {
    const volume = parseDecimal(sheet.densitySampleVolume)
    const weight = parseDecimal(sheet.densitySampleWeight)
    if (volume && volume > 0 && weight && weight > 0) {
      return weight / volume
    }
    return 1
  }

  if (product) {
    return getProductDensityFactor(product)
  }

  if (!countableItem) {
    return 1
  }

  return 1
}

export function calculateInventoryOpenPhysicalQuantityForContext(params: {
  countableItem: InventoryCountableItem | null
  hasOpenItems: boolean
  openItemsGrossWeight: string
  openItemsContainerQuantity: string
  recipient: InventoryContainerOption | null
  densityFactor: number
}) {
  const { countableItem, densityFactor, hasOpenItems, openItemsContainerQuantity, openItemsGrossWeight, recipient } = params
  if (!countableItem || !hasOpenItems) {
    return 0
  }

  if (countableItem.kind === 'ITEM' || countableItem.controlUnit === 'UNIT') {
    return 0
  }

  const grossWeight = parseDecimal(openItemsGrossWeight) ?? 0
  const containerQuantity = parseDecimal(openItemsContainerQuantity) ?? 0
  const netWeight = Math.max(grossWeight - (recipient?.emptyWeight ?? 0) * containerQuantity, 0)

  if (countableItem.controlUnit === 'GRAM') {
    return netWeight
  }

  return densityFactor > 0 ? netWeight / densityFactor : 0
}

export function calculateInventoryTotalCountedQuantityForContext(params: {
  countableItem: InventoryCountableItem | null
  sheet: TechnicalSheetRecord | null
  hasRecipientOptions: boolean
  recipient: InventoryContainerOption | null
  closedItemsQuantity: string
  hasOpenItems: boolean
  openPhysicalQuantity: number
}) {
  const { closedItemsQuantity, countableItem, hasOpenItems, hasRecipientOptions, openPhysicalQuantity, recipient, sheet } = params
  if (!countableItem) {
    return 0
  }

  const closedQuantity = parseDecimal(closedItemsQuantity) ?? 0

  if (countableItem.kind === 'ITEM') {
    return closedQuantity * (recipient?.referenceQuantity ?? 1)
  }

  if (countableItem.kind === 'PRODUTO') {
    const closedReferenceQuantity = recipient?.referenceQuantity ?? 0
    const closedCountedQuantity = closedQuantity * closedReferenceQuantity
    return hasOpenItems ? closedCountedQuantity + openPhysicalQuantity : closedCountedQuantity
  }

  if (!sheet) {
    return 0
  }

  const closedCountedQuantity =
    closedQuantity * (recipient?.referenceQuantity ?? getInventoryClosedItemReferenceQuantity(sheet, hasRecipientOptions))
  return hasOpenItems ? closedCountedQuantity + openPhysicalQuantity : closedCountedQuantity
}

export function findStockCenterMinimumEntry(
  minimumStocks: StockCenterMinimumStock[],
  target: {
    kind: StockCountableKind
    technicalSheetId: number | null
    productId: string
    serviceItemId: string
    packageId: number | null
  },
) {
  const key = buildStockCenterMinimumEntryKey(target)
  const directEntry = minimumStocks.find((item) => buildStockCenterMinimumEntryKey(item) === key) ?? null
  if (directEntry) {
    return directEntry
  }

  if (target.kind === 'PREPARO' && target.productId.trim() !== '') {
    return minimumStocks.find((item) => item.kind === 'PREPARO' && item.productId.trim() === target.productId.trim()) ?? null
  }

  if (target.kind === 'PRODUTO' && target.packageId !== null && target.productId.trim() !== '') {
    return (
      minimumStocks.find(
        (item) => item.kind === 'PRODUTO' && item.productId.trim() === target.productId.trim() && item.packageId === null,
      ) ?? null
    )
  }

  return null
}

export function formatStockCenterMinimumDefinition(
  minimumQuantity: string,
  target: {
    kind: StockCountableKind
    technicalSheetId?: number | null
    packageId: number | null
  },
  options: {
    technicalSheets?: TechnicalSheetRecord[]
    baseQuantity?: number | null
    baseUnit?: ControlUnit | null
  } = {},
) {
  const normalizedValue = minimumQuantity.trim()
  if (!normalizedValue) {
    return '-'
  }

  if (target.kind === 'PRODUTO' && target.packageId !== null) {
    if (options.baseQuantity && options.baseQuantity > 0 && options.baseUnit) {
      return `${normalizedValue} x ${formatDecimal(options.baseQuantity)} ${formatControlUnitShort(options.baseUnit)}`
    }
    return `${normalizedValue} embalagem(ns)`
  }

  if (target.kind === 'PRODUTO') {
    return options.baseUnit
      ? `${normalizedValue} ${formatControlUnitShort(options.baseUnit)}`
      : `${normalizedValue} unidade(s) de controle`
  }

  if (target.kind === 'PREPARO') {
    const prepSheet =
      typeof target.technicalSheetId === 'number'
        ? options.technicalSheets?.find((item) => item.id === target.technicalSheetId) ?? null
        : null
    const prepUnit = options.baseUnit ?? prepSheet?.outputUnit ?? null
    const prepBaseQuantity = options.baseQuantity ?? (prepSheet ? getStockCenterBaseQuantity(prepSheet) : null)
    if (prepBaseQuantity && prepBaseQuantity > 0 && prepUnit) {
      return `${normalizedValue} x ${formatDecimal(prepBaseQuantity)} ${formatControlUnitShort(prepUnit)}`
    }
    if (prepUnit === 'UNIT') {
      return `${normalizedValue} un`
    }
    return `${normalizedValue} unidade(s) de preparo`
  }

  return `${normalizedValue} un`
}

export function getStockCenterSuggestedMinimumEntryBaseQuantity(
  entry: StockCenterMinimumStock,
  technicalSheets: TechnicalSheetRecord[],
  products: ProductRecord[],
) {
  const quantity = parseDecimal(entry.suggestedMinimumQuantity ?? '') ?? 0
  if (quantity <= 0) {
    return 0
  }

  if (entry.kind === 'PREPARO' && entry.technicalSheetId !== null) {
    const sheet = technicalSheets.find((item) => item.id === entry.technicalSheetId) ?? null
    return sheet ? quantity * getStockCenterBaseQuantity(sheet) : 0
  }

  if (entry.kind === 'PRODUTO' && entry.productId && entry.packageId !== null) {
    const product = products.find((item) => item.id === entry.productId) ?? null
    const packageForm = product?.packages.find((item) => item.id === entry.packageId) ?? null
    return product && packageForm ? quantity * calculateNormalizedPackageQuantity(packageForm, product.controlUnit) : 0
  }

  return quantity
}

export function getStockCenterAdoptedMinimumEntryBaseQuantity(
  entry: StockCenterMinimumStock,
  technicalSheets: TechnicalSheetRecord[],
  products: ProductRecord[],
) {
  const quantity = parseDecimal(entry.minimumQuantity) ?? 0
  if (quantity <= 0) {
    return 0
  }

  if (entry.kind === 'PREPARO' && entry.technicalSheetId !== null) {
    const sheet = technicalSheets.find((item) => item.id === entry.technicalSheetId) ?? null
    return sheet ? quantity * getStockCenterBaseQuantity(sheet) : 0
  }

  if (entry.kind === 'PRODUTO' && entry.productId && entry.packageId !== null) {
    const product = products.find((item) => item.id === entry.productId) ?? null
    const packageForm = product?.packages.find((item) => item.id === entry.packageId) ?? null
    return product && packageForm ? quantity * calculateNormalizedPackageQuantity(packageForm, product.controlUnit) : 0
  }

  return quantity
}

export function buildInventoryAggregationKey(target: {
  kind: StockCountableKind | 'VENDA'
  technicalSheetId: number | null
  productId: string
  serviceItemId: string
}) {
  if (target.kind === 'PREPARO') {
    return `PREPARO:${target.technicalSheetId ?? ''}`
  }

  if (target.kind === 'PRODUTO') {
    return `PRODUTO:${target.productId}`
  }

  if (target.kind === 'ITEM') {
    return `ITEM:${target.serviceItemId}`
  }

  return `VENDA:${target.technicalSheetId ?? ''}`
}

export function getRequisitionRequestUnitLabel(row: StockCenterMinimumRow) {
  if (row.kind === 'PREPARO') {
    return `${formatDecimal(row.baseQuantity)} ${formatControlUnitShort(row.baseUnit)}`
  }

  if (row.kind === 'PRODUTO') {
    if (row.packageId === null) {
      return formatControlUnitShort(row.baseUnit)
    }
    return 'EMBALAGENS'
  }

  return 'UN'
}

function getMinimumUseQuantityText(entry: StockCenterMinimumStock | null) {
  if (!entry || entry.minimumSource === 'SUGERIDO_VENDAS') {
    return ''
  }
  return entry.minimumQuantity.trim()
}

function getRealMinimumQuantityText(entry: StockCenterMinimumStock | null) {
  if (!entry) {
    return ''
  }
  return entry.suggestedMinimumQuantity?.trim() || (entry.minimumSource === 'SUGERIDO_VENDAS' ? entry.minimumQuantity.trim() : '')
}

function isProductBaseMinimumDisplayedAsPackage(
  row: StockCenterMinimumRow,
  entry: StockCenterMinimumStock | null,
) {
  return row.kind === 'PRODUTO' && row.packageId !== null && entry?.kind === 'PRODUTO' && entry.packageId === null
}

function convertStockCenterMinimumStorageTextToRowText(
  quantityText: string,
  row: StockCenterMinimumRow,
  entry: StockCenterMinimumStock | null,
) {
  const normalizedValue = quantityText.trim()
  if (!normalizedValue) {
    return ''
  }

  if (isProductBaseMinimumDisplayedAsPackage(row, entry) && row.baseQuantity > 0) {
    const quantity = parseDecimal(normalizedValue)
    return quantity === null ? normalizedValue : formatDecimal(quantity / row.baseQuantity)
  }

  return normalizedValue
}

function getMinimumUseQuantityTextForRow(row: StockCenterMinimumRow, entry: StockCenterMinimumStock | null) {
  return convertStockCenterMinimumStorageTextToRowText(getMinimumUseQuantityText(entry), row, entry)
}

function getRealMinimumQuantityTextForRow(row: StockCenterMinimumRow, entry: StockCenterMinimumStock | null) {
  return convertStockCenterMinimumStorageTextToRowText(getRealMinimumQuantityText(entry), row, entry)
}

export function getStockCenterMinimumColumnValue(
  row: StockCenterMinimumRow,
  minimumEntry: StockCenterMinimumStock | null,
  key: StockCenterMinimumColumnKey,
  options: {
    consolidatedMinimumText?: string
  } = {},
) {
  switch (key) {
    case 'sheet':
      return row.name
    case 'type':
      return row.typeLabel
    case 'family':
      return row.family
    case 'reference':
      return row.referenceLabel
    case 'yield':
      return `${formatDecimal(row.baseQuantity)} ${formatControlUnitShort(row.baseUnit)}`
    case 'minimum':
      return getMinimumUseQuantityTextForRow(row, minimumEntry)
    case 'realMinimum':
      return getRealMinimumQuantityTextForRow(row, minimumEntry)
    case 'consolidatedMinimum':
      return options.consolidatedMinimumText ?? ''
  }
}

export function sortDistinctValues(values: string[], isNumeric: boolean) {
  return [...values].sort((left, right) => {
    if (isNumeric) {
      const leftNumber = extractLeadingNumericValue(left)
      const rightNumber = extractLeadingNumericValue(right)

      if (leftNumber != null && rightNumber != null && leftNumber !== rightNumber) {
        return leftNumber - rightNumber
      }
      if (leftNumber != null && rightNumber == null) {
        return -1
      }
      if (leftNumber == null && rightNumber != null) {
        return 1
      }
    }

    return left.localeCompare(right, 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    })
  })
}

export function extractLeadingNumericValue(value: string) {
  const match = value.trim().match(/^-?[\d.,]+/)
  if (!match) {
    return null
  }

  return parseDecimal(match[0])
}
