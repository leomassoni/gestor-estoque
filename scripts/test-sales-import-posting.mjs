import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../server/node_modules/@prisma/client')
const { buildInventoryLedger, parseStockDecimal } = require('../server/inventoryLedger')
const url = new URL(fs.readFileSync('server/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^['"]|['"]$/g, ''))
url.pathname = '/gestor_estoque_production_regression'
assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Teste permitido apenas em banco local isolado.')
const db = new PrismaClient({ datasourceUrl: url.toString() })
const companyId = 9988, stockCenterId = 9988, rawId = 'TESTE-CASCADE-RAW', grapesId = 9988, unitsId = 9989
const timing = { dayEndConfirmed: true, aggregate: false, periodStart: '', periodEnd: '' }
let token
async function request(path, body, method = body === undefined ? 'GET' : 'POST', auth = token) {
  const response = await fetch(`http://127.0.0.1:4001/api/${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json() }
}
async function preview(id) {
  const response = await request(`sales-import-batches/${id}/posting-preview`, { timing })
  assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data.plan
}
async function confirm(id, plan, extras = {}) {
  return request(`sales-import-batches/${id}/posting-confirm`, { timing, revision: plan.revision,
    idempotencyKey: crypto.randomUUID(), confirmNegativeProducts: true, ...extras })
}
async function snapshot() {
  return { inventories: await db.appInventoryRecord.findMany({ where: { companyId } }),
    sessions: await db.appInventoryCountSessionRecord.findMany({ where: { companyId } }),
    counts: await db.appInventoryCountRecord.findMany({ where: { companyId } }) }
}
const omitMeta = ({ createdAt, createdAtRecord, updatedAt, ...row }) => row
let countTemplate
let inventoryTemplate
async function inventory(id, countedAt, isClosed = true) {
  return db.appInventoryRecord.create({ data: { ...inventoryTemplate, id, companyId, stockCenterId, countedAt,
    isClosed, startedAt: `${countedAt}T10:00:00Z`, closedAt: isClosed ? `${countedAt}T11:00:00Z` : '' } })
}
async function count(id, quantity, extras = {}) {
  return db.appInventoryCountRecord.create({ data: { ...countTemplate, id, companyId, stockCenterId, inventoryId: 9988,
    sessionId: 9988, countedAt: '2026-10-11', storageLocation: 'PRATELEIRA', technicalSheetId: null,
    productId: rawId, technicalSheetName: 'UVA VERDE TESTE', technicalSheetKind: 'PRODUTO', totalCountedUnit: 'GRAM',
    totalCountedQuantity: quantity, closedItemsQuantity: quantity, ...extras } })
}
async function batch(id, quantity = '2') {
  await db.appSalesImportBatchRecord.create({ data: { id, companyId, stockCenterId,
    templateId: null, uploadedByUserId: null, uploadedByUserName: 'TESTE', fileName: `TESTE CASCADE ${id}.xlsx`,
    historyMode: 'FULL_PERIOD', historyMonths: null, coverageDays: 7, safetyMarginPercent: '20', postingMode: 'POST_PENDING',
    status: 'READY_TO_POST', importedAt: new Date().toISOString(), summary: { fixture: true, matchedRows: 1 } } })
  await db.appSalesConsumptionRecord.create({ data: { id, companyId, stockCenterId, consumedAt: '2026-10-15',
    sourceBatchId: id, sourceTechnicalSheetId: 9992, sourceTechnicalSheetKind: 'EXECUCAO', ingredientProductId: 'TESTE-CASCADE-UNITS',
    quantityConsumed: quantity, unit: 'UN', stockPostingStatus: 'PENDING', stockMovementId: null, postedAt: '' } })
}
try {
  await db.appUserRecord.deleteMany({ where: { id: 9988 } })
  for (const table of ['appSalesPostingOperationRecord', 'appSalesPostingSettingsRecord', 'appSalesConsumptionRecord',
    'appSalesImportRowRecord', 'appSalesImportBatchRecord', 'appInventoryCountRecord', 'appInventoryCountSessionRecord',
    'appPendingInventoryMovementRecord', 'appInventoryRecord', 'appAuditLogRecord']) await db[table].deleteMany({ where: { companyId } })
  countTemplate = omitMeta(await db.appInventoryCountRecord.findFirst({ where: { companyId: 13 } }))
  inventoryTemplate = omitMeta(await db.appInventoryRecord.findFirst({ where: { companyId: 13 } }))
  const sourceSheet = omitMeta(await db.appTechnicalSheetRecord.findFirst({ where: { companyId: 13 } }))
  const sourceProduct = omitMeta(await db.appProductRecord.findFirst({ where: { companyId: 13, technicalSheetId: null } }))
  const sourceCompany = omitMeta(await db.appCompanyRecord.findUnique({ where: { id: 13 } }))
  await db.appCompanyRecord.upsert({ where: { id: companyId }, update: {}, create: {
    ...sourceCompany, id: companyId, tradeName: 'TESTE CASCADE', legalName: 'TESTE LOCAL ISOLADO', linkedCompanyIds: [],
  } })
  await db.appProductRecord.upsert({ where: { id: rawId }, update: {}, create: {
    ...sourceProduct, id: rawId, companyId, ownerCompanyId: companyId, name: 'UVA VERDE TESTE', controlUnit: 'GRAM',
    technicalSheetId: null, ignoreStock: false, isActive: true,
  } })
  for (const [id, productId, outputQuantity, outputUnit, ingredientId] of [
    [grapesId, 'TESTE-CASCADE-GRAPES', '500', 'GRAM', rawId], [unitsId, 'TESTE-CASCADE-UNITS', '63', 'UNIT', 'TESTE-CASCADE-GRAPES'],
  ]) {
    const data = { ...sourceSheet, id, productId, companyId, ownerCompanyId: companyId, sharedCompanyIds: [],
      companyProductId: '', name: productId, kind: 'PREPARO', outputQuantity, outputUnit, isActive: true,
      productionCenters: id === grapesId ? [] : [{ stockCenterId }], supplyRoutes: [], yieldDifferenceDestination: '', yieldDifferenceByproductTechnicalSheetId: null,
      ingredients: [{ id: 1, productId: ingredientId, productLabel: ingredientId, quantity: '500', isActive: true }],
      garnishIngredients: [], imageDataUrl: '' }
    await db.appTechnicalSheetRecord.upsert({ where: { id }, create: data, update: data })
  }
  const execution = { ...sourceSheet, id: 9992, companyId, ownerCompanyId: companyId, sharedCompanyIds: [], kind: 'EXECUCAO',
    productId: 'TESTE-CASCADE-EXEC', name: 'PEWEN TESTE', companyProductId: 'PEWEN-TESTE',
    companyProductIdsByCompanyId: { [companyId]: 'PEWEN-TESTE' }, companyProductIdAliasesByCompanyId: { [companyId]: ['PDV-A', 'PDV-B'] },
    outputQuantity: '2', outputUnit: 'MILLILITER', ingredients: [{ id: 1, isActive: true, productId: 'TESTE-CASCADE-UNITS',
      productLabel: 'UVA CONGELADA UNIDADE TESTE', quantity: '2', yieldQuantity: '2' }], garnishIngredients: [],
    productionCenters: [], supplyRoutes: [], imageDataUrl: '' }
  await db.appTechnicalSheetRecord.upsert({ where: { id: 9992 }, create: execution, update: execution })
  await db.appStockCenterRecord.upsert({ where: { id: stockCenterId }, update: {}, create: {
    id: stockCenterId, companyId, name: 'CENTRO TESTE CASCADE', code: 'CASCADE', sector: 'BAR', userIds: [9988], responsibleUserIds: [],
    isProducer: true, producedTechnicalSheetIds: [grapesId, unitsId], distributedProductIds: [], suppliedCenterIds: [],
    minimumStocks: [], salesImportSettings: {},
  } })
  const login = await request('auth/login', { username: 'igarape.aeb', password: 'production-regression-only' }, 'POST', null)
  assert.equal(login.status, 200); token = login.data.token
  await inventory(9988, '2026-10-11'); await count(9988, '1000')
  await batch(9988)
  for (const action of ['posting-details', 'posting-preview', 'posting-confirm', 'posting-reverse']) {
    const result = await request(`sales-import-batches/9988/${action}`, action === 'posting-details' ? undefined : {}, action === 'posting-details' ? 'GET' : 'POST', null)
    assert.equal(result.status, 401)
  }
  console.log('PASS T22 rotas novas exigem autenticacao')
  let p = await preview(9988)
  assert.equal(p.ruleVersion, 'CASCADE_V1.1_COMPOSITION_ONLY')
  assert(p.allocations.some((a) => a.path.some((step) => step.technicalSheetId === grapesId)))
  assert.deepEqual((await db.appTechnicalSheetRecord.findUnique({ where: { id: grapesId } })).productionCenters, [])
  assert.equal(p.settings.enabled, false)
  assert.equal((await confirm(9988, p)).status, 409)
  assert.equal(await db.appSalesPostingOperationRecord.count({ where: { companyId } }), 0)
  const settings = await request('sales-import-batches/9988/posting-settings', { enabled: true, policies: {} }, 'PUT')
  assert.equal(settings.status, 200, JSON.stringify(settings.data))
  p = await preview(9988)
  const beforeMetadata = p.revision
  await db.appInventoryCountRecord.update({ where: { id: 9988 }, data: { packageId: 123n } })
  p = await preview(9988)
  assert.notEqual(p.revision, beforeMetadata)
  const packageRevision = p.revision
  await db.appInventoryCountRecord.update({ where: { id: 9988 }, data: { totalCountedQuantity: '1000' } })
  assert.equal((await preview(9988)).revision, packageRevision)
  await db.appStockCenterRecord.update({ where: { id: stockCenterId }, data: { minimumStocks: [{ suggestedAt: new Date().toISOString() }] } })
  assert.equal((await preview(9988)).revision, packageRevision)
  await db.appStockCenterRecord.update({ where: { id: stockCenterId }, data: { minimumStocks: [] } })
  const baseline = await db.appInventoryCountRecord.count({ where: { companyId } })
  assert.equal(p.allocations.length, 1); assert.equal(await db.appInventoryCountRecord.count({ where: { companyId } }), baseline)
  console.log('PASS simulacao somente leitura; habilitacao por centro desabilitada por padrao')
  await count(9987, '1')
  assert.equal((await confirm(9988, p)).status, 409)
  assert.equal(await db.appSalesPostingOperationRecord.count({ where: { companyId } }), 0)
  p = await preview(9988)
  console.log('PASS T20 saldo alterado invalida a previa')
  const key = crypto.randomUUID()
  const body = { timing, revision: p.revision, idempotencyKey: key, confirmNegativeProducts: true }
  const results = await Promise.all([request('sales-import-batches/9988/posting-confirm', body), request('sales-import-batches/9988/posting-confirm', body)])
  results.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)))
  assert.equal(results[0].data.operation.id, results[1].data.operation.id)
  assert.equal(await db.appInventoryCountRecord.count({ where: { companyId } }), baseline + 2)
  const operation = await db.appSalesPostingOperationRecord.findUnique({ where: { batchId: 9988 } })
  assert.equal(operation.status, 'POSTED'); assert.equal(operation.allocations.length, 1)
  assert(Math.abs(operation.allocations[0].quantity - 1000 / 63) < 1e-7)
  const consumption = await db.appSalesConsumptionRecord.findUnique({ where: { id: 9988 } })
  assert.equal(consumption.quantityConsumed, '2'); assert.equal(consumption.ingredientProductId, 'TESTE-CASCADE-UNITS')
  assert.equal(consumption.stockMovementId, null)
  assert.equal(await db.appAuditLogRecord.count({ where: { companyId, actionKey: 'SALES_CASCADE_CONFIRM' } }), 1)
  console.log('PASS T19 T21 confirmacoes concorrentes/repetidas: uma baixa, uma auditoria e historico analitico preservado')
  const managedBatch = await db.appSalesImportBatchRecord.findUnique({ where: { id: 9988 } })
  assert.equal((await request('sales-import-batches/9988', { ...managedBatch, status: 'READY_TO_POST' }, 'PUT')).status, 409)
  assert.equal((await request('sales-import-batches/9988', undefined, 'DELETE')).status, 409)
  assert.equal((await request('sales-consumptions/9988', { ...consumption, sourceBatchId: 12345 }, 'PUT')).status, 409)
  const allocationRecord = await db.appInventoryCountRecord.findUnique({ where: { id: operation.allocations[0].movementRecordId } })
  assert.equal((await request(`inventory-counts/${allocationRecord.id}`, { ...allocationRecord, totalCountedQuantity: '0' }, 'PUT')).status, 409)
  assert.equal((await request(`inventory-counts/${allocationRecord.id}`, allocationRecord, 'PUT')).status, 200)
  console.log('PASS protecao contra reprocessamento legado e sobrescrita de movimentos auditados')
  await db.appTechnicalSheetRecord.update({ where: { id: unitsId }, data: { outputQuantity: '999' } })
  let reversed = await request('sales-import-batches/9988/posting-reverse', {})
  assert.equal(reversed.status, 200, JSON.stringify(reversed.data))
  const beforeRetry = await db.appInventoryCountRecord.count({ where: { companyId } })
  reversed = await request('sales-import-batches/9988/posting-reverse', {})
  assert.equal(reversed.status, 200); assert.equal(await db.appInventoryCountRecord.count({ where: { companyId } }), beforeRetry)
  let ledger = buildInventoryLedger(await snapshot()); assert.equal(ledger.current.get(`PRODUTO:${rawId}`), 1001)
  await db.appTechnicalSheetRecord.update({ where: { id: unitsId }, data: { outputQuantity: '63' } })
  console.log('PASS T23 estorno usa alocacao original mesmo apos alterar receita; repeticao nao duplica')
  await batch(9989, '1')
  await db.appTechnicalSheetRecord.update({ where: { id: unitsId }, data: { supplyRoutes: [{ consumerCenterId: stockCenterId, supplierCenterId: 999 }] } })
  p = await preview(9989); assert.equal(p.pending[0].reason, 'RECEIPT_REQUIRED')
  assert.equal((await confirm(9989, p)).status, 409)
  let partialResult = await confirm(9989, p, { allowPartial: true }); assert.equal(partialResult.status, 200, JSON.stringify(partialResult.data))
  assert.equal(partialResult.data.operation.status, 'PARTIAL')
  const kept = await db.appSalesPostingOperationRecord.findUnique({ where: { batchId: 9989 } })
  assert.equal(kept.residual[0].quantity, 1); assert.equal(kept.allocations.length, 0)
  await db.appTechnicalSheetRecord.update({ where: { id: unitsId }, data: { supplyRoutes: [] } })
  p = await preview(9989)
  const resumed = await request('sales-import-batches/9989/posting-resume', { timing, revision: p.revision, idempotencyKey: crypto.randomUUID(), confirmNegativeProducts: true })
  assert.equal(resumed.status, 200, JSON.stringify(resumed.data)); assert.equal(resumed.data.operation.status, 'POSTED')
  console.log('PASS T08 T23 pendencia persistida, regularizacao e retomada apenas do residual')
  await batch(9990, '1')
  const openResponse = await request('inventories', { ...inventoryTemplate, id: undefined, companyId, stockCenterId,
    countedAt: '2026-10-16', isClosed: false, startedAt: '2026-10-16T10:00:00Z', closedAt: '' })
  assert.equal(openResponse.status, 200, JSON.stringify(openResponse.data))
  const openInventory = openResponse.data.inventoryRecord
  p = await preview(9990); assert.equal(p.pending[0].reason, 'OPEN_INVENTORY')
  assert.equal((await confirm(9990, p)).status, 200)
  assert.equal((await db.appSalesPostingOperationRecord.findUnique({ where: { batchId: 9990 } })).status, 'WAITING_INVENTORY')
  await db.appInventoryRecord.update({ where: { id: openInventory.id }, data: { isClosed: true, closedAt: '2026-10-16T12:00:00Z' } })
  p = await preview(9990); assert.equal(p.covered.length, 1); assert.equal(p.allocations.length, 0)
  const queued = await request('sales-import-batches/9990/posting-resume', { timing, revision: p.revision, idempotencyKey: crypto.randomUUID() })
  assert.equal(queued.status, 200, JSON.stringify(queued.data)); assert.equal(queued.data.operation.status, 'POSTED')
  ledger = buildInventoryLedger(await snapshot()); assert.equal(ledger.current.get(`PRODUTO:${rawId}`) ?? 0, 0)
  console.log('PASS T17 T18 intencao sobrevive e respeita novo inventario; nao baixa vendas anteriores novamente')
  await db.appInventoryRecord.delete({ where: { id: openInventory.id } })
  await batch(9991, '1')
  p = await preview(9991)
  const beforeFailure = await db.appInventoryCountRecord.count({ where: { companyId } })
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_fail_sales_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId" = ${companyId} AND NEW."actionKey" = 'SALES_CASCADE_CONFIRM' THEN RAISE EXCEPTION 'TEST ROLLBACK'; END IF; RETURN NEW; END; $$`)
  await db.$executeRawUnsafe('CREATE TRIGGER test_sales_audit_rollback BEFORE INSERT ON "AppAuditLogRecord" FOR EACH ROW EXECUTE FUNCTION test_fail_sales_audit()')
  const failed = await confirm(9991, p)
  assert.equal(failed.status, 500)
  assert.equal(await db.appInventoryCountRecord.count({ where: { companyId } }), beforeFailure)
  assert.equal(await db.appSalesPostingOperationRecord.findUnique({ where: { batchId: 9991 } }), null)
  await db.$executeRawUnsafe('DROP TRIGGER test_sales_audit_rollback ON "AppAuditLogRecord"')
  await db.$executeRawUnsafe('DROP FUNCTION test_fail_sales_audit()')
  console.log('PASS T22 falha apos calculo/insercoes reverte movimentos, status, operacao e auditoria juntos')
  await db.appUserRecord.upsert({ where: { id: 9988 }, update: { password: 'cascade-user-test', passwordHash: null }, create: {
    id: 9988, fullName: 'USUARIO TESTE CASCADE', username: 'cascade-user-test', password: 'cascade-user-test',
    role: 'Colaborador', companyId, companyIds: [companyId], sectors: [], sectionAccess: {}, catalogAccess: {}, recipePanelAccess: {},
  } })
  await db.appUserCompanyMembershipRecord.upsert({ where: { userId_companyId: { userId: 9988, companyId } },
    create: { userId: 9988, companyId, role: 'Colaborador', sectors: [], sectionAccess: {}, catalogAccess: {}, recipePanelAccess: {} }, update: {} })
  const userLogin = await request('auth/login', { username: 'cascade-user-test', password: 'cascade-user-test' }, 'POST', null)
  assert.equal(userLogin.status, 200)
  assert.equal((await request('sales-import-batches/9991/posting-preview', { timing }, 'POST', userLogin.data.token)).status, 403)
  assert.equal((await request('sales-import-batches/9991/posting-settings', { enabled: true, policies: {} }, 'PUT', userLogin.data.token)).status, 403)
  console.log('PASS T22 permissao real de modulo/centro e alteracao de politica restrita ao master')
  await db.appUserCompanyMembershipRecord.update({ where: { userId_companyId: { userId: 9988, companyId } }, data: { sectionAccess: { ConfiguracoesEstoque: true } } })
  await db.appStockCenterRecord.update({ where: { id: stockCenterId }, data: { userIds: [] } })
  assert.equal((await request('sales-import-batches/9991/posting-preview', { timing }, 'POST', userLogin.data.token)).status, 200)
  await db.appStockCenterRecord.update({ where: { id: stockCenterId }, data: { userIds: [9988] } })
  const foreign = await db.appSalesImportBatchRecord.findFirst({ where: { companyId: { not: companyId } } })
  if (foreign) assert.equal((await request(`sales-import-batches/${foreign.id}/posting-details`, undefined, 'GET', userLogin.data.token)).status, 403)
  console.log('PASS permissao existente de importar vendas preservada, sem novo vinculo ao centro; outra empresa continua bloqueada')
  await batch(9993, '1'); await batch(9994, '1')
  await count(9986, '1', { technicalSheetId: unitsId, productId: '', technicalSheetKind: 'PREPARO', totalCountedUnit: 'UNIT' })
  await request('sales-import-batches/9993/posting-settings', { enabled: true, policies: { [unitsId]: 'STOCK_ONLY' } }, 'PUT')
  const plans = await Promise.all([preview(9993), preview(9994)])
  const concurrent = await Promise.all(plans.map((plan, index) => confirm(9993 + index, plan)))
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409])
  const losingId = 9993 + concurrent.findIndex((r) => r.status === 409)
  const losingPreview = await preview(losingId)
  assert.equal(losingPreview.allocations.length, 0); assert.equal(losingPreview.pending[0].reason, 'STOCK_ONLY')
  console.log('PASS T19 lotes diferentes concorrentes nao usam a mesma unidade; lote perdedor precisa nova conferencia')
  let release, entered
  const released = new Promise((resolve) => { release = resolve })
  const acquired = new Promise((resolve) => { entered = resolve })
  const holder = db.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(194619801)')
    entered(); await released
  })
  await acquired
  const originalCount = await db.appInventoryCountRecord.findUnique({ where: { id: 9988 } })
  const writer = request('inventory-counts/9988', { ...originalCount, packageId: null, totalCountedQuantity: '1002' }, 'PUT')
  try {
    const racing = await Promise.race([writer.then(() => 'wrote'), new Promise((resolve) => setTimeout(() => resolve('waiting'), 100))])
    assert.equal(racing, 'waiting')
  } finally { release(); await holder }
  assert.equal((await writer).status, 200)
  console.log('PASS escritor legado de estoque participa da mesma trava sem perder o registro')
  await request('sales-import-batches/9991/posting-settings', { enabled: true, policies: {} }, 'PUT')
  await db.appInventoryCountRecord.update({ where: { id: 9988 }, data: { totalCountedQuantity: '0' } })
  p = await preview(9991); assert(p.warnings.length)
  assert.equal((await confirm(9991, p, { confirmNegativeProducts: false })).status, 409)
  console.log('PASS T06 produto negativo exige confirmacao explicita antes de qualquer baixa')
  const sourceBatch = omitMeta(await db.appSalesImportBatchRecord.findUnique({ where: { id: 9991 } }))
  const creates = await Promise.all(['A', 'B'].map((suffix) => request('sales-import-batches', {
    ...sourceBatch, id: 9988, fileName: `ID SERVIDOR ${suffix}.xlsx`, summary: { totalRows: 1 }, __serverAllocateIds: true,
  })))
  creates.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)))
  const allocatedBatch = creates[0].data.batch
  assert.notEqual(allocatedBatch.id, 9988)
  assert.notEqual(allocatedBatch.id, creates[1].data.batch.id)
  assert.equal((await request('sales-import-batches', { ...sourceBatch, id: 9988 })).status, 409)
  const sourceConsumption = omitMeta(await db.appSalesConsumptionRecord.findUnique({ where: { id: 9991 } }))
  const savedConsumption = await request('sales-consumptions', {
    ...sourceConsumption, id: 9988, sourceBatchId: allocatedBatch.id, __serverAllocateIds: true,
  })
  assert.equal(savedConsumption.status, 200, JSON.stringify(savedConsumption.data))
  assert.notEqual(savedConsumption.data.consumption.id, 9988)
  p = await preview(allocatedBatch.id)
  const incomplete = await confirm(allocatedBatch.id, p)
  assert.equal(incomplete.status, 409)
  assert.match(incomplete.data.error, /incompleta/)
  const savedRow = await request('sales-import-rows', { id: 9988, batchId: allocatedBatch.id, companyId, stockCenterId,
    sourceRowKey: 'VENDAS:2', consumedAt: '2026-10-15', companyProductId: 'PDV-A', quantity: '0,5',
    matchedTechnicalSheetId: 9992, matchedKind: 'EXECUCAO', status: 'MATCHED', errorMessage: '', __serverAllocateIds: true })
  assert.equal(savedRow.status, 200, JSON.stringify(savedRow.data))
  assert.equal((await confirm(allocatedBatch.id, await preview(allocatedBatch.id))).status, 200)
  assert.equal((await request(`sales-import-batches/${allocatedBatch.id}/posting-reverse`, {})).status, 200)
  assert.equal((await request(`sales-import-batches/${allocatedBatch.id}`, undefined, 'DELETE')).status, 200)
  assert.equal((await request('sales-import-batches', { ...sourceBatch, id: allocatedBatch.id })).status, 409)
  const next = await request('sales-import-batches', { ...sourceBatch, __serverAllocateIds: true })
  assert.equal(next.status, 200, JSON.stringify(next.data))
  assert(next.data.batch.id > allocatedBatch.id)
  const legacyId = next.data.batch.id + 1
  const compatible = await request('sales-import-batches', { ...sourceBatch, id: legacyId })
  assert.equal(compatible.status, 200, JSON.stringify(compatible.data))
  assert.equal(compatible.data.batch.id, legacyId)
  console.log('PASS IDs gerados no servidor, concorrencia, importacao incompleta bloqueada e IDs arquivados nunca reaproveitados')
  await db.appInventoryCountRecord.update({ where: { id: 9988 }, data: { totalCountedQuantity: '1002' } })
  console.log('PASS API CASCADE: banco local isolado; nenhum dado online foi alterado')
} finally {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_sales_audit_rollback ON "AppAuditLogRecord"').catch(() => {})
  await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_fail_sales_audit()').catch(() => {})
  await db.$disconnect()
}
