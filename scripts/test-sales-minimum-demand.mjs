import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: ['src/domain/salesMinimumDemand.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
const { buildCurrentSalesMinimumDemandRows } = await import(moduleUrl)

const ingredient = (productId, quantity, active = true) => ({
  id: 1,
  productId,
  productLabel: productId,
  quantity: String(quantity),
  operationalQuantity: '',
  operationalUnit: '',
  manipulatedQuantity: '',
  yieldQuantity: String(quantity),
  equivalentProducts: [],
  isActive: active,
})
const sale = {
  id: 1,
  kind: 'VENDA',
  productId: 'VEN-1',
  outputQuantity: '1',
  outputUnit: 'UNIT',
  ingredients: [ingredient('OLD', 60)],
  garnishIngredients: [ingredient('GARNISH', 1)],
}
const row = { consumedAt: '2026-11-08', matchedTechnicalSheetId: 1, quantity: 10, status: 'MATCHED' }
const postedConsumption = { ingredientProductId: 'OLD', quantityConsumed: '600', stockPostingStatus: 'POSTED' }
const historicalSnapshot = structuredClone(postedConsumption)

const before = buildCurrentSalesMinimumDemandRows([row], [sale], [])
assert.equal(before.find((item) => item.ingredientProductId === 'OLD').quantityConsumed, 600)
assert.equal(before.find((item) => item.ingredientProductId === 'GARNISH').quantityConsumed, 10)

const updatedSale = { ...sale, ingredients: [ingredient('NEW', 60), ingredient('INACTIVE', 5, false)] }
const after = buildCurrentSalesMinimumDemandRows([row], [updatedSale], [])
assert.equal(after.find((item) => item.ingredientProductId === 'NEW').quantityConsumed, 600)
assert.equal(after.some((item) => item.ingredientProductId === 'OLD'), false)
assert.equal(after.some((item) => item.ingredientProductId === 'INACTIVE'), false)
assert.deepEqual(postedConsumption, historicalSnapshot)

const execution = {
  ...sale,
  id: 3,
  kind: 'EXECUCAO',
  outputQuantity: '100',
  outputUnit: 'MILLILITER',
  ingredients: [ingredient('BASE', 50), ingredient('NEW', 50)],
  garnishIngredients: [],
  dilutionRatePercentage: '0',
}
const executionRows = buildCurrentSalesMinimumDemandRows([{ ...row, matchedTechnicalSheetId: 3, quantity: 2 }], [execution], [])
assert.equal(executionRows.find((item) => item.ingredientProductId === 'NEW').quantityConsumed, 100)

const internal = { ...sale, id: 2, kind: 'PRODUTO_INTERNO', outputQuantity: '500', outputUnit: 'MILLILITER', portionSize: '100' }
const internalRows = buildCurrentSalesMinimumDemandRows([{ ...row, matchedTechnicalSheetId: 2, quantity: 3 }], [internal], [])
assert.deepEqual(internalRows.map(({ ingredientProductId, quantityConsumed }) => ({ ingredientProductId, quantityConsumed })), [
  { ingredientProductId: 'VEN-1', quantityConsumed: 300 },
])

console.log('PASS: historico de vendas com composicao atual, insumo inativo ignorado e baixa historica intacta')

const macunaima = { ...execution, id: 288, ingredients: [ingredient('BEM_ME_QUER', 45)], garnishIngredients: [] }
const macunaimaRow = { ...row, matchedTechnicalSheetId: 288, quantity: 103 }
const oldCachaca = buildCurrentSalesMinimumDemandRows([macunaimaRow], [macunaima], [])
const newCachaca = buildCurrentSalesMinimumDemandRows([macunaimaRow], [{ ...macunaima, ingredients: [ingredient('SALINISSIMA', 45)] }], [])
assert.equal(oldCachaca[0].quantityConsumed, 4635)
assert.deepEqual(newCachaca.map(({ ingredientProductId, quantityConsumed }) => ({ ingredientProductId, quantityConsumed })), [
  { ingredientProductId: 'SALINISSIMA', quantityConsumed: 4635 },
])

const pewen = { ...execution, id: 622, ingredients: [ingredient('PRE_BATCH_PEWEN', 150)], outputQuantity: '150' }
const pewenRows = buildCurrentSalesMinimumDemandRows([{ ...row, matchedTechnicalSheetId: 622, quantity: 260 }], [pewen], [])
assert.deepEqual(pewenRows.map(({ ingredientProductId, quantityConsumed }) => ({ ingredientProductId, quantityConsumed })), [
  { ingredientProductId: 'PRE_BATCH_PEWEN', quantityConsumed: 39000 },
])
console.log('PASS: trocas de cachaca e dependencias de Pewen recalculam a projecao, sem alterar vendas')

const plannerBundle = await build({
  entryPoints: ['src/domain/productionRequisitionPlanner.ts'], bundle: true, format: 'esm', platform: 'node', write: false,
})
const plannerUrl = `data:text/javascript;base64,${Buffer.from(plannerBundle.outputFiles[0].text).toString('base64')}`
const { planProductionRequisitionShortages } = await import(plannerUrl)
const planned = planProductionRequisitionShortages({
  sheets: [{ id: 'CHILD', depth: 0, direct: 5 }, { id: 'PARENT', depth: 1, direct: 10 }],
  availableByKey: new Map([['CHILD', 12]]),
  priority: (sheet) => sheet.depth,
  stockKey: (sheet) => sheet.id,
  directRequiredQuantity: (sheet) => sheet.direct,
  expandShortage: (sheet, shortage, available) => {
    if (sheet.id === 'CHILD') return [{ product: 'INPUT', amount: shortage * 3 }]
    const childNeeded = shortage * 2
    const childAvailable = available.get('CHILD') ?? 0
    available.set('CHILD', Math.max(childAvailable - childNeeded, 0))
    return [{ product: 'INPUT', amount: Math.max(childNeeded - childAvailable, 0) * 3 }]
  },
})
assert.equal(planned.reduce((sum, line) => sum + line.amount, 0), 39)
console.log('PASS: preparo pai e demanda independente do filho compartilham saldo sem duplicar insumos')

const sharedProductStock = planProductionRequisitionShortages({
  sheets: [{ id: 'PREP', depth: 0, direct: 10 }],
  availableByKey: new Map([['PRODUCT', 10]]),
  reservedByKey: new Map([['PRODUCT', 8]]),
  priority: (sheet) => sheet.depth,
  stockKey: (sheet) => sheet.id,
  directRequiredQuantity: (sheet) => sheet.direct,
  expandShortage: (_sheet, shortage, available) => [{
    product: 'PRODUCT', amount: Math.max(shortage - (available.get('PRODUCT') ?? 0), 0),
  }],
})
assert.deepEqual(sharedProductStock, [{ product: 'PRODUCT', amount: 8 }])
console.log('PASS: venda direta reserva saldo antes da explosao de producao')

const recalculationBundle = await build({
  entryPoints: ['src/domain/salesMinimumRecalculation.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const recalculationUrl = `data:text/javascript;base64,${Buffer.from(recalculationBundle.outputFiles[0].text).toString('base64')}`
const { recalculateSalesMinimumsAfterSheetSave } = await import(recalculationUrl)
const centers = [{ id: 7, companyId: 13, minimumStocks: [{ productId: 'MANUAL', minimumQuantity: '10' }] }]
const sales = { batches: [{ id: 1, companyId: 13, status: 'IMPORTED' }], rows: [{ companyId: 13 }], consumptions: [] }
let persistCalls = 0
const result = await recalculateSalesMinimumsAfterSheetSave({
  companyIds: [13, 13, 99],
  loadCenters: async () => centers,
  loadSales: async () => sales,
  rebuildCompany: (current, companyId) => current.map((center) => companyId === center.companyId
    ? { ...center, minimumStocks: [...center.minimumStocks, { productId: 'NEW', suggestedMinimumQuantity: '5' }] }
    : center),
  persistCenters: async (beforeCenters, afterCenters) => {
    assert.deepEqual(beforeCenters, centers)
    assert.equal(afterCenters[0].minimumStocks.filter((entry) => entry.productId === 'NEW').length, 1)
    persistCalls += 1
  },
})
assert.equal(persistCalls, 1)
assert.equal(result[0].minimumStocks.find((entry) => entry.productId === 'MANUAL').minimumQuantity, '10')
assert.deepEqual(centers[0].minimumStocks, [{ productId: 'MANUAL', minimumQuantity: '10' }])
console.log('PASS: recalculo apenas para empresa com vendas, minimo manual e snapshot preservados')
