import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../server/node_modules/@prisma/client')
const url = new URL(fs.readFileSync('server/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^['"]|['"]$/g, ''))
assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Teste somente em banco local.')
url.pathname = '/gestor_estoque_production_regression'
const db = new PrismaClient({ datasourceUrl: url.toString() })
const base = 'http://127.0.0.1:4001/api'
let token
const stamp = Date.now()
const created = []
let legacyUserId
let anchorUserId
async function call(endpoint, body, method = body ? 'POST' : 'GET', auth = token) {
  const response = await fetch(`${base}/${endpoint}`, { method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json() }
}
function ok(result) { assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data }
const userBody = (username, companyId) => ({ id: 1, fullName: `TESTE ${username}`.toUpperCase(), username,
  password: 'local-regression-only', companyId, companyIds: [companyId], role: 'Colaborador', sectors: ['BAR'],
  isActive: true, accessProfileId: null, sectionAccess: { Usuarios: true, Inventario: true },
  catalogAccess: {}, recipePanelAccess: {},
})
try {
  token = ok(await call('auth/login', { username: 'igarape.aeb', password: 'production-regression-only' })).token
  const anchor = ok(await call('users', userBody(`ancora-${stamp}`, 9991))).user
  anchorUserId = anchor.id
  const original = await db.appUserRecord.findUnique({ where: { id: anchor.id }, include: { memberships: true } })
  legacyUserId = (await db.appUserRecord.aggregate({ _max: { id: true } }))._max.id + 1000
  const { memberships: _memberships, createdAt: _createdAt, updatedAt: _updatedAt, ...legacy } = original
  await db.appUserRecord.create({ data: { ...legacy, id: legacyUserId, username: `bootstrap-${stamp}`,
    companyId: 9991, companyIds: [9991] } })
  const result = await Promise.all([call('users', { ...userBody(`contadora-${stamp}`, 9991), id: anchor.id }),
    call('users', { ...userBody(`outra-loja-${stamp}`, 9992), id: anchor.id })])
  for (const response of result) created.push(ok(response).user)
  assert.equal(new Set(created.map(u => u.id)).size, 2)
  assert(created.every(u => u.id !== anchor.id))
  assert(created.every(u => u.id > legacyUserId), 'Bootstrap com IDs antigos nao pode causar colisao com a sequencia')
  assert.deepEqual(await db.appUserRecord.findUnique({ where: { id: anchor.id }, include: { memberships: true } }), original)
  const audits = await db.appAuditLogRecord.findMany({ where: { targetType: 'USER', targetId: { in: created.map(u => String(u.id)) } } })
  assert.equal(audits.filter(a => a.actionKey === 'CREATE_USER').length, 2)
  assert(audits.every(a => !/password|local-regression-only|scrypt\$/.test(JSON.stringify(a))))
  console.log('PASS IDs globais concorrentes ignoram ID do cliente, sem sobrescrita; auditoria sem credenciais')
  const otherToken = ok(await call('auth/login', { username: created[1].username, password: 'local-regression-only' })).token
  assert.equal((await call(`users/${created[0].id}`, { ...created[1], id: created[0].id }, 'PUT', otherToken)).status, 403)
  assert.equal((await call(`users/${created[0].id}`, undefined, 'DELETE', otherToken)).status, 403)
  assert.equal((await call('users', userBody(`escopo-invalido-${stamp}`, 9991), 'POST', otherToken)).status, 403)
  const savedHash = (await db.appUserRecord.findUnique({ where: { id: created[1].id } })).passwordHash
  const updated = ok(await call(`users/${created[1].id}`, { ...created[1], password: '', fullName: 'TESTE NOME ATUALIZADO' }, 'PUT')).user
  assert.equal((await db.appUserRecord.findUnique({ where: { id: updated.id } })).passwordHash, savedHash)
  ok(await call(`users/${updated.id}`, { ...updated, password: '', username: `${updated.username}-novo` }, 'PUT'))
  assert.equal((await call('users', undefined, 'GET', otherToken)).status, 401)
  console.log('PASS escopo do usuario anterior, edicao preserva senha e token de outra identidade e invalidado')
  const at = new Date().toISOString()
  const inventory = ok(await call('inventories', { companyId: 9991, stockCenterId: 9991,
    countedAt: '2026-10-25', isClosed: false, startedAt: at, startedByUserId: null, startedByUserName: 'TESTE SEGURANCA',
    closedAt: '', closedByUserId: null, closedByUserName: '' })).inventoryRecord
  const sessionBody = { companyId: 9991, stockCenterId: 9991, inventoryId: inventory.id,
    countedAt: inventory.countedAt, startedAt: at, startedByUserId: created[0].id,
    startedByUserName: created[0].fullName, isClosed: false, closedAt: '', closedByUserId: null, closedByUserName: '' }
  const session = ok(await call('inventory-count-sessions', sessionBody)).inventoryCountSession
  const closed = ok(await call(`inventory-count-sessions/${session.id}`, { ...session, isClosed: true,
    closedAt: at, closedByUserId: created[0].id, closedByUserName: created[0].fullName }, 'PUT')).inventoryCountSession
  assert.equal((await call(`inventory-count-sessions/${session.id}`, session, 'PUT')).status, 409)
  ok(await call(`inventory-count-sessions/${session.id}`, { ...session, __allowReopenClosedSession: true }, 'PUT'))
  ok(await call(`inventories/${inventory.id}/close`, { inventory: { ...inventory, isClosed: true,
    closedAt: at, closedByUserId: null, closedByUserName: 'TESTE SEGURANCA' }, openSessionActions: { [session.id]: 'close' } }))
  assert.equal((await call(`inventory-count-sessions/${session.id}`, { ...session, __allowReopenClosedSession: true }, 'PUT')).status, 409)
  assert.equal((await call('inventory-count-sessions', sessionBody)).status, 409)
  const persisted = await db.appInventoryCountSessionRecord.findUnique({ where: { id: session.id } })
  assert(persisted.isClosed)
  ok(await call(`inventory-count-sessions/${session.id}`, undefined, 'DELETE'))
  assert.equal((await call(`inventory-count-sessions/${session.id}`, closed, 'PUT')).status, 404)
  ok(await call(`inventories/${inventory.id}`, undefined, 'DELETE'))
  for (const endpoint of ['inventory-counts', 'inventory-count-sessions', 'inventories', 'users', 'products']) {
    assert.equal((await call(endpoint, undefined, 'GET', null)).status, 401)
  }
  console.log('PASS fechamento nao ressuscita por sync; explicito apenas enquanto inventario aberto; exclusao nao recria sessao; 401 sem token')
  const recoveryInventory = ok(await call('inventories', { ...inventory, startedAt: new Date().toISOString(),
    startedByUserId: created[1].id, startedByUserName: created[0].fullName })).inventoryRecord
  const recoverySession = ok(await call('inventory-count-sessions', { ...sessionBody, inventoryId: recoveryInventory.id,
    startedByUserId: created[1].id, startedByUserName: created[0].fullName })).inventoryCountSession
  const recoveryCount = ok(await call('inventory-counts', { inventoryId: recoveryInventory.id, sessionId: recoverySession.id,
    companyId: 9991, stockCenterId: 9991, countedAt: '2026-10-25', storageLocation: 'TESTE', technicalSheetId: null,
    productId: 'TESTE-GELO', serviceItemId: '', packageId: null, technicalSheetName: 'GELO TESTE', technicalSheetKind: 'PRODUTO',
    recipientItemId: 'PACKAGE NONE', recipientLabel: 'SEM EMBALAGEM', closedItemsQuantity: '42', totalCountedQuantity: '42',
    totalCountedUnit: 'UNIT', hasOpenItems: false, openItemsGrossWeight: '', openItemsContainerQuantity: '', openItemsNetQuantity: '',
    createdByUserId: created[1].id, createdByUserName: created[0].fullName })).inventoryCount
  const previousUser = await db.appUserRecord.findUnique({ where: { id: created[1].id }, include: { memberships: true } })
  const recoveryBody = { previousUserId: created[1].id, companyId: 9991, expectedUserName: created[0].fullName,
    expectedCountIds: [recoveryCount.id], expectedSessionIds: [recoverySession.id], expectedInventoryIds: [recoveryInventory.id] }
  const contadoraToken = ok(await call('auth/login', { username: created[0].username, password: 'local-regression-only' })).token
  assert.equal((await call(`users/${created[0].id}/recover-inventory-identity`, recoveryBody, 'POST', contadoraToken)).status, 403)
  assert.equal((await call(`users/${created[0].id}/recover-inventory-identity`, { ...recoveryBody, expectedCountIds: [] })).status, 409)
  ok(await call(`users/${created[0].id}/recover-inventory-identity`, recoveryBody))
  const recovered = await db.appInventoryCountRecord.findUnique({ where: { id: recoveryCount.id } })
  const beforeFields = Object.fromEntries(Object.entries(recoveryCount).filter(([k]) => !['updatedAt', 'createdByUserId'].includes(k)))
  const afterFields = Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(recovered, (_, v) => typeof v === 'bigint' ? Number(v) : v))).filter(([k]) => !['updatedAt', 'createdByUserId'].includes(k)))
  assert.deepEqual(afterFields, beforeFields)
  assert.equal(recovered.createdByUserId, created[0].id)
  assert.deepEqual(await db.appUserRecord.findUnique({ where: { id: created[1].id }, include: { memberships: true } }), previousUser)
  assert.equal((await db.appInventoryCountSessionRecord.findUnique({ where: { id: recoverySession.id } })).startedByUserId, created[0].id)
  assert.equal((await db.appInventoryRecord.findUnique({ where: { id: recoveryInventory.id } })).startedByUserId, created[0].id)
  assert(await db.appAuditLogRecord.findFirst({ where: { actionKey: 'RECOVER_USER_INVENTORY_IDENTITY', targetId: String(created[0].id) } }))
  ok(await call(`inventory-count-sessions/${recoverySession.id}`, undefined, 'DELETE'))
  const deletionLog = await db.appAuditLogRecord.findFirst({ where: { actionKey: 'INVENTORY_COUNT_SESSION_DELETED', targetId: String(recoverySession.id) }, orderBy: { id: 'desc' } })
  assert.equal(deletionLog?.details.deletedItemCount, 1)
  assert.equal(deletionLog.details.counts[0].totalCountedQuantity, '42')
  assert.equal((await call(`inventory-counts/${recoveryCount.id}`, recoveryCount, 'PUT')).status, 404)
  ok(await call(`inventories/${recoveryInventory.id}`, undefined, 'DELETE'))
  console.log('PASS recuperacao exclusiva do master, escopo exato, quantidades/datas intactas e usuario de outra empresa inalterado')
  for (const user of created) {
    ok(await call(`users/${user.id}`, undefined, 'DELETE'))
    assert.equal((await call(`users/${user.id}`, { ...user, password: 'nova-senha-teste' }, 'PUT')).status, 404)
    const log = await db.appAuditLogRecord.findFirst({ where: { actionKey: 'DELETE_USER', targetId: String(user.id) } })
    assert(log?.details.before && log.details.after === null)
  }
  console.log('PASS exclusao auditada no servidor e PUT nao recria usuario excluido')
  const next = ok(await call('users', userBody(`apos-exclusao-${stamp}`, 9991))).user
  assert(next.id > Math.max(...created.map(u => u.id)), 'ID excluido nao deve ser reutilizado')
  ok(await call(`users/${next.id}`, undefined, 'DELETE'))
  console.log('PASS sequencia do banco nao reutiliza identidade de usuario excluido')
} finally {
  for (const user of created) await db.appUserRecord.deleteMany({ where: { id: user.id } })
  if (legacyUserId) await db.appUserRecord.deleteMany({ where: { id: legacyUserId } })
  if (anchorUserId) await db.appUserRecord.deleteMany({ where: { id: anchorUserId } })
  await db.$disconnect()
}
