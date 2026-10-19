const { EPSILON, parseStockDecimal: decimal, buildInventoryLedger, isStockDateKey } = require('./inventoryLedger')

const ENGINE_VERSION = 'CASCADE_V1'
const RULE_VERSION = 'CASCADE_V1.1_COMPOSITION_ONLY'
const unitNames = { G: 'GRAM', GR: 'GRAM', ML: 'MILLILITER', UN: 'UNIT' }
function normalizeUnit(value) { return unitNames[String(value).toUpperCase()] ?? value }
function sheetKey(sheet) { return `${sheet.kind}:${sheet.id}` }

function planSalesConsumption({ companyId, center, sheets, products, inventories = [], sessions = [], counts = [],
  demands, policyOverrides = {}, timing = {}, pendingMovements = [], catalogCompanyIds = [companyId], validateSources = false }) {
  const ledger = buildInventoryLedger({ inventories, sessions, counts })
  const visible = sheets.filter((sheet) => (sheet.ownerCompanyId ?? sheet.companyId) === companyId ||
    ((sheet.sharedCompanyIds ?? []).includes(companyId) && catalogCompanyIds.includes(sheet.ownerCompanyId ?? sheet.companyId)))
  const sheetById = new Map(visible.map((sheet) => [sheet.id, sheet]))
  const sheetsByProduct = new Map()
  for (const sheet of visible) sheetsByProduct.set(sheet.productId, [...(sheetsByProduct.get(sheet.productId) ?? []), sheet])
  const productById = new Map(products.map((product) => [product.id, product]))
  const generated = new Map(visible.filter((sheet) => ['BYPRODUCT', 'RETURN_TO_STOCK'].includes(sheet.yieldDifferenceDestination))
    .map((sheet) => [sheet.yieldDifferenceByproductTechnicalSheetId, sheet]))
  const taken = new Map()
  const allocations = []
  const pending = []
  const covered = []
  const warnings = []
  const complete = []
  let visits = 0
  const issue = (demand, reason, message, path = []) => ({ ...demand, reason, message, path,
    sourceName: sheetById.get(demand.sourceTechnicalSheetId)?.name ?? `FICHA ${demand.sourceTechnicalSheetId}` })
  const candidatesFor = (id) => sheetsByProduct.get(id) ?? []

  function resolveSheet(productId) {
    const candidates = candidatesFor(productId)
    if (candidates.length === 1) return candidates[0]
    const direct = candidates.filter((sheet) => (sheet.productionCenters ?? []).some((p) => p.stockCenterId === center.id))
    return direct.length === 1 ? direct[0] : null
  }

  function visit(productId, quantity, demand, path, visiting, expectedUnit) {
    if (++visits > 100000) return { reason: 'COMPLEXITY_LIMIT', message: 'Composicao extensa demais para um lote unico. Divida o lote para conferir.', path }
    if (!(quantity > EPSILON) || !Number.isFinite(quantity)) return { reason: 'INVALID_QUANTITY', message: 'Quantidade invalida.', path }
    if (visiting.has(productId) || visiting.size >= 40) return { reason: 'CYCLE', message: 'Ciclo ou profundidade excessiva na composicao.', path }
    const product = productById.get(productId)
    const candidates = candidatesFor(productId)
    const sheet = resolveSheet(productId)
    if (!sheet && candidates.length) return { reason: 'AMBIGUOUS_SHEET', message: 'Mais de uma ficha corresponde ao item.', path }
    if (!sheet && (!product || !catalogCompanyIds.includes(product.ownerCompanyId ?? product.companyId) || product.technicalSheetId)) {
      return { reason: 'MISSING_ITEM', message: 'Produto/ficha nao localizado no escopo da empresa.', path }
    }
    if ((sheet && !sheet.isActive) || (product && !product.isActive)) return { reason: 'INACTIVE_ITEM', message: 'Item inativo.', path }
    const commercial = sheet && ['EXECUCAO', 'VENDA'].includes(sheet.kind)
    const unit = commercial ? 'UNIT' : sheet?.outputUnit ?? product.controlUnit
    const nextPath = [...path, { productId, technicalSheetId: sheet?.id ?? null, name: sheet?.name ?? product.name,
      quantity, unit, baseYield: sheet ? decimal(sheet.outputQuantity) : null,
      catalogOwnerCompanyId: sheet?.ownerCompanyId ?? sheet?.companyId ?? product?.ownerCompanyId ?? product?.companyId }]
    if (expectedUnit && normalizeUnit(expectedUnit) !== unit) return { reason: 'UNIT_MISMATCH', message: 'Unidade do consumo difere do cadastro.', path: nextPath }
    if (product?.ignoreStock) return null
    const key = sheet ? sheetKey(sheet) : `PRODUTO:${productId}`
    let shortage = quantity
    if (!commercial) {
      const before = (ledger.at(demand.consumedAt).get(key) ?? 0) - (taken.get(key) ?? 0)
      if (sheet && before < -EPSILON) return { reason: 'EXISTING_NEGATIVE', message: 'Preparo ja possui saldo negativo; regularize a divergencia.', path: nextPath }
      const available = sheet ? Math.max(0, Math.min(before, ledger.capacity(key, demand.consumedAt) - (taken.get(key) ?? 0))) : quantity
      const used = sheet ? Math.min(shortage, available) : quantity
      if (used > EPSILON) {
        taken.set(key, (taken.get(key) ?? 0) + used)
        allocations.push({ demandId: demand.id, sourceTechnicalSheetId: demand.sourceTechnicalSheetId,
          sourceName: sheetById.get(demand.sourceTechnicalSheetId)?.name ?? `FICHA ${demand.sourceTechnicalSheetId}`,
          productId, technicalSheetId: sheet?.id ?? null, kind: sheet?.kind ?? 'PRODUTO', name: sheet?.name ?? product.name,
          key, quantity: used, unit, consumedAt: demand.consumedAt, balanceBefore: before, balanceAfter: before - used,
          theoretical: nextPath.length > 1, ruleVersion: RULE_VERSION, path: nextPath })
      }
      shortage -= used
      if (shortage <= EPSILON) return null
    }
    if (!sheet) return { reason: 'MISSING_ITEM', message: 'Composicao nao localizada.', path: nextPath }
    if (generated.has(sheet.id)) return { reason: 'GENERATED_OUTPUT', message: `Regularize a saida real de ${generated.get(sheet.id).name}; nao gerar nem consumir seus insumos novamente.`, path: nextPath }
    const routes = (sheet.supplyRoutes ?? []).filter((route) => route.consumerCenterId === center.id)
    const producers = sheet.productionCenters ?? []
    const local = producers.some((p) => p.stockCenterId === center.id)
    // No production-center assignment can intentionally hide a conversion from the production queue.
    const compositionOnly = sheet.kind === 'PREPARO' && producers.length === 0
    const explicitPolicy = policyOverrides[String(sheet.id)]
    const policy = explicitPolicy ?? ((local || compositionOnly) && sheet.kind === 'PREPARO' ? 'CASCADE_LOCAL' : 'STOCK_ONLY')
    if (!commercial && routes.some((route) => route.supplierCenterId && route.supplierCenterId !== center.id)) {
      return { reason: 'RECEIPT_REQUIRED', message: 'Preparo abastecido por outro centro: regularize o recebimento.', path: nextPath }
    }
    if (!commercial && policy !== 'CASCADE_LOCAL') return { reason: 'STOCK_ONLY', message: 'Cascata nao habilitada para esta ficha neste centro; conferir recebimento ou politica.', path: nextPath }
    const explicitInternalAssembly = sheet.kind === 'PRODUTO_INTERNO' && producers.length === 0 &&
      center.isProducer && sheet.companyId === companyId && explicitPolicy === 'CASCADE_LOCAL'
    if (!commercial && !local && !compositionOnly && !explicitInternalAssembly) {
      return { reason: 'NOT_LOCAL', message: 'Origem produtiva local nao confirmada.', path: nextPath }
    }
    if (!commercial && ledger.events.some((event) => event.kind === 'MOVEMENT' && event.key === key &&
        event.date > demand.consumedAt && event.location === 'ENTRADA DE PRODUCAO')) {
      return { reason: 'LATER_PRODUCTION', message: 'Ha producao registrada depois da venda. Confira datas antes de decompor a falta.', path: nextPath }
    }
    const base = commercial ? 1 : decimal(sheet.outputQuantity)
    const ingredients = [...(sheet.ingredients ?? []), ...(sheet.garnishIngredients ?? [])].filter((item) => item.isActive && item.productId)
    if (!(base > EPSILON) || !ingredients.length) return { reason: 'INVALID_RECIPE', message: 'Ficha sem composicao ativa ou rendimento valido.', path: nextPath }
    nextPath.at(-1).expandedQuantity = shortage
    nextPath.at(-1).recipe = { baseYield: base, outputUnit: unit,
      ingredients: ingredients.map((ingredient) => ({ productId: ingredient.productId, quantity: ingredient.quantity })) }
    const snapshot = new Map(taken)
    const allocationStart = allocations.length
    const nextVisiting = new Set([...visiting, productId])
    for (const ingredient of ingredients) {
      const input = decimal(ingredient.quantity)
      const error = !(input > EPSILON) ? { reason: 'INVALID_RECIPE', message: 'Ingrediente com quantidade invalida.', path: nextPath }
        : visit(ingredient.productId, shortage * input / base, demand, nextPath, nextVisiting)
      if (error) {
        taken.clear(); for (const [key, value] of snapshot) taken.set(key, value)
        allocations.splice(allocationStart)
        return error
      }
    }
    return null
  }

  const ordered = demands.map((demand) => timing.aggregate && isStockDateKey(timing.periodEnd)
    ? { ...demand, reportedConsumedAt: demand.reportedConsumedAt ?? demand.consumedAt, consumedAt: timing.periodEnd }
    : demand).sort((a, b) => String(a.consumedAt).localeCompare(String(b.consumedAt)) || String(a.id).localeCompare(String(b.id), 'en', { numeric: true }))
  for (const demand of ordered) {
    const date = demand.consumedAt?.slice(0, 10)
    if (!isStockDateKey(date) || !(demand.quantity > EPSILON)) {
      pending.push(issue(demand, 'INVALID_DEMAND', 'Data ou quantidade de consumo invalida.')); continue
    }
    const source = sheetById.get(demand.sourceTechnicalSheetId)
    if (validateSources && (!source?.isActive || !['EXECUCAO', 'VENDA', 'PRODUTO_INTERNO'].includes(source.kind))) {
      pending.push(issue(demand, 'INVALID_SOURCE', 'Ficha de origem ausente, inativa ou fora do escopo; revise o de/para.')); continue
    }
    if (!timing.dayEndConfirmed || (timing.aggregate && (!timing.periodStart || !timing.periodEnd))) {
      pending.push(issue(demand, 'TIMING_REQUIRED', 'Confirme o periodo e o fechamento diario do consumo.')); continue
    }
    if (timing.periodStart && timing.periodEnd && (timing.periodStart > timing.periodEnd || date < timing.periodStart || date > timing.periodEnd)) {
      pending.push(issue(demand, 'INVALID_PERIOD', 'A data do consumo esta fora do periodo declarado.')); continue
    }
    if (ledger.latestInventory && timing.periodStart && timing.periodStart <= ledger.latestInventory.date && timing.periodEnd >= ledger.latestInventory.date) {
      pending.push(issue(demand, 'PERIOD_CROSSES_INVENTORY', 'O periodo atravessa um inventario. Use vendas detalhadas por data.')); continue
    }
    if (ledger.latestInventory && date < ledger.latestInventory.date) { covered.push(demand); continue }
    if (ledger.latestInventory?.date === date) {
      pending.push(issue(demand, 'INVENTORY_SAME_DAY', 'Venda e inventario no mesmo dia: conferir o corte antes de lancar.')); continue
    }
    if (inventories.some((inventory) => !inventory.isClosed)) {
      pending.push(issue(demand, 'OPEN_INVENTORY', 'Aguardando consolidacao do inventario; a baixa sera reavaliada.')); continue
    }
    if (pendingMovements.length) {
      pending.push(issue(demand, 'PENDING_MOVEMENTS', 'Existem movimentacoes aguardando aplicacao; regularize antes de calcular o saldo.')); continue
    }
    const start = allocations.length
    const error = visit(demand.productId, demand.quantity, demand, [], new Set(), demand.unit)
    if (error) {
      const directUsed = allocations.slice(start).filter((allocation) => allocation.productId === demand.productId && allocation.path.length === 1)
        .reduce((sum, allocation) => sum + allocation.quantity, 0)
      pending.push(issue({ ...demand, quantity: Math.max(0, demand.quantity - directUsed) }, error.reason, error.message, error.path))
    } else complete.push(demand.id)
  }
  for (const [key, quantity] of taken) {
    const after = (ledger.current.get(key) ?? 0) - quantity
    if (key.startsWith('PRODUTO:') && after < -EPSILON) {
      warnings.push({ reason: 'NEGATIVE_PRODUCT', productId: key.slice(8), name: productById.get(key.slice(8))?.name ?? key,
        balanceBefore: ledger.current.get(key) ?? 0, balanceAfter: after, quantity })
    }
  }
  const policySheets = visible.filter((sheet) => ['PREPARO', 'PRODUTO_INTERNO'].includes(sheet.kind) &&
    (allocations.some((a) => a.path.some((p) => p.technicalSheetId === sheet.id)) ||
      pending.some((p) => p.path.some((step) => step.technicalSheetId === sheet.id)))).map((sheet) => ({
      id: sheet.id, name: sheet.name, kind: sheet.kind, local: (sheet.productionCenters ?? []).some((p) => p.stockCenterId === center.id),
      generated: generated.has(sheet.id), policy: policyOverrides[String(sheet.id)] ?? 'DEFAULT',
    }))
  return { engine: ENGINE_VERSION, ruleVersion: RULE_VERSION, allocations, pending, covered, complete, warnings, policySheets,
    inventory: ledger.latestInventory ? { id: ledger.latestInventory.id, date: ledger.latestInventory.date } : null,
    companyId, stockCenterId: center.id, centerName: center.name }
}

module.exports = { ENGINE_VERSION, RULE_VERSION, planSalesConsumption, normalizeUnit }
