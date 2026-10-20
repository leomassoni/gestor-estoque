import assert from 'node:assert/strict'
import { buildPreparationContainerOptions, getPreparationContainerQuantity, getServiceItemSizeFieldLabel, preservePreparationCountQuantity } from '../src/domain/preparationContainers.ts'
import { buildInventoryRecipientOptionsForContext, calculateInventoryTotalCountedQuantityForContext,
  calculateInventoryOpenPhysicalQuantityForContext } from '../src/domain/inventory.ts'

const link = (id) => ({ id: Number(id.replace(/\D/g, '')) || 1, itemId: id, itemLabel: id, quantity: '1', isActive: true })
const recipient = (id, capacity, tare) => ({ id, name: id, sizeValue: String(capacity), sizeUnit: 'MILLILITER',
  emptyWeight: String(tare), isActive: true, kind: 'RECIPIENTE_SERVICO', packages: [] })
const recipients = new Map([['REC700', recipient('REC700', 700, 180)], ['REC1000', recipient('REC1000', 1000, 250)]])
const sheet = { id: 1, kind: 'PREPARO', outputUnit: 'MILLILITER', outputQuantity: '900', portionSize: '1000',
  densitySampleVolume: '100', densitySampleWeight: '100', serviceItems: [...recipients.keys()].map(link) }
const item = { kind: 'PREPARO', controlUnit: 'MILLILITER' }
const options = buildPreparationContainerOptions(sheet, recipients)
const none = options.find((option) => option.isFallbackOption)
assert.equal(none.id, 'PREPARO NONE')
const bottle = options.find((option) => option.id === 'REC700')
assert.equal(none.referenceQuantity, 1)
assert.equal(bottle.referenceQuantity, 700)
assert.equal(bottle.emptyWeight, 180)
const total = (option, closed, open = 0, targetSheet = sheet) => calculateInventoryTotalCountedQuantityForContext({
  countableItem: { ...item, controlUnit: targetSheet.outputUnit }, sheet: targetSheet, recipient: option,
  hasRecipientOptions: true, closedItemsQuantity: String(closed), hasOpenItems: open > 0,
  openPhysicalQuantity: open, requireKnownContainerCapacity: true,
})
assert.equal(total(none, '450.125'), 450.125)
assert.equal(total(bottle, 2), 1400)
const open = calculateInventoryOpenPhysicalQuantityForContext({ countableItem: item, hasOpenItems: true,
  openItemsGrossWeight: '500', openItemsContainerQuantity: '1', recipient: bottle, densityFactor: 1 })
assert.equal(open, 320)
assert.equal(total(bottle, 1, open), 1020)
const second = options.find((option) => option.id === 'REC1000')
assert.equal(total(bottle, 2) + total(second, 1) + total(none, 300), 2700)
console.log('PASS capacidade 700/1000, sem recipiente em unidade base, tara e soma de recipientes diferentes')

const massSheet = { ...sheet, outputUnit: 'GRAM', densitySampleVolume: '100', densitySampleWeight: '120' }
assert.equal(getPreparationContainerQuantity(massSheet, recipients.get('REC700')), 840)
assert.equal(getPreparationContainerQuantity({ ...massSheet, densitySampleVolume: '' }, recipients.get('REC700')), null)
assert.equal(total(none, 250, 0, massSheet), 250)
const massRecipient = { ...recipients.get('REC700'), sizeUnit: 'GRAM' }
assert.equal(getPreparationContainerQuantity(sheet, massRecipient), 700)
assert.equal(getPreparationContainerQuantity({ ...sheet, densitySampleWeight: '80' }, massRecipient), 875)
const invalid = buildPreparationContainerOptions({ ...sheet, serviceItems: [link('BAD')] },
  new Map([['BAD', { ...recipients.get('REC700'), id: 'BAD', sizeValue: '' }]])).find((option) => option.id === 'BAD')
assert.equal(invalid.referenceQuantity, 0)
assert.equal(invalid.emptyWeight, 180)
assert.throws(() => total(invalid, 1), /capacidade/)
assert.equal(total(invalid, 0, 320), 320)
const unitSheet = { ...sheet, outputUnit: 'UNIT' }
assert.equal(total(buildPreparationContainerOptions(unitSheet, recipients).find((option) => option.isFallbackOption), 3, 0, unitSheet), 3)
console.log('PASS massa/volume somente com densidade, capacidade ausente nao vira zero silencioso; tara continua disponivel')

