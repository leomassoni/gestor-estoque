import type { InventoryContainerOption, InventoryCountHistoryDraft, InventoryCountRecord, ServiceItemRecord, TechnicalSheetRecord } from '../types/domain'
import { normalizeRegistrationText, parseDecimal, parseNumericInputDecimal } from '../utils/core'

// Metadata-only edits keep totals saved under earlier counting rules.
export function preservePreparationCountQuantity(record: InventoryCountRecord, draft: InventoryCountHistoryDraft) {
  const sameQuantity = (left: string, right: string) =>
    (parseNumericInputDecimal(left) ?? 0) === (parseNumericInputDecimal(right) ?? 0)
  return record.technicalSheetKind === 'PREPARO' &&
    normalizeRegistrationText(record.recipientItemId) === normalizeRegistrationText(draft.recipientItemId) &&
    record.hasOpenItems === (draft.hasOpenItems === 'true') &&
    sameQuantity(record.closedItemsQuantity, draft.closedItemsQuantity) &&
    (!record.hasOpenItems || (sameQuantity(record.openItemsGrossWeight, draft.openItemsGrossWeight) &&
      sameQuantity(record.openItemsContainerQuantity, draft.openItemsContainerQuantity)))
}

export function getServiceItemSizeFieldLabel(item: Pick<ServiceItemRecord, 'kind' | 'sizeUnit'>) {
  if (item.sizeUnit === 'CENTIMETER') return 'Dimensao'
  if (item.kind === 'RECIPIENTE_SERVICO') return item.sizeUnit === 'MILLILITER' ? 'Volume' : 'Capacidade em massa'
  return 'Medida'
}

export function getPreparationContainerQuantity(sheet: TechnicalSheetRecord, recipient: ServiceItemRecord) {
  const capacity = parseDecimal(recipient.sizeValue) ?? 0
  if (capacity <= 0 || recipient.sizeUnit === 'CENTIMETER' || sheet.outputUnit === 'UNIT' || sheet.outputUnit === 'COMBO') return null
  if (recipient.sizeUnit === sheet.outputUnit) return capacity
  const volume = parseDecimal(sheet.densitySampleVolume) ?? 0
  const weight = parseDecimal(sheet.densitySampleWeight) ?? 0
  if (volume <= 0 || weight <= 0) return null
  const density = weight / volume
  return sheet.outputUnit === 'GRAM' ? capacity * density : capacity / density
}

export function buildPreparationContainerOptions(sheet: TechnicalSheetRecord, serviceItemsById: Map<string, ServiceItemRecord>) {
  const options: InventoryContainerOption[] = [{
    id: 'PREPARO NONE', label: 'SEM RECIPIENTE', emptyWeight: 0,
    referenceQuantity: 1, packageId: null, isFallbackOption: true,
  }]
  const seen = new Set<string>()
  for (const link of sheet.serviceItems) {
    const recipient = serviceItemsById.get(link.itemId)
    if (!link.isActive || !recipient?.isActive || seen.has(recipient.id)) continue
    const referenceQuantity = getPreparationContainerQuantity(sheet, recipient)
    seen.add(recipient.id)
    options.push({ id: recipient.id, label: recipient.name, emptyWeight: parseDecimal(recipient.emptyWeight) ?? 0,
      referenceQuantity: referenceQuantity ?? 0, packageId: null, isFallbackOption: false })
  }
  return options.sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
}
