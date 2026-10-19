import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { planSalesConsumption } = require('../server/salesConsumptionPlanner')
const { buildInventoryLedger, parseStockDecimal } = require('../server/inventoryLedger')

const center = { id: 7, companyId: 13, isProducer: true, name: 'BAR DE BAIXO' }
const product = (id, options = {}) => ({ id, companyId: 13, name: id, controlUnit: 'GRAM', isActive: true, ignoreStock: false, ...options })
const ingredient = (id, quantity) => ({ productId: id, quantity: String(quantity), isActive: true })
const sheet = (id, productId, ingredients, options = {}) => ({ id, productId, companyId: 13, sharedCompanyIds: [],
  name: productId, kind: 'PREPARO', outputQuantity: '500', outputUnit: 'GRAM', ingredients,
  garnishIngredients: [], productionCenters: [{ stockCenterId: 7 }], supplyRoutes: [], isActive: true, ...options })
const grapes = sheet(460, 'GRAPES', [ingredient('RAW', 500)])
const units = sheet(591, 'UNITS', [ingredient('GRAPES', 500)], { outputQuantity: '63', outputUnit: 'UNIT' })
const prep = sheet(588, 'PEWEN', [ingredient('RAW', 500)], { outputQuantity: '1000', outputUnit: 'MILLILITER' })
const inventory = { id: 1, isClosed: true, countedAt: '2026-10-11', startedAt: '2026-10-11T10:00:00Z' }
let nextId = 10
function count(id, quantity, kind = 'PREPARO', options = {}) {
  return { id: nextId++, inventoryId: 1, technicalSheetId: kind === 'PRODUTO' ? null : id,
    productId: kind === 'PRODUTO' ? id : '', technicalSheetKind: kind, storageLocation: 'PRATELEIRA',
    countedAt: '2026-10-11', totalCountedQuantity: String(quantity), ...options }
}
const demand = (id, quantity, options = {}) => ({ id, productId: 'UNITS', quantity, unit: 'UN',
  consumedAt: '2026-10-15', sourceTechnicalSheetId: 622, ...options })
const options = { companyId: 13, center, sheets: [grapes, units, prep], products: [product('RAW')],
  inventories: [inventory], sessions: [], counts: [count('RAW', 1000, 'PRODUTO')],
  demands: [demand(1, 2)], timing: { dayEndConfirmed: true } }
