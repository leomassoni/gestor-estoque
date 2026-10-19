import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import * as XLSX from 'xlsx'

const base = 'http://127.0.0.1:4001/api'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(60000)
const failures = []
page.on('pageerror', (error) => failures.push(error.message))
const click = (locator) => locator.evaluate((element) => element.click())
const select = (label) => page.locator('label').filter({ hasText: label }).locator('select').first()
let token
async function get(endpoint) {
  const response = await page.request.get(`${base}/${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
  assert.equal(response.status(), 200); return response.json()
}
async function goToImports() {
  await page.getByRole('button', { name: /^Estoque/ }).waitFor()
  await click(page.getByRole('button', { name: /^Estoque/ }))
  await click(page.getByRole('button', { name: 'Importar vendas', exact: true }).first())
  await select('Centro de estoque desta importacao *').waitFor()
}
try {
  const loginResponse = await page.request.post(`${base}/auth/login`, { data: { username: 'igarape.aeb', password: 'production-regression-only' } })
  assert.equal(loginResponse.status(), 200)
  const login = await loginResponse.json(); token = login.token
  await context.addInitScript(({ token, session }) => {
    localStorage.setItem('gestor-estoque:auth', JSON.stringify({ session, authToken: token, currentCompanyId: 9988 }))
    localStorage.setItem('gestor-estoque:auth-token', token)
  }, login)
  await page.goto(process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4001', { waitUntil: 'domcontentloaded' })
  await goToImports()
  const fileName = `CASCADE UI ${Date.now()}.xlsx`
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['DATA', 'CODIGO', 'QUANTIDADE'], ['2026-10-15', 'PDV-A', 1], ['2026-10-15', 'PDV-B', 2],
  ]), 'VENDAS')
  await select('Centro de estoque desta importacao *').selectOption('9988')
  await page.locator('input[type="file"][accept=".xlsx,.xls"]').setInputFiles({ name: fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) })
  await select('Aba da planilha').selectOption('VENDAS')
  await select('Coluna da data').selectOption('A')
  await select('Coluna do identificador').selectOption('B')
  await select('Coluna da quantidade').selectOption('C')
  await select('Tratamento no estoque').selectOption('POST_PENDING')
  await page.waitForFunction(() => document.body.textContent.includes('PEWEN TESTE'))
  await click(page.getByRole('button', { name: 'Registrar importacao', exact: true }))
  await page.getByRole('dialog', { name: 'Registrar importacao de vendas', exact: true }).waitFor()
  await click(page.getByRole('button', { name: 'Confirmar importacao', exact: true }))
  const feedback = page.getByRole('dialog', { name: 'Importacao registrada', exact: true })
  await feedback.waitFor()
  await click(feedback.getByRole('button', { name: 'Fechar', exact: true }))
  const batches = (await get('sales-import-batches?companyId=9988')).batches
  const batch = batches.find((b) => b.fileName === fileName)
  assert(batch)
  const analytic = (await get('sales-consumptions?companyId=9988')).consumptions.filter((c) => c.sourceBatchId === batch.id)
  assert.equal(analytic.length, 2)
  assert.equal(analytic.reduce((sum, c) => sum + Number(c.quantityConsumed.replace(',', '.')), 0), 6)
  const beforeCounts = (await get('inventory-counts?companyId=9988')).inventoryCounts
  const minimumBefore = (await get('stock-centers?companyId=9988')).stockCenters.find((c) => c.id === 9988).minimumStocks
  assert(minimumBefore.some((item) => item.technicalSheetId === 9989), JSON.stringify(minimumBefore))
  console.log('PASS T12 importacao natural XLSX: dois aliases PDV geram 6 unidades e minimo do preparo')
  const row = page.locator('tr').filter({ hasText: fileName }).first()
  await row.scrollIntoViewIfNeeded()
  await click(row.getByRole('button', { name: 'Ver detalhes do lote', exact: true }))
  await click(page.getByRole('button', { name: 'Conferir baixa em cascata', exact: true }))
  let modal = page.getByRole('dialog', { name: 'Baixa de vendas em cascata', exact: true })
  await modal.getByLabel(/Confirmo o consumo consolidado/).waitFor()
  await modal.getByLabel(/Confirmo o consumo consolidado/).check()
  assert(await modal.getByRole('button', { name: 'Salvar parte resolvida e pendencias', exact: true }).isDisabled())
  await click(modal.getByRole('button', { name: 'Atualizar previa', exact: true }))
  await modal.getByRole('button', { name: 'Confirmar baixa', exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('[aria-labelledby="sales-posting-title"]')?.getAttribute('aria-busy')?.includes('true'))
  await modal.getByText('Baixas propostas (2)', { exact: true }).click()
  assert((await modal.textContent()).includes('CONSUMO TEORICO'))
  await page.screenshot({ path: 'tmp/sales-cascade-desktop-preview.png', fullPage: false })
  console.log('PASS previa em painel lazy, caminhos da composicao e confirmacao explicita')
  const negativeConfirmation = modal.getByLabel('Confirmo os saldos negativos dos produtos indicados', { exact: true })
  if (await negativeConfirmation.count()) await negativeConfirmation.check()
  assert(await modal.getByRole('button', { name: 'Confirmar baixa', exact: true }).isEnabled())
  // Simulate the server committing while the browser loses the response.
  let firstPost
  await page.route(`**/sales-import-batches/${batch.id}/posting-confirm`, async (route) => {
    const response = await route.fetch()
    assert.equal(response.status(), 200, await response.text())
    firstPost = await response.json()
    await route.abort('failed')
  }, { times: 1 })
  await click(modal.getByRole('button', { name: 'Confirmar baixa', exact: true }))
  await modal.locator('p[role="alert"]').waitFor()
  assert.equal(firstPost.operation.status, 'POSTED')
  const afterLost = (await get('inventory-counts?companyId=9988')).inventoryCounts
  assert.equal(afterLost.length, beforeCounts.length + 2)
  await click(modal.getByRole('button', { name: 'Confirmar baixa', exact: true }))
  await modal.getByText('Baixa concluida e persistida no banco.', { exact: true }).waitFor()
  const afterRetry = (await get('inventory-counts?companyId=9988')).inventoryCounts
  assert.equal(afterRetry.length, afterLost.length)
  const minimumAfter = (await get('stock-centers?companyId=9988')).stockCenters.find((c) => c.id === 9988).minimumStocks
  const economicMinimum = (items) => items.map(({ suggestedAt, ...item }) => item)
  assert.deepEqual(economicMinimum(minimumAfter), economicMinimum(minimumBefore))
  console.log('PASS T21 resposta perdida apos commit: retry recupera operacao sem duplicar; minimo permanece identico')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'tmp/sales-cascade-mobile-finished.png', fullPage: false })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  assert(await modal.getByRole('button', { name: 'Fechar conferencia', exact: true }).isVisible())
  console.log('PASS T27 modal mobile sem transbordamento horizontal da pagina')
  await click(modal.getByRole('button', { name: 'Fechar conferencia', exact: true }))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.reload({ waitUntil: 'domcontentloaded' }); await goToImports()
  const reloaded = page.locator('tr').filter({ hasText: fileName }).first()
  await reloaded.scrollIntoViewIfNeeded().catch(async (error) => {
    console.log('RELOAD_FAILURE', (await page.locator('main').textContent()).slice(-14000))
    console.log('RELOAD_ERRORS', failures)
    await page.screenshot({ path: 'tmp/sales-reload-failure.png' })
    throw error
  })
  await click(reloaded.getByRole('button', { name: 'Ver detalhes do lote', exact: true }))
  await click(page.getByRole('button', { name: 'Conferir baixa em cascata', exact: true }))
  modal = page.getByRole('dialog', { name: 'Baixa de vendas em cascata', exact: true })
  await modal.getByText('CONCLUIDO', { exact: true }).waitFor()
  assert((await modal.textContent()).includes('Baixas ja persistidas (2)'))
  await click(modal.getByRole('button', { name: 'Fechar conferencia', exact: true }))
  const reversal = page.waitForResponse((r) => r.url().includes(`/sales-import-batches/${batch.id}/posting-reverse`))
  await click(page.getByRole('button', { name: 'Cancelar lote', exact: true }))
  assert.equal((await reversal).status(), 200)
  await page.getByRole('dialog', { name: 'Lote cancelado', exact: true }).waitFor()
  const afterReversal = (await get('inventory-counts?companyId=9988')).inventoryCounts
  const posted = afterReversal.filter((r) => r.recipientLabel.includes(`CASCADE_V1 - LOTE ${batch.id}`))
  assert.equal(posted.length, 4)
  assert(Math.abs(posted.reduce((sum, r) => sum + Number(r.totalCountedQuantity.replace(',', '.')), 0)) < 1e-7)
  assert.equal(failures.length, 0, failures.join('\n'))
  console.log('PASS T23 retomada apos reload e cancelamento pelo frontend estornam as baixas exatas')
} finally { await browser.close() }
