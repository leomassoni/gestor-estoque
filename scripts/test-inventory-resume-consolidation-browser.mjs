import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'
const require = createRequire(import.meta.url)
const { buildInventoryLedger } = require('../server/inventoryLedger.js')
const base = 'http://127.0.0.1:4001'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(180000)
const pending = new Map()
const errors = []
page.on('request', r => pending.set(r.url(), Date.now()))
page.on('requestfinished', r => { const start = pending.get(r.url()); pending.delete(r.url()); if (/assets\//.test(r.url())) console.log('ASSET', r.url().split('/').at(-1), Date.now()-start) })
page.on('requestfailed', r => { pending.delete(r.url()); console.log('REQUEST_FAILED', r.url(), r.failure()) })
page.on('pageerror', e => { errors.push(e.message); console.log('PAGE_ERROR', e.message) })
page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE_ERROR', msg.text().slice(0,300)) })
let token
async function api(endpoint, body) {
  const response = await page.request.fetch(`${base}/api/${endpoint}`, { method: body ? 'POST' : 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {}, data: body })
  assert.equal(response.status(), 200, await response.text())
  return response.json()
}
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true, includeHidden: true })
const click = locator => locator.first().evaluate(e => e.click())
async function feedback() {
  const front = page.locator('.modal-backdrop-front').filter({ has: button('Fechar') })
  await front.waitFor({ state: 'attached' })
  assert(!/Erro:|Falha ao/.test(await front.textContent()))
  await click(button('Fechar', front))
}
try {
  const login = await api('auth/login', { username: 'igarape.aeb', password: 'production-regression-only' }); token = login.token
  const inventory = (await api('inventories?companyId=13')).inventoryRecords.filter(i => !i.isClosed && /^TESTE RECIPIENTES/.test(i.startedByUserName))
    .sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0]
  assert(inventory)
  const before = (await api('inventory-counts?companyId=13')).inventoryCounts.filter(c => c.inventoryId === inventory.id)
  assert.equal(before.length, 6)
  await context.addInitScript(({ token: savedToken, session }) => {
    localStorage.setItem('gestor-estoque:auth', JSON.stringify({ session, authToken: savedToken, currentCompanyId: 13 }))
    localStorage.setItem('gestor-estoque:auth-token', savedToken)
  }, login)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await click(page.getByRole('button', { name: /^Estoque/, includeHidden: true }))
  await click(button('Inventario', page.locator('aside')))
  const card = page.locator('article').filter({ hasText: inventory.startedByUserName })
  await card.waitFor({ state: 'attached' })
  if (await button('Entrar', card).count()) { await click(button('Entrar', card)); await feedback() }
  if (await button('Continuar contagem').count()) { await click(button('Continuar contagem')); await feedback() }
  await page.getByRole('heading', { name: 'Resumo da contagem atual', exact: true }).waitFor({ state: 'attached' })
  console.log('PASS retomada do mesmo inventario e seis registros preservados incluindo outro usuario')
  await page.getByRole('heading', { name: 'Resumo da contagem atual', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'tmp/inventory-safety-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'tmp/inventory-safety-mobile.png', animations: 'disabled' })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await click(button('Finalizar inventario').first())
  const review = page.getByRole('dialog', { name: 'Revisao das contagens do inventario', exact: true })
  await review.waitFor({ state: 'attached' })
  assert((await review.textContent()).includes('OUTRO CONTADOR TESTE'))
  const close = review.getByLabel('Fechar e consolidar', { exact: true })
  if (await close.count() && !await close.first().isChecked()) await click(close)
  await click(button('Finalizar inventario', review)); await feedback()
  const closed = (await api('inventories?companyId=13')).inventoryRecords.find(i => i.id === inventory.id)
  const sessions = (await api('inventory-count-sessions?companyId=13')).inventoryCountSessions
  const after = (await api('inventory-counts?companyId=13')).inventoryCounts.filter(c => c.inventoryId === inventory.id)
  assert(closed.isClosed)
  assert.deepEqual(after, before)
  const ledger = buildInventoryLedger({ inventories: [closed], sessions, counts: after })
  const prep = before.find(c => c.technicalSheetKind === 'PREPARO')
  const product = before.find(c => c.technicalSheetKind === 'PRODUTO')
  assert.equal(ledger.current.get(`PREPARO:${prep.technicalSheetId}`), 3443)
  assert.equal(ledger.current.get(`PRODUTO:${product.productId}`), 342)
  assert.deepEqual(errors, [])
  fs.writeFileSync('tmp/inventory-safety-browser-result.json', JSON.stringify({ inventoryId: inventory.id, prepTotal: 3443, productTotal: 342, records: after.length, errors }, null, 2))
  console.log('PASS consolidacao real pelo frontend: 3443 ML, 342 UN, dois autores, seis registros sem alteracao')
} catch(error) {
  console.error(error)
  console.log('PENDING', [...pending].map(([url,start])=>({url,elapsed:Date.now()-start})))
  console.log('BODY', (await page.locator('body').textContent()).slice(-10000))
  throw error
} finally { await browser.close() }
