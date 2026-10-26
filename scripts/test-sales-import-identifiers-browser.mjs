import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import * as XLSX from 'xlsx'

const base = 'http://127.0.0.1:4001'
const stamp = Date.now()
let token
async function api(endpoint, body) {
  const response = await fetch(`${base}/api/${endpoint}`, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined })
  const value = await response.json()
  assert.equal(response.status, 200, JSON.stringify(value))
  return value
}
const login = await api('auth/login', { username: 'igarape.aeb', password: 'production-regression-only' })
token = login.token
const fixtureCompanyId = 9988
const { stockCenters } = await api(`stock-centers?companyId=${fixtureCompanyId}`)
const center = stockCenters.find(row => row.id === fixtureCompanyId)
assert(center, 'Executar primeiro test-sales-import-posting.mjs para preparar empresa local isolada')
const source = (await api('technical-sheets?companyId=13&includeImages=false')).technicalSheets.find(sheet => sheet.kind === 'VENDA')
assert(source)
const template = (await api(`technical-sheets/${source.id}`)).technicalSheet
const create = async (name, kind, code, aliases = []) => (await api('technical-sheets', {
  ...template, id: 1, productId: '', companyId: fixtureCompanyId, ownerCompanyId: fixtureCompanyId,
  sharedCompanyIds: [], name: `${name} ${stamp}`, kind, companyProductId: code,
  companyProductIdsByCompanyId: code ? { [fixtureCompanyId]: code } : {},
  companyProductIdAliasesByCompanyId: aliases.length ? { [fixtureCompanyId]: aliases } : {},
  outputQuantity: '1', outputUnit: 'UNIT', portionSize: '1', productionCenters: [], supplyRoutes: [],
  ingredients: [{ id: 1, productId: 'TESTE-CASCADE-RAW', productLabel: 'UVA VERDE TESTE',
    quantity: kind === 'VENDA' ? '2' : '200', yieldQuantity: kind === 'VENDA' ? '2' : '200',
    isActive: true }], garnishIngredients: [], serviceItems: [], isActive: true,
})).technicalSheet
const wrongPrimary = await create('AAA COLISAO PRINCIPAL', 'EXECUCAO', `LEGACY-A-${stamp}`)
const wrongAlias = await create('AAB COLISAO ALIAS', 'EXECUCAO', `LEGACY-B-${stamp}`)
const correct = await create('ZZZ VENDA CORRETA', 'VENDA', String(wrongPrimary.id), [String(wrongAlias.id)])
assert.equal(correct.ingredients.length, 1, 'A receita ficticia precisa ter ingrediente valido')
console.log('FIXTURES', JSON.stringify({ wrong: [wrongPrimary.id, wrongAlias.id], correct: correct.id }))
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ['DATA', 'CODIGO', 'ITEM', 'CONSUMO'],
  ['2026-10-20', String(wrongPrimary.id), correct.name, 2],
  ['2026-10-21', String(wrongAlias.id), correct.name, 3],
  ['2026-10-22', correct.productId, correct.name, 5],
  ['2026-10-23', `SEM-DEPARA-${stamp}`, 'FORA DO ESCOPO', 7],
]), 'Vendas')
const filename = `TESTE PRIORIDADE ID EMPRESA ${stamp}.xlsx`
const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
const before = {
  counts: (await api(`inventory-counts?companyId=${fixtureCompanyId}`)).inventoryCounts,
  sessions: (await api(`inventory-count-sessions?companyId=${fixtureCompanyId}`)).inventoryCountSessions,
  inventories: (await api(`inventories?companyId=${fixtureCompanyId}`)).inventoryRecords,
}
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(180000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true })
const select = label => page.locator('label').filter({ has: page.getByText(label, { exact: true }) }).locator('select')
try {
  await context.addInitScript(({ token, session }) => {
    localStorage.setItem('gestor-estoque:auth', JSON.stringify({ session, authToken: token, currentCompanyId: 9988 }))
    localStorage.setItem('gestor-estoque:auth-token', token)
  }, login)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  console.log('BROWSER_LOADED')
  await page.getByRole('button', { name: /^Estoque/ }).click()
  await button('Importar vendas', page.locator('aside')).click()
  console.log('IMPORT_PANEL_OPEN')
  await select('Centro de estoque desta importacao *').selectOption(String(center.id))
  await page.locator('input[type="file"][accept=".xlsx,.xls"]').setInputFiles({ name: filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer })
  await select('Aba da planilha').selectOption('Vendas')
  await select('Modo da data').selectOption('COLUMN')
  await select('Coluna da data').selectOption('A')
  await select('Coluna do identificador').selectOption('B')
  await select('Coluna da quantidade').selectOption('D')
  await select('Tratamento no estoque').selectOption('ANALYTICAL_ONLY')
  await page.getByLabel('Salvar este mapeamento como template ao registrar a importacao.', { exact: false }).uncheck()
  const preview = page.getByRole('heading', { name: 'Linhas lidas do arquivo', exact: true }).locator('xpath=ancestor::section[1]')
  await preview.getByRole('button', { name: /Linhas validas\s*3$/ }).waitFor({ state: 'visible' })
  const previewRows = await preview.locator('tbody tr').allTextContents()
  assert.equal(previewRows.length, 4)
  assert(previewRows.slice(0, 3).every(row => row.includes(correct.name)))
  assert(previewRows.every(row => !row.includes(wrongPrimary.name) && !row.includes(wrongAlias.name)))
  console.log('PASS navegador: ID empresa e alias numericos selecionam VENDA correta, nao EXECUCAO com mesmo ID de banco')
  await preview.screenshot({ path: 'tmp/sales-identifiers-preview-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  const closeMenu = page.getByRole('button', { name: 'Fechar menu principal', exact: true })
  if (await closeMenu.isVisible()) await closeMenu.click()
  await page.waitForFunction(() => document.querySelector('aside.sidebar').getBoundingClientRect().right <= 1)
  await preview.getByRole('heading', { name: 'Linhas lidas do arquivo', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'tmp/sales-identifiers-preview-mobile.png' })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await button('Registrar importacao').click()
  const confirmation = page.getByRole('dialog', { name: 'Registrar importacao de vendas', exact: true })
  await confirmation.waitFor({ state: 'visible' })
  assert((await confirmation.innerText()).includes('Apenas analise'))
  await button('Confirmar importacao', confirmation).click()
  const feedback = page.locator('.modal-backdrop-front').filter({ has: button('Fechar') })
  await feedback.waitFor({ state: 'visible' })
  const message = await feedback.innerText()
  assert(message.includes('Importacao registrada') && !/Falha|alerta|Erro:|nao foi possivel/i.test(message), message)
  await button('Fechar', feedback).click()
  const batch = (await api(`sales-import-batches?companyId=${fixtureCompanyId}`)).batches.find(row => row.fileName === filename)
  assert.equal(batch.postingMode, 'ANALYTICAL_ONLY')
  assert.equal(batch.status, 'IMPORTED')
  const rows = (await api(`sales-import-rows?companyId=${fixtureCompanyId}`)).rows.filter(row => row.batchId === batch.id)
  const consumptions = (await api(`sales-consumptions?companyId=${fixtureCompanyId}`)).consumptions.filter(row => row.sourceBatchId === batch.id)
  assert.equal(rows.length, 4)
  assert.equal(rows.filter(row => row.status === 'UNMATCHED').length, 1)
  assert(rows.filter(row => row.status === 'MATCHED').every(row => row.matchedTechnicalSheetId === correct.id))
  assert.equal(consumptions.length, 3)
  assert(consumptions.every(row => row.sourceTechnicalSheetId === correct.id && row.stockPostingStatus === 'ANALYTICAL' && !row.stockMovementId))
  assert.equal(consumptions.reduce((sum, row) => sum + Number(row.quantityConsumed.replace(',', '.')), 0), 20)
  assert.deepEqual((await api(`inventory-counts?companyId=${fixtureCompanyId}`)).inventoryCounts, before.counts)
  assert.deepEqual((await api(`inventory-count-sessions?companyId=${fixtureCompanyId}`)).inventoryCountSessions, before.sessions)
  assert.deepEqual((await api(`inventories?companyId=${fixtureCompanyId}`)).inventoryRecords, before.inventories)
  const updatedCenter = (await api(`stock-centers?companyId=${fixtureCompanyId}`)).stockCenters.find(row => row.id === center.id)
  assert(updatedCenter.minimumStocks.some(row => row.productId === 'TESTE-CASCADE-RAW' && row.suggestedAt >= batch.importedAt))
  assert.equal(await page.getByRole('dialog', { name: 'Baixa de vendas em cascata', exact: true }).count(), 0)
  for (const endpoint of ['inventory-counts', 'sales-import-batches', 'technical-sheets', 'users']) {
    assert.equal((await fetch(`${base}/api/${endpoint}`)).status, 401)
  }
  assert.deepEqual(errors, [])
  const result = { batchId: batch.id, fixtureCompanyId, wrongIds: [wrongPrimary.id, wrongAlias.id], correctId: correct.id,
    rows: rows.length, analyticalConsumptions: consumptions.length, consumedGrams: 20, stockMovements: 0,
    minimumUpdated: true, protectedRoutes: true, errors }
  await fs.writeFile('tmp/sales-identifiers-browser-result.json', JSON.stringify(result, null, 2))
  console.log('PASS importacao analitica pelo formulario: IDs do servidor, tres consumos corretos, sem de-para preservado, minimo atualizado e estoque intacto')
  console.log(JSON.stringify(result))
} catch (error) {
  await page.screenshot({ path: 'tmp/sales-identifiers-browser-error.png' }).catch(() => {})
  await fs.writeFile('tmp/sales-identifiers-browser-error.txt', String(error.stack) + '\n' + JSON.stringify(errors) + '\n' + await page.locator('body').innerText().catch(() => ''))
  throw error
} finally { await browser.close() }
