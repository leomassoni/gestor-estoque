import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { parseDecimal } from '../src/utils/core.ts'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../server/node_modules/@prisma/client')
const url = new URL(fs.readFileSync('server/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^['"]|['"]$/g, ''))
url.pathname = '/gestor_estoque_production_regression'
assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Use apenas banco local isolado.')
const db = new PrismaClient({ datasourceUrl: url.toString() })
const base = 'http://127.0.0.1:4001/api'
let token
async function request(endpoint, body, method = 'POST', authenticated = true) {
  const response = await fetch(`${base}/${endpoint}`, {
    method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

function makeSession(startedAt) {
  return { id: 1, inventoryId: null, companyId: 999, stockCenterId: 999,
    countedAt: '2026-10-18', isClosed: true, startedAt, startedByUserId: null,
    startedByUserName: 'TESTE', closedAt: new Date().toISOString(), closedByUserId: null, closedByUserName: 'TESTE' }
}

function makeRecord(quantity, output = false) {
  return { id: 1, sessionId: 1, inventoryId: null, companyId: 999, stockCenterId: 999, countedAt: '2026-10-18',
    storageLocation: output ? 'ENTRADA DE PRODUCAO' : 'SAIDA PARA PRODUCAO', technicalSheetId: output ? 999 : null,
    productId: output ? '' : 'TESTE-PRODUTO', serviceItemId: '', packageId: null,
    technicalSheetName: output ? 'TESTE PRODUCAO' : 'INSUMO TESTE', technicalSheetKind: output ? 'PREPARO' : 'PRODUTO',
    recipientItemId: '', recipientLabel: output ? 'PRODUCAO CONFIRMADA' : 'PRODUCAO INICIADA TESTE',
    closedItemsQuantity: quantity, totalCountedQuantity: quantity, totalCountedUnit: 'MILLILITER',
    hasOpenItems: false, openItemsGrossWeight: '', openItemsContainerQuantity: '', openItemsNetQuantity: '',
    createdByUserId: null, createdByUserName: 'TESTE' }
}

function makeDraft() {
  return { draftId: null, companyId: 999, centerId: 999, sheetId: 999, startedAt: new Date().toISOString(),
    startedByUserId: null, startedByUserName: 'TESTE', desiredYield: '1.000', finalYield: '1.000', byproductYield: '',
    confirmedPh: '', confirmedBrix: '', ingredientOverrides: {}, ingredientConsumptionOverrides: {},
    manualOverrideIngredientIds: [], manualRequestIds: [], consumptionSessionId: null }
}

try {
  for (const [value, expected] of [['0.125', .125], ['0,125', .125], ['0.500', .5], ['1.000', 1000],
    ['-1.000', -1000], ['-2.160', -2160], ['-362.500', -362500], ['-1.066,67', -1066.67], ['-0.125', -.125]]) {
    assert.equal(parseDecimal(value), expected, value)
  }
  console.log('PASS decimais fracionarios e milhares positivos/negativos')
  // The dedicated database is disposable; the company scope avoids touching copied operational records.
  for (const table of ['appProductionOperationRecord', 'appProductionDraftRecord', 'appInventoryCountRecord',
    'appInventoryCountSessionRecord', 'appPendingInventoryMovementRecord', 'appInventoryRecord', 'appAuditLogRecord']) {
    await db[table].deleteMany({ where: { companyId: 999 } })
  }
  await db.appStockCenterRecord.upsert({ where: { id: 999 }, update: {}, create: {
    id: 999, companyId: 999, name: 'TESTE PRODUCAO', code: 'TESTE', sector: 'BAR', userIds: [], responsibleUserIds: [],
    isProducer: true, producedTechnicalSheetIds: [999], distributedProductIds: [], suppliedCenterIds: [],
    minimumStocks: [], salesImportSettings: {},
  } })
  const blankFields = 'companyProductId family subfamily densitySampleVolume densitySampleWeight yieldDifferenceDestination yieldDifferenceByproductName targetPh targetBrix colorTagOne colorTagTwo desiredCmvPercentage dilutionRatePercentage imageDataUrl finalSalePrice flavorSweet flavorSour flavorBitter flavorSalty flavorUmami storytelling salesArguments harmonization preparationMode preparationLeadTimeDays shelfLifeRoom shelfLifeRefrigerated shelfLifeFrozen'.split(' ')
  await db.appTechnicalSheetRecord.upsert({ where: { id: 999 }, update: { targetPh: '', targetBrix: '',
    ingredients: [{ id: 1, isActive: true, productId: 'TESTE-PRODUTO' }] }, create: {
    ...Object.fromEntries(blankFields.map((name) => [name, ''])), id: 999, companyId: 999, ownerCompanyId: 999,
    sharedCompanyIds: [], kind: 'PREPARO', productId: 'TESTE-PREPARO', name: 'TESTE PRODUCAO', sectors: [],
    outputQuantity: '1000', outputUnit: 'MILLILITER', portionSize: '1000', flavorProfileRatings: {},
    productionCenters: [{ stockCenterId: 999 }], supplyRoutes: [],
    ingredients: [{ id: 1, isActive: true, productId: 'TESTE-PRODUTO' }], garnishIngredients: [], serviceItems: [],
  } })
  const login = await request('auth/login', { username: 'igarape.aeb', password: 'production-regression-only' }, 'POST', false)
  assert.equal(login.status, 200); token = login.data.token
  const draft = makeDraft(); const session = makeSession(draft.startedAt)
  const startBody = { draft, session, records: [makeRecord('-1.000'), makeRecord('-0,50')] }
  assert.equal((await request('production-transitions/start', { ...startBody,
    records: [{ ...makeRecord('-1'), productId: 'INSUMO-ANTIGO-FORA-DA-FICHA' }] })).status, 409)
  assert.equal(await db.appProductionDraftRecord.count({ where: { companyId: 999 } }), 0)
  assert.equal((await request('production-transitions/start', startBody, 'POST', false)).status, 401)
  for (const endpoint of ['inventory-counts', 'inventory-count-sessions', 'products', 'users', 'production-drafts']) {
    assert.equal((await request(endpoint, undefined, 'GET', false)).status, 401)
  }
  const starts = await Promise.all([request('production-transitions/start', startBody), request('production-transitions/start', startBody)])
  starts.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)))
  assert.equal(starts[0].data.draft.draftId, starts[1].data.draft.draftId)
  assert.equal(await db.appInventoryCountRecord.count({ where: { companyId: 999 } }), 2)
  const savedDraft = starts[0].data.draft
  assert(savedDraft.consumptionSessionId)
  console.log('PASS inicio concorrente e repetido baixa insumos uma unica vez')
  const finishBody = { draft: savedDraft, session, records: [makeRecord('1.000', true)] }
  await db.appTechnicalSheetRecord.update({ where: { id: 999 }, data: { targetPh: '3,5', targetBrix: '25' } })
  assert.equal((await request('production-transitions/finish', finishBody)).status, 400)
  await db.appTechnicalSheetRecord.update({ where: { id: 999 }, data: { targetPh: '', targetBrix: '' } })
  const invalid = await request('production-transitions/finish', { ...finishBody, records: [makeRecord('0', true)] })
  assert.equal(invalid.status, 400)
  assert.equal(await db.appProductionDraftRecord.count({ where: { companyId: 999 } }), 1)
  const finishes = await Promise.all([request('production-transitions/finish', finishBody), request('production-transitions/finish', finishBody)])
  finishes.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)))
  assert.equal(finishes[0].data.movement.records[0].id, finishes[1].data.movement.records[0].id)
  assert.equal(await db.appInventoryCountRecord.count({ where: { companyId: 999 } }), 3)
  assert.equal(await db.appProductionDraftRecord.count({ where: { companyId: 999 } }), 0)
  assert.equal(await db.appAuditLogRecord.count({ where: { companyId: 999 } }), 2)
  assert.equal((await request(`production-drafts/${savedDraft.draftId}`, savedDraft, 'PUT')).status, 409)
  console.log('PASS conclusao direta, concorrencia, retry, auditoria e bloqueio de ressuscitar rascunho')
  const originalRecords = await db.appInventoryCountRecord.findMany({ where: { companyId: 999 }, orderBy: { id: 'asc' } })
  assert.deepEqual(originalRecords.map((r) => r.totalCountedQuantity), ['-1.000', '-0,50', '1.000'])
  assert.equal(new Set(originalRecords.map((r) => r.id)).size, 3)
  console.log('PASS primeira baixa preservada, sem colisao de ID com a entrada')
  // Older drafts have no operation ledger; their original completion still prevents a second posting.
  await db.appProductionOperationRecord.deleteMany({ where: { companyId: 999 } })
  await db.appProductionDraftRecord.create({ data: {
    ...Object.fromEntries(Object.entries(savedDraft).filter(([key]) => !['id', 'createdAtRecord', 'updatedAt'].includes(key))),
  } })
  const legacyRetry = await request('production-transitions/finish', finishBody)
  assert.equal(legacyRetry.status, 200, JSON.stringify(legacyRetry.data))
  assert.equal(await db.appInventoryCountRecord.count({ where: { companyId: 999 } }), 3)
  assert.equal(await db.appProductionDraftRecord.count({ where: { companyId: 999 } }), 0)
  assert.equal((await request(`production-drafts/${savedDraft.draftId}`, savedDraft, 'PUT')).status, 409)
  console.log('PASS compatibilidade com rascunhos antigos ja concluidos')
  await db.appInventoryRecord.create({ data: { ...makeSession(new Date().toISOString()), id: 999, inventoryId: undefined,
    isClosed: false, closedAt: '', closedByUserId: null, closedByUserName: '' } })
  const queuedDraft = makeDraft()
  const queuedStart = await request('production-transitions/start', { draft: queuedDraft, session: makeSession(queuedDraft.startedAt), records: [makeRecord('-500')] })
  assert.equal(queuedStart.status, 200, JSON.stringify(queuedStart.data))
  assert.equal(queuedStart.data.movement.result, 'queued')
  const queuedFinishBody = { draft: queuedStart.data.draft, session: makeSession(queuedDraft.startedAt), records: [makeRecord('1.000', true)] }
  const queuedFinish = await request('production-transitions/finish', queuedFinishBody)
  assert.equal(queuedFinish.status, 200, JSON.stringify(queuedFinish.data))
  await request('production-transitions/finish', queuedFinishBody)
  assert.equal(await db.appPendingInventoryMovementRecord.count({ where: { companyId: 999 } }), 2)
  assert.equal(await db.appInventoryCountRecord.count({ where: { companyId: 999 } }), 3)
  const pending = await db.appPendingInventoryMovementRecord.findMany({ where: { companyId: 999 } })
  assert.equal(new Set(pending.map((p) => p.session.id)).size, 2)
  console.log('PASS inventario aberto recebe consumo/entrada pendentes uma unica vez, com IDs exclusivos')
  const pendingIds = pending.flatMap((p) => [p.session.id, ...p.records.map((r) => r.id)])
  const countSessions = await Promise.all(['USUARIO ALFA', 'USUARIO BETA'].map((name) => request('inventory-count-sessions', {
    ...makeSession(new Date().toISOString()), inventoryId: 999, isClosed: false, startedByUserName: name,
    closedAt: '', closedByUserName: '',
  })))
  countSessions.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)))
  const sessionA = countSessions[0].data.inventoryCountSession
  const sessionB = countSessions[1].data.inventoryCountSession
  assert.notEqual(sessionA.id, sessionB.id)
  assert(sessionA.id > Math.max(...pendingIds) && sessionB.id > Math.max(...pendingIds))
  const items = await Promise.all([sessionA, sessionB].map((s) => request('inventory-counts', {
    ...makeRecord('10'), inventoryId: 999, sessionId: s.id, storageLocation: 'TESTE', createdByUserName: s.startedByUserName,
  })))
  items.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)))
  assert.notEqual(items[0].data.inventoryCount.id, items[1].data.inventoryCount.id)
  assert(items.every((r) => !pendingIds.includes(r.data.inventoryCount.id)))
  for (const s of [sessionA, sessionB]) {
    assert.equal((await request(`inventory-count-sessions/${s.id}`, { ...s, isClosed: true,
      closedAt: new Date().toISOString(), closedByUserName: s.startedByUserName }, 'PUT')).status, 200)
  }
  const countsInInventory = await db.appInventoryCountRecord.findMany({ where: { inventoryId: 999 } })
  assert.equal(countsInInventory.length, 2)
  assert.deepEqual(new Set(countsInInventory.map((r) => r.createdByUserName)), new Set(['USUARIO ALFA', 'USUARIO BETA']))
  console.log('PASS contagens concorrentes de dois autores preservadas, sem reutilizar IDs reservados para producao pendente')
  await db.appInventoryRecord.update({ where: { id: 999 }, data: { isClosed: true } })
  const originalSheet = await db.appTechnicalSheetRecord.findUnique({ where: { id: 999 } })
  await db.appTechnicalSheetRecord.upsert({ where: { id: 998 }, update: {}, create: {
    ...originalSheet, id: 998, productId: 'TESTE-SUBPRODUTO', name: 'SUBPRODUTO DE TESTE', outputUnit: 'GRAM',
  } })
  await db.appTechnicalSheetRecord.update({ where: { id: 999 }, data: {
    yieldDifferenceDestination: 'BYPRODUCT', yieldDifferenceByproductTechnicalSheetId: 998,
    ingredients: [{ id: 1, isActive: true, productId: 'TESTE-PRODUTO',
      equivalentProducts: [{ productId: 'TESTE-EQUIVALENTE', isActive: true }] }],
  } })
  const byproductDraft = { ...makeDraft(), byproductYield: '25' }
  const equivalentStart = await request('production-transitions/start', {
    draft: byproductDraft, session: makeSession(byproductDraft.startedAt),
    records: [{ ...makeRecord('-10'), productId: 'TESTE-EQUIVALENTE' }],
  })
  assert.equal(equivalentStart.status, 200, JSON.stringify(equivalentStart.data))
  const withByproduct = await request('production-transitions/finish', {
    draft: equivalentStart.data.draft, session: makeSession(byproductDraft.startedAt),
    records: [makeRecord('1.000', true), { ...makeRecord('25', true), technicalSheetId: 998,
      technicalSheetName: 'SUBPRODUTO DE TESTE', totalCountedUnit: 'GRAM', recipientLabel: 'SUBPRODUTO DE PRODUCAO' }],
  })
  assert.equal(withByproduct.status, 200, JSON.stringify(withByproduct.data))
  assert.equal(withByproduct.data.movement.records.length, 2)
  assert.notEqual(withByproduct.data.movement.records[0].id, withByproduct.data.movement.records[1].id)
  console.log('PASS equivalentes, subproduto em unidade distinta, PH/Brix e rejeicao de composicao antiga')
  console.log('ALL PRODUCTION REGRESSION CHECKS PASSED')
} finally {
  await db.$disconnect()
}