const many = new Map(Array.from({ length: 250 }, (_, index) => [`REC${index}`, recipient(`REC${index}`, 700, 180)]))
assert.equal(buildPreparationContainerOptions({ ...sheet, serviceItems: [...many.keys()].map(link) }, many).length, 251)
assert.equal(buildPreparationContainerOptions({ ...sheet, serviceItems: [link('REC700'), link('REC700')] }, recipients).length, 2)
assert.equal(buildPreparationContainerOptions({ ...sheet, serviceItems: [{ ...link('REC700'), isActive: false }] }, recipients).length, 1)
assert.equal(buildPreparationContainerOptions(sheet, new Map()).length, 1)
console.log('PASS 250 vinculos sem limite artificial, deduplicacao e inativos sem alterar cadastros')

const packageForm = { id: 12, isActive: true, packageQuantity: '700', packageUnit: 'MILLILITER',
  packagingWeightGrams: '180', grossWeightGrams: '880', purchasePrice: '80', referenceCodes: [] }
const product = { id: 'GIN', name: 'GIN SINGLEFIN', controlUnit: 'MILLILITER', packages: [packageForm],
  densitySampleVolume: '', densitySampleWeight: '' }
const productOptions = buildInventoryRecipientOptionsForContext({ countableItem: { kind: 'PRODUTO' }, sheet: null,
  product, serviceItem: null, serviceItemsById: recipients })
assert.equal(productOptions.find((option) => option.packageId === 12).referenceQuantity, 700)
const internal = { ...sheet, kind: 'PRODUTO_INTERNO' }
const internalOptions = buildInventoryRecipientOptionsForContext({ countableItem: item, sheet: internal,
  product: null, serviceItem: null, serviceItemsById: recipients })
assert.equal(internalOptions.find((option) => option.id === 'REC700').referenceQuantity, 900)
const wasteOptions = buildInventoryRecipientOptionsForContext({ countableItem: item, sheet,
  product: null, serviceItem: null, serviceItemsById: recipients, usePreparationContainerCapacity: false })
assert.equal(wasteOptions.find((option) => option.id === 'REC700').referenceQuantity, 900)
assert.equal(wasteOptions.find((option) => option.isFallbackOption).referenceQuantity, 1000)
assert.equal(getServiceItemSizeFieldLabel({ kind: 'RECIPIENTE_SERVICO', sizeUnit: 'MILLILITER' }), 'Volume')
console.log('PASS embalagens de produtos e produto interno preservados; volume separado de preco')

const legacy = { technicalSheetKind: 'PREPARO', recipientItemId: 'PREPARO:NONE', closedItemsQuantity: '1',
  hasOpenItems: false, totalCountedQuantity: '1.000', openItemsGrossWeight: '', openItemsContainerQuantity: '' }
const draft = { storageLocation: 'OUTRA PRATELEIRA', recipientItemId: 'PREPARO:NONE', closedItemsQuantity: '1',
  hasOpenItems: 'false', openItemsGrossWeight: '', openItemsContainerQuantity: '' }
assert(preservePreparationCountQuantity(legacy, draft))
assert(preservePreparationCountQuantity(legacy, { ...draft, recipientItemId: 'PREPARO NONE' }))
assert.equal(calculateInventoryTotalCountedQuantityForContext({
  countableItem: item, sheet, recipient: none, hasRecipientOptions: true, closedItemsQuantity: '1',
  hasOpenItems: false, openPhysicalQuantity: 0, previousCount: { record: legacy, draft },
}), 1000)
assert(!preservePreparationCountQuantity(legacy, { ...draft, closedItemsQuantity: '300' }))
assert(!preservePreparationCountQuantity(legacy, { ...draft, recipientItemId: 'REC700' }))
assert(!preservePreparationCountQuantity({ ...legacy, hasOpenItems: true, openItemsGrossWeight: '500',
  openItemsContainerQuantity: '1' }, { ...draft, hasOpenItems: 'true', openItemsGrossWeight: '600', openItemsContainerQuantity: '1' }))
console.log('PASS editar somente local em resumo/historico nao recalcula quantidades antigas')
