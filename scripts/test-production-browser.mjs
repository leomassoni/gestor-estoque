import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const timurOnly = process.argv.includes('--timur-only')
const sheetName = timurOnly ? 'CORDIAL TIMUR ARTESANAL MADRE' : 'XAROPE SIMPLES'
const desiredYield = timurOnly ? '1000' : '1800'
page.setDefaultTimeout(20000)
page.on('pageerror', (error) => console.log('PAGE_ERROR', error.message))
const click = async (locator) => locator.evaluate((element) => element.click())
const fill = async (locator, value) => locator.evaluate((element, nextValue) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, nextValue)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}, value)
try {
  const loginResponse = await page.request.post('http://127.0.0.1:4001/api/auth/login', {
    data: { username: 'igarape.aeb', password: 'production-regression-only' },
  })
  assert.equal(loginResponse.status(), 200)
  const login = await loginResponse.json()
  await context.addInitScript(({ token, session }) => {
    localStorage.setItem('gestor-estoque:auth', JSON.stringify({ session, authToken: token, currentCompanyId: 13 }))
    localStorage.setItem('gestor-estoque:auth-token', token)
  }, login)
  await page.goto('http://127.0.0.1:4001', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /^Estoque/ }).waitFor()
  await click(page.getByRole('button', { name: /^Estoque/ }))
  await click(page.getByRole('button', { name: 'Entrada de producoes', exact: true }))
  await page.getByRole('button', { name: 'Nova producao', exact: true }).waitFor()
  await page.locator('label').filter({ hasText: 'Centro produtor' }).locator('select').first().selectOption('7')
  console.log('PASS entrada de producoes abre com BAR DE BAIXO')
  await click(page.getByRole('button', { name: 'Nova producao', exact: true }))
  const modal = page.getByRole('dialog').first()
  await modal.waitFor()
  await modal.locator('select').selectOption('7')
  await modal.getByPlaceholder('Digite para pesquisar o pre-preparo').fill(sheetName)
  const option = modal.getByRole('option').filter({ hasText: sheetName }).first()
  await option.dispatchEvent('mousedown')
  await fill(modal.getByLabel('Quantidade final desejada', { exact: true }), desiredYield)
  await click(modal.getByRole('button', { name: 'Entrar producao', exact: true }))
  console.log('PREVIEW', (await page.getByRole('dialog').last().innerText()).slice(0,1100))
  console.log('PREVIEW_BUTTONS', await page.getByRole('dialog').last().getByRole('button').allTextContents())
  await page.screenshot({ path: 'tmp/production-browser-preview.png' })
  await click(page.getByRole('dialog').last().getByRole('button', { name: 'Confirmar entrada de producao', exact: true }))
  await page.waitForFunction(() => !document.getElementById('manual-production-preview-title'))
  await fill(page.getByLabel('Buscar producao', { exact: true }), sheetName)
  const row = page.locator('tr').filter({ has: page.getByText(sheetName, { exact: true }) }).first()
  await row.waitFor()
  await click(row.getByRole('button', { name: 'Produzir', exact: true }))
  const production = page.getByRole('dialog', { name: `Produzir ${sheetName}`, exact: true })
  await production.waitFor()
  await fill(production.getByLabel('Quantidade a produzir', { exact: true }), desiredYield)
  await fill(production.getByLabel('Rendimento final real', { exact: true }), desiredYield)
  const ingredientRows = production.locator('tbody tr')
  const ingredients = await ingredientRows.evaluateAll((rows) => rows.map((r) => ({
    text: r.textContent, values: [...r.querySelectorAll('input')].map((i) => i.value),
  })))
  if (timurOnly) {
    const salt = ingredients.find((r) => /SAL REFINADO/.test(r.text))
    const water = ingredients.find((r) => /AGUA FILTRADA/.test(r.text))
    assert(salt?.values.includes('0,5'), JSON.stringify(salt))
    assert(water?.values.includes('362,5'), JSON.stringify(water))
    console.log('PASS cordial Timur de 1000 ML usa 0,5 G de sal e 362,5 ML de agua')
    await page.screenshot({ path: 'tmp/production-browser-timur.png' })
  } else {
  assert(ingredients.filter((r) => /AGUA FILTRADA|ACUCAR BRANCO/.test(r.text)).every((r) => r.values.includes('1000')),
    JSON.stringify(ingredients))
  console.log('PASS xarope de 1800 ML usa 1000 ML de agua e 1000 G de acucar')
  await click(production.getByRole('button', { name: 'Iniciar', exact: true }))
  const startResponse = page.waitForResponse((r) => r.url().includes('/production-transitions/start') && r.request().method() === 'POST')
  await click(page.getByRole('dialog', { name: 'Iniciar producao', exact: true }).getByRole('button', { name: 'Iniciar', exact: true }))
  const started = await (await startResponse).json()
  assert(started.draft?.draftId, JSON.stringify(started))
  await production.getByRole('button', { name: 'Confirmar producao', exact: true }).waitFor()
  await click(production.getByRole('button', { name: 'Confirmar producao', exact: true }))
  const finishResponse = page.waitForResponse((r) => r.url().includes('/production-transitions/finish') && r.request().method() === 'POST')
  await click(page.getByRole('dialog', { name: 'Confirmar producao', exact: true }).getByRole('button', { name: 'Confirmar producao', exact: true }))
  const response = await finishResponse
  const finished = await response.json()
  assert.equal(response.status(), 200, JSON.stringify(finished))
  assert.equal(finished.draft, null)
  assert.equal(finished.movement.records.length, 1)
  assert.equal(finished.movement.records[0].totalCountedQuantity, '1.800')
  assert(!started.movement.records.some((r) => r.id === finished.movement.records[0].id))
  await production.waitFor({ state: 'detached' })
  console.log('PASS iniciar e concluir diretamente, sem sair e reabrir a producao')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /^Estoque/ }).waitFor()
  await click(page.getByRole('button', { name: /^Estoque/ }))
  await click(page.getByRole('button', { name: 'Entrada de producoes', exact: true }))
  await page.getByRole('button', { name: 'Nova producao', exact: true }).waitFor()
  const draftsResponse = await page.request.get('http://127.0.0.1:4001/api/production-drafts?companyId=13', {
    headers: { Authorization: `Bearer ${login.token}` },
  })
  assert(!(await draftsResponse.json()).productionDrafts.some((d) => d.draftId === started.draft.draftId))
  console.log('PASS recarregar nao reabre a producao concluida')
  await page.screenshot({ path: 'tmp/production-browser-finished.png' })
  await click(page.getByRole('button', { name: 'Inventario', exact: true }))
  await page.getByRole('button', { name: 'Iniciar inventario', exact: true }).waitFor()
  await page.locator('label').filter({ hasText: 'Centro de estoque *' }).locator('select').first().selectOption('7')
  await click(page.getByRole('button', { name: 'Iniciar inventario', exact: true }))
  await page.getByRole('button', { name: 'Iniciar contagem', exact: true }).waitFor()
  await click(page.getByRole('button', { name: 'Iniciar contagem', exact: true }))
  const location = page.getByPlaceholder('Digite para pesquisar ou criar local')
  await location.waitFor()
  await fill(location, 'TESTE REGRESSAO')
  await location.dispatchEvent('keydown', { key: 'Enter' })
  const searchItem = page.getByPlaceholder('Digite para pesquisar produto, pre-preparo ou item')
  await fill(searchItem, 'XAROPE SIMPLES')
  await page.getByRole('option', { name: /^XAROPE SIMPLES/ }).first().dispatchEvent('mousedown')
  const quantity = page.locator('label').filter({ hasText: 'Quantidade de itens fechados *' }).locator('input')
  await fill(quantity, '1')
  const noOpen = page.locator('input[type="radio"][name="inventory-open-items"]').nth(1)
  if (await noOpen.count()) await noOpen.evaluate((e) => e.click())
  const saveItem = page.waitForResponse((r) => /\/api\/inventory-counts$/.test(r.url()) && r.request().method() === 'POST')
  await click(page.getByRole('button', { name: 'Registrar item', exact: true }))
  const savedItemResponse = await saveItem
  const savedItem = (await savedItemResponse.json()).inventoryCount
  assert.equal(savedItemResponse.status(), 200)
  assert.equal(savedItem.technicalSheetId, 595)
  await page.waitForFunction(() => document.body.textContent.includes('XAROPE SIMPLES'))
  console.log('PASS abrir inventario, iniciar contagem e persistir item pela tela')
  const otherSessionResponse = await page.request.post('http://127.0.0.1:4001/api/inventory-count-sessions', {
    headers: { Authorization: `Bearer ${login.token}` }, data: {
      inventoryId: savedItem.inventoryId, companyId: 13, stockCenterId: 7, countedAt: savedItem.countedAt,
      isClosed: false, startedAt: new Date().toISOString(), startedByUserId: 999, startedByUserName: 'SEGUNDO CONTADOR DE TESTE',
      closedAt: '', closedByUserId: null, closedByUserName: '',
    },
  })
  assert.equal(otherSessionResponse.status(), 200)
  const otherSession = (await otherSessionResponse.json()).inventoryCountSession
  const otherItem = await page.request.post('http://127.0.0.1:4001/api/inventory-counts', {
    headers: { Authorization: `Bearer ${login.token}` },
    data: { ...savedItem, id: undefined, sessionId: otherSession.id, totalCountedQuantity: '123',
      closedItemsQuantity: '123', createdByUserId: 999, createdByUserName: 'SEGUNDO CONTADOR DE TESTE' },
  })
  assert.equal(otherItem.status(), 200)
  await click(page.getByRole('button', { name: 'Sair da contagem', exact: true }))
  await click(page.getByRole('button', { name: 'Continuar contagem', exact: true }))
  await page.getByRole('heading', { name: 'Resumo da contagem atual', exact: true }).waitFor()
  await page.waitForFunction(() => document.body.textContent.includes('XAROPE SIMPLES'))
  const refreshed = await page.request.get('http://127.0.0.1:4001/api/inventory-counts?companyId=13', {
    headers: { Authorization: `Bearer ${login.token}` },
  })
  const current = (await refreshed.json()).inventoryCounts
  assert(current.some((r) => r.id === savedItem.id))
  assert(current.some((r) => r.sessionId === otherSession.id))
  console.log('PASS sair, retomar e ver resumo sem descartar a contagem de outro autor')
  await page.screenshot({ path: 'tmp/inventory-production-regression.png' })
  }
} finally {
  await browser.close()
}
