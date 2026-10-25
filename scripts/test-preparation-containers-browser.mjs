import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const { buildInventoryLedger, parseStockDecimal } = require('../server/inventoryLedger.js')
const base = 'http://127.0.0.1:4001'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(90000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
let token
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true, includeHidden: true })
const click = (locator) => locator.first().evaluate((element) => element.click())
const labelInput = (text) => page.locator('label').filter({ hasText: text }).locator('input').first()
async function api(path, body, method = body ? 'POST' : 'GET') {
  const response = await page.request.fetch(`${base}/api/${path}`, { method,
    headers: token ? { Authorization: `Bearer ${token}` } : {}, data: body })
  const json = await response.json()
  assert.equal(response.status(), 200, JSON.stringify(json))
  return json
}
async function choose(input, value) {
  await input.fill(value)
  const option = page.getByRole('option').filter({ hasText: value }).first()
  if (await option.count()) await option.dispatchEvent('mousedown')
}
async function feedback() {
  const front = page.locator('.modal-backdrop-front').filter({ has: button('Fechar') })
  await front.waitFor({ state: 'attached' })
  const text = await front.textContent()
  assert(!/Erro:|Falha ao/.test(text), text)
  await click(button('Fechar', front))
}
try {
  const login = await api('auth/login', { username: 'igarape.aeb', password: 'production-regression-only' })
  token = login.token
  const { technicalSheets } = await api('technical-sheets?companyId=13&includeImages=false')
  const { serviceItems } = await api('service-items?companyId=13')
  const source = technicalSheets.find((sheet) => sheet.id === 595)
  const itemSource = serviceItems.find((item) => item.kind === 'RECIPIENTE_SERVICO') ?? {
    companyProductId: '', manufacturerCode: '', kind: 'RECIPIENTE_SERVICO', controlUnit: 'UNIT',
    family: 'GARRAFA', subfamily: 'VIDRO', sectors: ['BAR'], imageDataUrl: '',
    packages: [{ id: 1, companyPackageId: '', referenceCodes: [], internalCode: 'EMB-001', barcode: '',
      packageQuantity: '1', packageUnit: 'UNIT', grossWeightGrams: '', packagingWeightGrams: '',
      purchasePrice: '10', openingQuantity: '', isActive: true }],
  }
  assert(source && itemSource)
  const stamp = Date.now()
  const recipients = []
  for (const [capacity, tare] of [[700, 180], [1000, 250], [500, 100]]) {
    const item = (await api('service-items', { ...itemSource, id: `REC-TEST-${stamp}-${capacity}`,
      companyId: 13, ownerCompanyId: 13, name: `TESTE RECIPIENTE ${capacity} ${stamp}`,
      sizeValue: String(capacity), sizeUnit: 'MILLILITER', emptyWeight: String(tare), isActive: true })).serviceItem
    recipients.push(item)
  }
  const sheet = (await api('technical-sheets', { ...source, id: 1, productId: `PRE-TEST-${stamp}`,
    name: `TESTE RECIPIENTES PREPARO ${stamp}`, outputQuantity: '900', portionSize: '1000',
    densitySampleVolume: '100', densitySampleWeight: '100',
    serviceItems: recipients.slice(0, 2).map((item, index) => ({ id: index + 1, itemId: item.id, itemLabel: item.name, quantity: '1', isActive: true })),
  })).technicalSheet
  const inventory = (await api('inventories', { companyId: 13, stockCenterId: 7, countedAt: '2026-10-20', isClosed: false,
    startedAt: new Date().toISOString(), startedByUserId: null, startedByUserName: `TESTE RECIPIENTES ${stamp}`,
    closedAt: '', closedByUserId: null, closedByUserName: '' })).inventoryRecord
  assert(inventory)
  await context.addInitScript(({ token: savedToken, session }) => {
    localStorage.setItem('gestor-estoque:auth', JSON.stringify({ session, authToken: savedToken, currentCompanyId: 13 }))
    localStorage.setItem('gestor-estoque:auth-token', savedToken)
  }, login)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  console.log('PASS carga inicial autenticada')
  await click(page.getByRole('button', { name: /^Estoque/, includeHidden: true }))
  await click(button('Inventario', page.locator('aside')))
  await page.getByRole('heading', { name: 'Participar de inventario existente', exact: true }).waitFor({ state: 'attached' })
  if (await button('Sair do inventario').count()) {
    await click(button('Sair do inventario'))
    const leave = page.getByRole('dialog', { name: 'Sair do inventario?', exact: true })
    await click(button('Sair do inventario', leave))
    await feedback()
  }
  const inventoryCard = page.locator('article').filter({ hasText: `TESTE RECIPIENTES ${stamp}` })
  await inventoryCard.waitFor({ state: 'attached' })
  if (await button('Entrar', inventoryCard).count()) { await click(button('Entrar', inventoryCard)); await feedback() }
  await page.waitForLoadState('networkidle')
  await click(button('Iniciar contagem'))
  await feedback()
  if (!await page.getByPlaceholder('Digite para pesquisar produto, pre-preparo ou item').count()) {
    await click(button('Continuar contagem'))
    await feedback()
  }
  await page.getByPlaceholder('Digite para pesquisar produto, pre-preparo ou item').waitFor({ state: 'attached' })
  await page.getByPlaceholder('Digite para pesquisar ou criar local').fill('TESTE RECIPIENTES')
  await page.getByPlaceholder('Digite para pesquisar ou criar local').press('Enter')
  console.log('PASS selecionar inventario e iniciar contagem')

  const saved = []
  for (const scenario of [{ recipient: recipients[0], closed: '1', open: true, expected: 1020 },
    { recipient: recipients[1], closed: '2', open: false, expected: 2000 },
    { recipient: null, closed: '300', open: false, expected: 300 }]) {
    await choose(page.getByPlaceholder('Digite para pesquisar produto, pre-preparo ou item'), sheet.name)
    await page.getByPlaceholder('Selecione o recipiente vinculado a ficha').waitFor({ state: 'attached' })
    if (scenario.recipient) await choose(page.getByPlaceholder('Selecione o recipiente vinculado a ficha'), scenario.recipient.name)
    const quantity = scenario.recipient ? labelInput('Quantidade de itens fechados *') : labelInput('Quantidade (ML) *')
    await quantity.fill(scenario.closed)
    const openRadio = page.locator(`input[name="inventory-open-items"]`).nth(scenario.open ? 0 : 1)
    await click(openRadio)
    if (scenario.open) {
      await labelInput('Peso total pesado dos itens abertos (g) *').fill('500')
      await labelInput('Quantidade de itens abertos pesados *').fill('1')
    }
    const response = page.waitForResponse((res) => res.url().endsWith('/api/inventory-counts') && res.request().method() === 'POST')
    await click(button('Registrar item'))
    const result = await response
    assert.equal(result.status(), 200, await result.text())
    const record = (await result.json()).inventoryCount
    assert.equal(record.technicalSheetId, sheet.id)
    assert.equal(parseStockDecimal(record.totalCountedQuantity), scenario.expected)
    saved.push(record)
    await feedback()
    console.log('PASS registro persistido', { recipient: record.recipientLabel, quantity: record.totalCountedQuantity })
  }
  const otherSession = (await api('inventory-count-sessions', { companyId: 13, stockCenterId: 7,
    inventoryId: inventory.id, countedAt: '2026-10-20', isClosed: true, startedAt: new Date().toISOString(),
    closedAt: new Date().toISOString(), startedByUserId: 999, closedByUserId: 999,
    startedByUserName: 'OUTRO CONTADOR TESTE', closedByUserName: 'OUTRO CONTADOR TESTE' })).inventoryCountSession
  const otherRecord = (await api('inventory-counts', { ...saved[2], id: undefined, sessionId: otherSession.id,
    closedItemsQuantity: '123', totalCountedQuantity: '123', createdByUserId: 999, createdByUserName: 'OUTRO CONTADOR TESTE' })).inventoryCount
  console.log('PASS contagem independente de outro usuario persistida')
  await click(button('Sair da contagem'))
  await feedback()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await click(page.getByRole('button', { name: /^Estoque/, includeHidden: true }))
  await click(button('Inventario', page.locator('aside')))
  const rejoin = page.locator('article').filter({ hasText: `TESTE RECIPIENTES ${stamp}` })
  await rejoin.waitFor({ state: 'attached' })
  if (await button('Entrar', rejoin).count()) { await click(button('Entrar', rejoin)); await feedback() }
  await click(button('Continuar contagem'))
  await feedback()
  await page.getByRole('heading', { name: 'Resumo da contagem atual', exact: true }).waitFor({ state: 'attached' })
  const counts = (await api('inventory-counts?companyId=13')).inventoryCounts
  for (const record of [...saved, otherRecord]) assert(counts.some((item) => item.id === record.id))
  const countSummary = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Resumo da contagem atual', exact: true }) })
  const directRow = countSummary.locator('tr').filter({ has: page.locator('select option[value="PREPARO NONE"]:checked') })
  assert.equal(await directRow.count(), 1)
  assert((await directRow.textContent()).includes('300 ML'))
  console.log('PASS sair/recarregar/retomar com tres recipientes e outro usuario preservado')
  await page.getByRole('heading', { name: 'Resumo da contagem atual', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'tmp/containers-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('heading', { name: 'Resumo da contagem atual', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'tmp/containers-mobile.png', animations: 'disabled' })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Pagina excede viewport mobile')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await click(button('Finalizar inventario').first())
  const review = page.getByRole('dialog', { name: 'Revisao das contagens do inventario', exact: true })
  await review.waitFor({ state: 'attached' })
  assert((await review.textContent()).includes('OUTRO CONTADOR TESTE'))
  const closeCheck = review.getByLabel('Fechar e consolidar', { exact: true })
  if (await closeCheck.count() && !await closeCheck.first().isChecked()) await click(closeCheck)
  await click(button('Finalizar inventario', review))
  await feedback()
  const closed = (await api('inventories?companyId=13')).inventoryRecords.find((item) => item.id === inventory.id)
  assert(closed.isClosed)
  const consolidated = (await api('inventory-counts?companyId=13')).inventoryCounts.filter((item) => item.inventoryId === inventory.id)
  const sessions = (await api('inventory-count-sessions?companyId=13')).inventoryCountSessions
  const ledger = buildInventoryLedger({ inventories: [closed], sessions, counts: consolidated })
  assert.equal(ledger.current.get(`PREPARO:${sheet.id}`), 3443)
  assert(consolidated.some((item) => item.id === otherRecord.id))
  console.log('PASS consolidacao multiusuario: 1020 + 2000 + 300 + 123 = 3443 ML')
  await click(page.getByRole('button', { name: /^Cadastros/, includeHidden: true }))
  await click(button('Fichas Tecnicas', page.locator('aside')))
  await page.getByPlaceholder('Busque por nome, ID interno ou ID da empresa').fill(sheet.name)
  const sheetRow = page.locator('tr').filter({ hasText: sheet.name })
  await sheetRow.waitFor({ state: 'attached' })
  await click(sheetRow.locator('button[aria-label*="Editar"]').first())
  const storage = page.locator('.ingredient-stack').filter({ has: page.getByRole('heading', { name: 'Recipientes de armazenamento', exact: true }) }).first()
  await storage.waitFor({ state: 'attached' })
  await click(button('Adicionar recipiente de armazenamento', storage))
  const recipientInput = storage.getByPlaceholder('DIGITE O RECIPIENTE')
  await recipientInput.focus()
  await storage.getByRole('listbox').waitFor()
  assert(await storage.getByRole('option', { name: recipients[0].name, exact: true }).count())
  await recipientInput.fill(recipients[2].name.slice(6).toLowerCase())
  await storage.getByRole('option', { name: recipients[2].name, exact: true }).waitFor()
  await recipientInput.press('ArrowDown')
  await recipientInput.press('Enter')
  await click(button('Confirmar', storage))
  await storage.getByPlaceholder('DIGITE O RECIPIENTE').fill(`NOVO RECIPIENTE TESTE ${stamp}`)
  await storage.getByPlaceholder('DIGITE O RECIPIENTE').press('Tab')
  await click(button('Cadastrar', storage))
  const createRecipient = page.getByRole('dialog', { name: 'Cadastrar recipiente pela ficha tecnica', exact: true })
  await createRecipient.waitFor({ state: 'attached' })
  assert(await createRecipient.getByText('Volume', { exact: true }).count())
  await click(button('Fechar', createRecipient))
  await storage.getByPlaceholder('DIGITE O RECIPIENTE').fill('')
  const saveSheet = page.waitForResponse((res) => res.url().endsWith(`/api/technical-sheets/${sheet.id}`) && res.request().method() === 'PUT')
  await click(button('Salvar'))
  assert.equal((await saveSheet).status(), 200)
  await feedback()
  const updated = (await api(`technical-sheets/${sheet.id}`)).technicalSheet
  assert.equal(updated.serviceItems.length, 3)
  assert(updated.serviceItems.some((item) => item.itemId === recipients[2].id))
  console.log('PASS sugestoes ao focar, filtro maiusculo, selecao por teclado, terceiro vinculo e cadastro inline com Volume')
  for (const path of ['inventory-counts', 'inventory-count-sessions', 'service-items', 'technical-sheets']) {
    assert.equal((await page.request.get(`${base}/api/${path}`)).status(), 401)
  }
  assert.deepEqual(errors, [])
  fs.writeFileSync('tmp/containers-browser-result.json', JSON.stringify({ inventoryId: inventory.id, sheetId: sheet.id,
    recipients: recipients.map((item) => item.id), total: 3443, errors }, null, 2))
} catch (error) {
  console.error('TEST_FAILURE', error)
  await page.screenshot({ path: 'tmp/containers-browser-error.png' }).catch(() => {})
  console.log('UI_STATE', await page.locator('body').textContent({ timeout: 5000 }).then((value) => value.slice(-14000)).catch(() => 'unavailable'))
  throw error
} finally { await browser.close() }
