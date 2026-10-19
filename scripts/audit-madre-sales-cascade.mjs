import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import * as XLSX from 'xlsx'

const require = createRequire(import.meta.url)
const { planSalesConsumption, RULE_VERSION } = require('../server/salesConsumptionPlanner')
const { buildInventoryLedger } = require('../server/inventoryLedger')
const base = 'https://gestor-estoque-zqw9.onrender.com/api'
const companyId = 13, centerId = 7
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const fingerprint = (rows) => createHash('sha256').update(JSON.stringify(rows.slice().sort((a, b) => a.id - b.id))).digest('hex')
const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: process.env.GESTOR_SYSTEM_ADMIN_USERNAME || 'igarape.aeb', password: process.env.GESTOR_SYSTEM_ADMIN_PASSWORD }) })
assert.equal(login.status, 200, 'Informe credenciais autorizadas nas variaveis GESTOR_SYSTEM_ADMIN_*.')
const { token } = await login.json()
async function get(endpoint, envelope) {
  const response = await fetch(`${base}/${endpoint}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  assert.equal(response.status, 200, endpoint)
  const value = (await response.json())[envelope]
  assert(Array.isArray(value), `Envelope invalido: ${envelope}`)
  return value
}
const centers = await get(`stock-centers?companyId=${companyId}`, 'stockCenters')
const center = centers.find((c) => c.id === centerId && c.companyId === companyId)
assert(center, 'Centro/empresa nao encontrados.')
const sheets = await get(`technical-sheets?companyId=${companyId}&includeImages=false`, 'technicalSheets')
const products = await get(`products?companyId=${companyId}&includeImages=false`, 'products')
const inventories = (await get(`inventories?companyId=${companyId}`, 'inventoryRecords')).filter((r) => r.stockCenterId === centerId)
const sessions = (await get(`inventory-count-sessions?companyId=${companyId}`, 'inventoryCountSessions')).filter((r) => r.stockCenterId === centerId)
const counts = (await get(`inventory-counts?companyId=${companyId}`, 'inventoryCounts')).filter((r) => r.stockCenterId === centerId)
const pendingMovements = (await get(`pending-inventory-movements?companyId=${companyId}`, 'pendingInventoryMovements')).filter((r) => r.stockCenterId === centerId)
const batches = (await get(`sales-import-batches?companyId=${companyId}`, 'batches')).filter((r) => r.stockCenterId === centerId)
const rows = (await get(`sales-import-rows?companyId=${companyId}`, 'rows')).filter((r) => r.stockCenterId === centerId)
const companies = await get('companies', 'companies')
const scope = new Set([companyId])
for (let changed = true; changed;) {
  changed = false
  for (const company of companies) for (const linked of company.linkedCompanyIds ?? []) {
    if (scope.has(company.id) || scope.has(linked)) for (const id of [company.id, linked]) {
      if (!scope.has(id)) { scope.add(id); changed = true }
    }
  }
}
const visibleSheets = sheets.filter((s) => (s.ownerCompanyId ?? s.companyId) === companyId ||
  ((s.sharedCompanyIds ?? []).includes(companyId) && scope.has(s.ownerCompanyId ?? s.companyId)))
const unitSheet = visibleSheets.find((s) => s.id === 591)
assert(unitSheet?.isActive, 'Conversao de uva unidade ausente/inativa.')
const inputs = { companyId, center, sheets, products, inventories, sessions, counts, pendingMovements,
  catalogCompanyIds: [...scope], validateSources: true, timing: { dayEndConfirmed: true },
  demands: [{ id: 'SIMULACAO-NAO-PERSISTIDA', sourceTechnicalSheetId: 622, productId: unitSheet.productId,
    quantity: 2, unit: 'UN', consumedAt: today }] }
const actual = planSalesConsumption(inputs)
const controlled = planSalesConsumption({ ...inputs, counts: counts.filter((r) => ![460, 591].includes(r.technicalSheetId)) })
assert.equal(controlled.pending.length, 0, JSON.stringify(controlled.pending))
assert(Math.abs(controlled.allocations.reduce((sum, r) => sum + r.quantity, 0) - 1000 / 63) < 1e-7)
assert(controlled.allocations.every((r) => r.kind === 'PRODUTO'))
const generated = new Set(visibleSheets.filter((s) => ['BYPRODUCT', 'RETURN_TO_STOCK'].includes(s.yieldDifferenceDestination))
  .map((s) => s.yieldDifferenceByproductTechnicalSheetId))
const conversions = visibleSheets.filter((s) => s.isActive && s.kind === 'PREPARO' && !s.productionCenters.length).map((s) => ({
  'ID ficha': s.id, 'ID interno': s.productId, Ficha: s.name,
  'Empresa origem cadastro': s.ownerCompanyId ?? s.companyId,
  'Regra sem saldo': generated.has(s.id) ? 'SUBPRODUTO/RETORNO: REGULARIZAR GERADOR'
    : s.supplyRoutes.some((r) => r.consumerCenterId === centerId && r.supplierCenterId && r.supplierCenterId !== centerId)
      ? 'RECEBIMENTO EXTERNO OBRIGATORIO' : 'CASCATA PELA COMPOSICAO',
  'Rendimento base': s.outputQuantity, Unidade: s.outputUnit,
  'Consumida por': visibleSheets.filter((parent) => [...parent.ingredients, ...parent.garnishIngredients]
    .some((i) => i.isActive && i.productId === s.productId)).map((parent) => parent.name).join(' | '),
}))
const ledger = buildInventoryLedger({ inventories, sessions, counts })
const negativePreps = [...ledger.current].filter(([key, quantity]) => /^(PREPARO|PRODUTO_INTERNO):/.test(key) && quantity < -1e-8)
  .map(([key, quantity]) => {
    const id = Number(key.split(':')[1])
    const sheet = visibleSheets.find((s) => s.id === id)
    return { 'ID ficha': id, Ficha: sheet?.name ?? key, 'Saldo real': quantity, Unidade: sheet?.outputUnit ?? '',
      Observacao: 'DIVERGENCIA PREEXISTENTE. NAO CORRIGIDA POR ESTA AUDITORIA.' }
  })
const output = process.env.GESTOR_CASCADE_AUDIT_OUTPUT || path.join(os.homedir(), 'Downloads', `Madre - validacao baixa em cascata - ${today}.xlsx`)
const workbook = XLSX.utils.book_new()
function add(name, data) {
  const worksheet = XLSX.utils.json_to_sheet(data.length ? data : [{ Resultado: 'SEM REGISTROS' }])
  worksheet['!cols'] = Object.keys(data[0] ?? {}).map((key) => ({ wch: Math.min(75, Math.max(18, key.length + 4)) }))
  if (worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] }
  XLSX.utils.book_append_sheet(workbook, worksheet, name)
}
add('Resumo', [
  { Parametro: 'Empresa / centro', Valor: `13 / 7 - CASA DE MI MADRE / ${center.name}` },
  { Parametro: 'Regra simulada', Valor: RULE_VERSION },
  { Parametro: 'Ultimo inventario fechado', Valor: ledger.latestInventory?.date ?? 'SEM INVENTARIO' },
  { Parametro: 'Data hipotetica de consumo', Valor: today },
  { Parametro: 'Escopo', Valor: 'SIMULACAO DE 2 UN DE UVA. NAO E VENDA REAL, POSTAGEM OU CORRECAO DE SALDO.' },
  { Parametro: 'Cenario controlado', Valor: 'IGNORA SOMENTE OS SALDOS DAS FICHAS 460/591 EM MEMORIA; NAO ALTERA O BANCO.' },
  { Parametro: 'Resultado esperado controlado G', Valor: 1000 / 63 },
  { Parametro: 'Conversoes/preparos sem fila', Valor: conversions.length },
  { Parametro: 'Preparos com negativo anterior', Valor: negativePreps.length },
])
for (const [name, plan] of [['Saldo real', actual], ['Cenario sem intermediarios', controlled]]) {
  add(name, [...plan.allocations.map((r) => ({ Resultado: 'BAIXA SIMULADA', Item: r.name, Quantidade: r.quantity, Unidade: r.unit,
    Antes: r.balanceBefore, Depois: r.balanceAfter, Caminho: r.path.map((p) => p.name).join(' > ') })),
  ...plan.pending.map((r) => ({ Resultado: r.reason, Item: r.sourceName, Quantidade: r.quantity, Unidade: r.unit, Caminho: r.message }))])
}
add('Sem centro produtor', conversions)
add('Negativos preexistentes', negativePreps)
add('Lotes existentes', batches.map((batch) => {
  const dates = rows.filter((r) => r.batchId === batch.id).map((r) => r.consumedAt.slice(0, 10)).sort()
  return { Lote: batch.id, Arquivo: batch.fileName, Status: batch.status, 'Primeira data declarada': dates[0] ?? '',
    'Ultima data declarada': dates.at(-1) ?? '',
    Observacao: dates.at(-1) < ledger.latestInventory?.date ? 'ANTERIOR AO INVENTARIO: NAO BAIXAR NOVAMENTE' : 'CONFERIR PERIODO ANTES DE POSTAR' }
}))
const after = (await get(`inventory-counts?companyId=${companyId}`, 'inventoryCounts')).filter((r) => r.stockCenterId === centerId)
assert.equal(fingerprint(after), fingerprint(counts), 'Houve mudanca concorrente nas contagens; refaca a fotografia.')
XLSX.writeFile(workbook, output)
const backupDirectory = path.join('backups', `madre-sales-cascade-${Date.now()}`)
fs.mkdirSync(backupDirectory, { recursive: true })
fs.writeFileSync(path.join(backupDirectory, 'simulation.json'), JSON.stringify({ at: new Date().toISOString(), ruleVersion: RULE_VERSION,
  companyId, centerId, countFingerprint: fingerprint(counts), countRecords: counts.length, actual, controlled, negativePreps }, null, 2))
console.log(JSON.stringify({ output, backupDirectory, ruleVersion: RULE_VERSION, countRecords: counts.length,
  countFingerprint: fingerprint(counts), actualPending: actual.pending.map((r) => ({ reason: r.reason, message: r.message })),
  controlledQuantityG: controlled.allocations.reduce((sum, r) => sum + r.quantity, 0), conversions: conversions.length,
  negativePreps, activeBatchIds: batches.filter((b) => b.status !== 'CANCELLED').map((b) => b.id) }, null, 2))