const run = (override = {}) => planSalesConsumption({ ...options, ...override })
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`)

let p = run({ counts: [...options.counts, count(591, 2)] })
assert.equal(p.allocations.length, 1); assert.equal(p.allocations[0].productId, 'UNITS'); assert.equal(p.allocations[0].quantity, 2)
assert.equal(p.pending.length, 0)
console.log('PASS T01 saldo suficiente nao baixa materia-prima novamente')
p = run(); close(p.allocations[0].quantity, 1000 / 63); assert.equal(p.allocations[0].path.length, 3); assert.equal(p.pending.length, 0)
console.log('PASS T02 T04 conversao Pewen sem estoque: duas unidades = 15,87301587 G')
p = run({ counts: [...options.counts, count(591, 1), count(460, 3)] })
assert.equal(p.allocations[0].quantity, 1); assert.equal(p.allocations[1].quantity, 3)
close(p.allocations[2].quantity, 500 / 63 - 3)
console.log('PASS T03 T04 saldo parcial em varios niveis')
p = run({ counts: [...options.counts, count(591, 3)], demands: [demand(1, 2), demand(2, 2)] })
assert.equal(p.allocations.filter((a) => a.productId === 'UNITS').reduce((s, a) => s + a.quantity, 0), 3)
close(p.allocations.find((a) => a.productId === 'RAW').quantity, 500 / 63)
console.log('PASS T05 linhas compartilham saldo, sem reutilizar a mesma unidade')
p = run({ counts: [] }); assert.equal(p.warnings.length, 1); assert(p.warnings[0].balanceAfter < 0)
p = run({ counts: [count(591, -1)] }); assert.equal(p.pending[0].reason, 'EXISTING_NEGATIVE'); assert.equal(p.allocations.length, 0)
console.log('PASS T06 T07 negativo apenas em produto; divergencia anterior nao e apagada')
p = run({ sheets: [grapes, { ...units, supplyRoutes: [{ consumerCenterId: 7, supplierCenterId: 9 }] }] })
assert.equal(p.pending[0].reason, 'RECEIPT_REQUIRED'); assert.equal(p.allocations.length, 0)
p = run({ sheets: [grapes, { ...units, companyId: 2, sharedCompanyIds: [13] }], catalogCompanyIds: [13, 2] }); assert.equal(p.pending.length, 0)
console.log('PASS T08 T09 rota externa bloqueia; ficha compartilhada com producao local permite')
p = run({ sheets: [grapes, units, sheet(1, 'GENERATOR', [ingredient('RAW', 500)], {
  yieldDifferenceDestination: 'BYPRODUCT', yieldDifferenceByproductTechnicalSheetId: 591,
})] }); assert.equal(p.pending[0].reason, 'GENERATED_OUTPUT'); assert.equal(p.allocations.length, 0)
console.log('PASS T10 subproduto nao explode gerador nem cria entradas ficticias')
p = run({ sheets: [grapes, units, sheet(1, 'GENERATOR', [ingredient('RAW', 500)], {
  yieldDifferenceDestination: 'RETURN_TO_STOCK', yieldDifferenceByproductTechnicalSheetId: 591,
})] }); assert.equal(p.pending[0].reason, 'GENERATED_OUTPUT')
p = run({ products: [product('RAW', { companyId: 2, ownerCompanyId: 2 })], catalogCompanyIds: [13, 2] })
assert.equal(p.pending.length, 0)
console.log('PASS retorno ao estoque e barreira; materia-prima de catalogo compartilhado respeita escopo autorizado')
p = run({ sheets: [{ ...grapes, ingredients: [{ ...ingredient('RAW', 500), equivalentProducts: [{ productId: 'OTHER', isActive: true }] }] }, units],
  products: [product('RAW'), product('OTHER')], counts: [count('OTHER', 1000, 'PRODUTO')] })
assert.equal(p.allocations[0].productId, 'RAW'); assert.equal(p.warnings.length, 1)
console.log('PASS T11 nao seleciona equivalente automaticamente pelo saldo')
p = run({ sheets: [grapes, { ...units, kind: 'PRODUTO_INTERNO' }] }); assert.equal(p.pending[0].reason, 'STOCK_ONLY')
p = run({ sheets: [grapes, { ...units, kind: 'PRODUTO_INTERNO' }], policyOverrides: { 591: 'CASCADE_LOCAL' } }); assert.equal(p.pending.length, 0)
const execution = sheet(622, 'EXEC', [ingredient('UNITS', 2)], { kind: 'EXECUCAO', outputQuantity: '150', outputUnit: 'MILLILITER' })
p = run({ sheets: [...options.sheets, execution], demands: [demand(1, 1, { productId: 'EXEC', unit: 'UN' })] })
close(p.allocations[0].quantity, 1000 / 63)
console.log('PASS T13 produto interno exige politica; execucao/combo e consumida por unidade')
for (const [value, expected] of [['0.125', .125], ['0,125', .125], ['1.000', 1000], ['-1.000', -1000], ['-0.125', -.125]]) assert.equal(parseStockDecimal(value), expected)
p = run({ demands: [demand(1, 2, { unit: 'ML' })] }); assert.equal(p.pending[0].reason, 'UNIT_MISMATCH')
console.log('PASS T14 decimais e unidades sem conversao implicita')
p = run({ products: [product('RAW', { ignoreStock: true })] }); assert.equal(p.pending.length, 0); assert.equal(p.allocations.length, 0)
console.log('PASS T15 ignoreStock nao gera baixa')
for (const [sheets, reason] of [[[{ ...units, outputQuantity: '0' }], 'INVALID_RECIPE'],
  [[{ ...units, ingredients: [ingredient('MISSING', 500)] }], 'MISSING_ITEM'],
  [[{ ...units, ingredients: [ingredient('UNITS', 500)] }], 'CYCLE']]) {
  p = run({ sheets }); assert.equal(p.pending[0].reason, reason); assert.equal(p.allocations.length, 0)
}
console.log('PASS T16 erros de receita e ciclos preservam atomicidade do ramo')
p = run({ demands: [demand(1, 2, { consumedAt: '2026-10-10' })] }); assert.equal(p.covered.length, 1); assert.equal(p.allocations.length, 0)
p = run({ demands: [demand(1, 2, { consumedAt: '2026-10-11' })] }); assert.equal(p.pending[0].reason, 'INVENTORY_SAME_DAY')
p = run({ timing: { dayEndConfirmed: true, aggregate: true, periodStart: '2026-10-09', periodEnd: '2026-10-15' } }); assert.equal(p.pending[0].reason, 'PERIOD_CROSSES_INVENTORY')
console.log('PASS T17 inventario posterior nao recebe dupla baixa; corte ambiguo bloqueado')
p = run({ inventories: [inventory, { ...inventory, id: 2, isClosed: false }] }); assert.equal(p.pending[0].reason, 'OPEN_INVENTORY')
p = run({ pendingMovements: [{ id: 1 }] }); assert.equal(p.pending[0].reason, 'PENDING_MOVEMENTS')
console.log('PASS T18 inventario aberto e movimentos pendentes nao congelam baixas antigas')
const later = count(591, 1, 'PREPARO', { inventoryId: null, countedAt: '2026-10-16', storageLocation: 'ENTRADA DE PRODUCAO' })
p = run({ counts: [...options.counts, later] }); assert.equal(p.pending[0].reason, 'LATER_PRODUCTION')
console.log('PASS producao posterior exige conciliar datas antes de consumir materia-prima')
const broken = sheet(15, 'MIX', [ingredient('RAW', 10), ingredient('MISSING', 10)])
p = run({ sheets: [broken], demands: [demand(1, 500, { productId: 'MIX', unit: 'G' })] })
assert.equal(p.allocations.length, 0); assert.equal(p.pending[0].quantity, 500)
console.log('PASS ramo incompleto nao deixa ingredientes parcialmente descontados')
const ledger = buildInventoryLedger({ inventories: [inventory], sessions: [], counts: [count(591, 2),
  count(591, -1, 'PREPARO', { inventoryId: null, countedAt: '2026-10-15', storageLocation: 'SAIDA POR VENDAS IMPORTADAS' })] })
assert.equal(ledger.current.get('PREPARO:591'), 1)
console.log('PASS paridade do saldo: consolidacao substitui estoque e movimentos aplicam sinal uma vez')
const start = performance.now()
p = run({ demands: Array.from({ length: 2000 }, (_, index) => demand(index + 1, 2)) })
assert.equal(p.pending.length, 0); assert.equal(p.allocations.length, 2000)
console.log(`PASS motor 2000 demandas: ${Math.round(performance.now() - start)} ms; nenhum React ou acesso ao banco no planejador`)
