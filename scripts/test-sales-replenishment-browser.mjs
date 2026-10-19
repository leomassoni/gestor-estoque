import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'
import * as XLSX from 'xlsx'
import { inventoryPollingSections } from '../src/config/performance.ts'

assert(inventoryPollingSections.includes('Requisicoes') && inventoryPollingSections.includes('Suprimentos'))

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../server/node_modules/@prisma/client')
const { buildInventoryLedger, parseStockDecimal } = require('../server/inventoryLedger')
const { lockedTransaction, nextInventoryMovementId } = require('../server/production')
const url = new URL(fs.readFileSync('server/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^['"]|['"]$/g, ''))
assert(['localhost', '127.0.0.1'].includes(url.hostname))
url.pathname = '/gestor_estoque_production_regression'
const db = new PrismaClient({ datasourceUrl: url.toString() })
const consumerCompany = 9986, supplierCompany = 9986, consumerCenter = 9986, supplierCenter = 9985
const remoteCompany = 9984, remoteCenter = 9983, sharedPrepId = 9984
const rawId = 'TESTE-REPOSICAO-UVA', executionId = 9987
const base = 'http://127.0.0.1:4001'
const browser = await chromium.launch({ headless: true })
let context, page, token, login
const errors = []
const clean = ({ createdAt, createdAtRecord, updatedAt, ...record }) => record
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true, includeHidden: true })
const click = (locator) => locator.first().evaluate((e) => e.click())
const select = (name) => page.locator('label').filter({ hasText: name }).locator('select').first()
async function api(endpoint, body) {
  const response = await fetch(`${base}/api/${endpoint}`, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined })
  assert.equal(response.status, 200, `${endpoint}: ${await response.clone().text()}`)
  return response.json()
}
async function waitFor(get, test, label) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const value = await get()
    if (test(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw Error(`Timeout: ${label}`)
}
async function company(id) {
  if (context) await context.close()
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
  await context.addInitScript(({ token, session, id }) => {
    localStorage.setItem('gestor-estoque:auth', JSON.stringify({ session, authToken: token, currentCompanyId: id }))
    localStorage.setItem('gestor-estoque:auth-token', token)
  }, { ...login, id })
  page = await context.newPage()
  page.setDefaultTimeout(45000)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') console.log('BROWSER_ERROR', message.text()) })
  page.on('response', async (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      const failure = `${response.status()} ${response.url()} ${await response.text().catch(() => '')}`
      errors.push(failure); console.log('API_FAILURE', failure)
    }
  })
  const restored = page.waitForResponse((response) => response.url().endsWith('/api/auth/session') && response.status() === 200)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await restored
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await click(page.getByRole('button', { name: /^Estoque/, includeHidden: true }))
}
async function navigate(name) {
  const sidebar = page.locator('aside').first()
  if (!await button(name, sidebar).count()) await click(page.getByRole('button', { name: /^Estoque/, includeHidden: true }))
  await click(button(name, sidebar))
}
async function closeFeedback() {
  const dialog = page.locator('.modal-backdrop-front').filter({ has: page.getByRole('button', { name: 'Fechar', exact: true, includeHidden: true }) })
  await dialog.waitFor({ state: 'attached' })
  const text = await dialog.textContent()
  console.log('FEEDBACK', text)
  assert(!/Falha|Destino da requisicao indefinido|Requisicao vazia|incompleta|nao foi possivel|Nao foi possivel/.test(text), text)
  const feedback = dialog.getByRole('button', { name: 'Fechar', exact: true, includeHidden: true })
  await click(feedback)
}
async function balance(companyId, stockCenterId) {
  const ledger = buildInventoryLedger({
    inventories: await db.appInventoryRecord.findMany({ where: { companyId, stockCenterId } }),
    sessions: await db.appInventoryCountSessionRecord.findMany({ where: { companyId, stockCenterId } }),
    counts: await db.appInventoryCountRecord.findMany({ where: { companyId, stockCenterId } }),
  })
  return ledger.current.get(`PRODUTO:${rawId}`) ?? 0
}
async function prepBalance(companyId, stockCenterId) {
  return buildInventoryLedger({ inventories: await db.appInventoryRecord.findMany({ where: { companyId, stockCenterId } }),
    sessions: await db.appInventoryCountSessionRecord.findMany({ where: { companyId, stockCenterId } }),
    counts: await db.appInventoryCountRecord.findMany({ where: { companyId, stockCenterId } }),
  }).current.get(`PREPARO:${sharedPrepId}`) ?? 0
}
const requisitions = () => db.appRequisitionRecord.findMany({ where: { companyId: { in: [consumerCompany, supplierCompany] } } })
async function receive(centerName, verifyLoading = false) {
  let release
  if (verifyLoading) {
    const ready = new Promise((resolve) => { release = resolve })
    await page.route('**/api/inventory-counts', async (route) => { await ready; await route.continue() }, { times: 1 })
  }
  await navigate('Requisicao')
  await click(button('Receber').first())
  const row = page.locator('tr').filter({ hasText: centerName }).first()
  await click(button('Receber', row))
  const modal = page.getByRole('dialog', { name: 'Conferencia da requisicao recebida', exact: true })
  await click(modal.getByRole('button', { name: /^Confirmar recebimento de/, includeHidden: true }).first())
  const finish = button('Finalizar conferencia', modal)
  if (verifyLoading) {
    assert(await finish.isDisabled(), 'Recebimento nao pode finalizar antes de carregar inventario/IDs.')
    release()
  }
  await waitFor(() => finish.isEnabled(), (ready) => ready, 'recebimento aguarda inventario persistido')
  await click(finish)
  await closeFeedback()
}
try {
  login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'igarape.aeb', password: 'production-regression-only' }) }).then((r) => r.json())
  assert(login.token); token = login.token
  for (const table of ['appSalesPostingOperationRecord', 'appSalesPostingSettingsRecord', 'appSalesConsumptionRecord',
    'appSalesImportRowRecord', 'appSalesImportBatchRecord', 'appRequisitionRecord', 'appRequisitionNotificationRecord',
    'appInventoryCountRecord', 'appInventoryCountSessionRecord', 'appInventoryRecord', 'appPendingInventoryMovementRecord', 'appAuditLogRecord']) {
    await db[table].deleteMany({ where: { companyId: { in: [consumerCompany, supplierCompany, remoteCompany] } } })
  }
  const sourceCompany = clean(await db.appCompanyRecord.findUnique({ where: { id: 13 } }))
  for (const id of new Set([consumerCompany, supplierCompany, remoteCompany])) {
    const data = { ...sourceCompany, id, tradeName: id === remoteCompany ? 'TESTE CASA DESTINO' : 'TESTE REPOSICAO',
      legalName: 'TESTE REPOSICAO', linkedCompanyIds: id === remoteCompany ? [consumerCompany] : [remoteCompany] }
    await db.appCompanyRecord.upsert({ where: { id }, create: data, update: data })
  }
  const product = { ...clean(await db.appProductRecord.findUnique({ where: { id: 'TESTE-CASCADE-RAW' } })),
    id: rawId, companyId: supplierCompany, ownerCompanyId: supplierCompany, name: 'UVA REPOSICAO TESTE',
    packages: [{ id: 1, isActive: true, packageUnit: 'KILOGRAM', packageQuantity: '1', purchasePrice: '10',
      internalCode: 'EMB-TESTE', companyPackageId: '', barcode: '', referenceCodes: [], openingQuantity: '', grossWeightGrams: '', packagingWeightGrams: '' }] }
  await db.appProductRecord.upsert({ where: { id: rawId }, create: product, update: product })
  const execution = { ...clean(await db.appTechnicalSheetRecord.findUnique({ where: { id: 9992 } })), id: executionId,
    companyId: consumerCompany, ownerCompanyId: consumerCompany, sharedCompanyIds: [], name: 'VENDA UVA TESTE',
    productId: 'TESTE-REPOSICAO-EXEC', companyProductId: 'PDV-COMPRA', companyProductIdsByCompanyId: {}, companyProductIdAliasesByCompanyId: {},
    ingredients: [{ id: 1, isActive: true, productId: rawId, productLabel: product.name, quantity: '50', yieldQuantity: '50' }], garnishIngredients: [] }
  await db.appTechnicalSheetRecord.upsert({ where: { id: executionId }, create: execution, update: execution })
  const sharedPrep = { ...clean(await db.appTechnicalSheetRecord.findUnique({ where: { id: 9988 } })), id: sharedPrepId,
    companyId: consumerCompany, ownerCompanyId: consumerCompany, sharedCompanyIds: [remoteCompany], name: 'PREPARO COMPARTILHADO TESTE',
    productId: 'TESTE-PREPARO-COMPARTILHADO', outputQuantity: '1000', portionSize: '1000', outputUnit: 'GRAM',
    productionCenters: [{ stockCenterId: supplierCenter, minimumQuantity: '' }], supplyRoutes: [{ consumerCenterId: remoteCenter, supplierCenterId: supplierCenter }],
    ingredients: [{ id: 1, productId: rawId, productLabel: product.name, quantity: '1000', yieldQuantity: '1000', isActive: true }], garnishIngredients: [] }
  await db.appTechnicalSheetRecord.upsert({ where: { id: sharedPrepId }, create: sharedPrep, update: sharedPrep })
  await db.appCatalogSharingSaleFeeRecord.upsert({ where: { ownerCompanyId_targetCompanyId: { ownerCompanyId: consumerCompany, targetCompanyId: remoteCompany } },
    create: { ownerCompanyId: consumerCompany, targetCompanyId: remoteCompany, preparationSaleFeePercentage: '10' }, update: { preparationSaleFeePercentage: '10' } })
  for (const [id, companyId, name, distributor] of [[consumerCenter, consumerCompany, 'BAR TESTE REPOSICAO', false],
    [supplierCenter, supplierCompany, 'DISTRIBUIDOR TESTE REPOSICAO', true], [remoteCenter, remoteCompany, 'BAR TESTE OUTRA EMPRESA', false]]) {
    const data = { id, companyId, name, code: `T${id}`, sector: 'BAR', userIds: [], responsibleUserIds: [], isActive: true,
      isProducer: distributor, producedTechnicalSheetIds: distributor ? [sharedPrepId] : [], isDistributor: distributor, distributesAllProducts: false,
      distributedProductIds: distributor ? [rawId] : [], suppliedCenterIds: distributor ? [consumerCenter] : [], minimumStocks: [],
      salesImportSettings: { distributorPurchaseRequestAutomation: 'APPROVE_AND_SEND' } }
    await db.appStockCenterRecord.upsert({ where: { id }, create: data, update: data })
    const inventoryTemplate = clean(await db.appInventoryRecord.findFirst({ where: { companyId: 13 } }))
    const { inventoryRecord } = await api('inventories', { ...inventoryTemplate, id: undefined, companyId, stockCenterId: id, countedAt: '2026-10-18',
      isClosed: true, startedAt: '2026-10-18T10:00:00Z', closedAt: '2026-10-18T11:00:00Z' })
    if (distributor) await lockedTransaction(db, async (tx) => {
      const sessionId = await nextInventoryMovementId(tx)
      await tx.appInventoryCountSessionRecord.create({ data: { id: sessionId, inventoryId: inventoryRecord.id,
        companyId, stockCenterId: id, countedAt: '2026-10-18', isClosed: true,
        startedAt: '2026-10-18T10:00:00Z', closedAt: '2026-10-18T11:00:00Z', startedByUserId: null, closedByUserId: null,
        startedByUserName: 'TESTE LOCAL', closedByUserName: 'TESTE LOCAL' } })
      const template = clean(await tx.appInventoryCountRecord.findFirst({ where: { companyId: 13 } }))
      await tx.appInventoryCountRecord.create({ data: { ...template, id: sessionId + 1, inventoryId: inventoryRecord.id,
        sessionId, companyId, stockCenterId: id, countedAt: '2026-10-18', storageLocation: 'PRATELEIRA',
        technicalSheetId: sharedPrepId, productId: '', serviceItemId: '', packageId: null, technicalSheetKind: 'PREPARO',
        technicalSheetName: sharedPrep.name, totalCountedQuantity: '2000', closedItemsQuantity: '2000', totalCountedUnit: 'GRAM' } })
    })
  }
  await company(consumerCompany)
  await click(button('Importar vendas').first())
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['DATA', 'CODIGO', 'QUANTIDADE'], ['2026-10-19', 'PDV-COMPRA', 20]]), 'VENDAS')
  await select('Centro de estoque desta importacao *').selectOption(String(consumerCenter), { force: true })
  const fileName = `REPOSICAO ${Date.now()}.xlsx`
  await page.locator('input[type="file"][accept=".xlsx,.xls"]').setInputFiles({ name: fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) })
  for (const [name, option] of [['Aba da planilha', 'VENDAS'], ['Coluna da data', 'A'], ['Coluna do identificador', 'B'], ['Coluna da quantidade', 'C'], ['Tratamento no estoque', 'POST_PENDING']]) await select(name).selectOption(option, { force: true })
  await page.waitForFunction(() => document.body.textContent.includes('VENDA UVA TESTE'))
  await click(button('Registrar importacao'))
  await click(button('Confirmar importacao'))
  await closeFeedback()
  const batch = (await api(`sales-import-batches?companyId=${consumerCompany}`)).batches.find((b) => b.fileName === fileName)
  const batchUrl = `sales-import-batches/${batch.id}/posting-`
  const settings = await fetch(`${base}/api/${batchUrl}settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ enabled: true, policies: {} }) })
  assert.equal(settings.status, 200)
  const timing = { dayEndConfirmed: true, aggregate: false, periodStart: '', periodEnd: '' }
  const { plan } = await api(`${batchUrl}preview`, { timing })
  await api(`${batchUrl}confirm`, { timing, revision: plan.revision, idempotencyKey: crypto.randomUUID(), confirmNegativeProducts: true })
  assert.equal(await balance(consumerCompany, consumerCenter), -1000)
  await company(consumerCompany)
  let releaseCounts
  const countsReady = new Promise((resolve) => { releaseCounts = resolve })
  await page.route('**/api/inventory-counts', async (route) => { await countsReady; await route.continue() }, { times: 1 })
  await navigate('Requisicao')
  await select('Centro de estoque *').selectOption(String(consumerCenter), { force: true })
  assert(await button('Carregando saldos...').isDisabled())
  releaseCounts()
  await page.waitForFunction(() => /Ultimo inventario do centro: \d{2}\/10\/2026/.test(document.body.textContent))
  await click(button('Montar requisicao'))
  await click(button('Salvar requisicao'))
  await closeFeedback()
  await click(button('Requisicoes feitas'))
  const requestingRow = page.locator('tr').filter({ hasText: 'BAR TESTE REPOSICAO' }).first()
  await click(button('Aprovar e enviar', requestingRow))
  await closeFeedback()
  const sent = await waitFor(requisitions, (rows) => rows.some((r) => r.stockCenterId === supplierCenter && r.supplyCenterName === 'COMPRAS'), 'pedido de compra automatico')
  const purchase = sent.find((r) => r.stockCenterId === supplierCenter && r.supplyCenterName === 'COMPRAS')
  const originalRequest = sent.find((r) => r.stockCenterId === consumerCenter && r.supplyCenterId === supplierCenter)
  assert.equal(purchase.companyId, supplierCompany)
  assert.equal(parseStockDecimal(purchase.lines[0].requestedQuantity), parseStockDecimal(originalRequest.lines[0].requestedQuantity), 'Compra nao deve duplicar a necessidade do centro sem saldo no distribuidor.')
  assert(purchase.lines[0].sourceAllocations.some((a) => a.originCompanyId === consumerCompany && a.originCenterId === consumerCenter))
  console.log('PASS venda -> saldo -1000 G -> minimo -> requisicao -> compra no distribuidor, com origem rastreavel')
  await company(supplierCompany)
  await navigate('Compras')
  const download = page.waitForEvent('download')
  await click(button('Exportar XLSX'))
  const exported = await download
  await exported.saveAs('tmp/replenishment-purchase.xlsx')
  await closeFeedback()
  await click(page.getByRole('tablist', { name: 'Fluxo de compras' }).getByRole('button', { name: 'Suprimentos', exact: true }))
  await click(button('Enviar', page.locator('tr').filter({ hasText: `#${purchase.id}` })))
  const shipment = page.getByRole('dialog', { name: 'Enviar suprimento aos centros', exact: true })
  await shipment.locator('tbody input').first().fill('1')
  await click(button('Marcar item conferido para envio', shipment))
  await click(button('Enviar para receber', shipment))
  await closeFeedback()
  const afterPurchase = await waitFor(requisitions, (rows) => rows.some((r) => r.stockCenterId === supplierCenter && r.status === 'READY_TO_RECEIVE'), 'envio parcial de compras persistido')
  assert(afterPurchase.some((r) => r.id === purchase.id && r.status === 'SENT_TO_SUPPLIES'))
  assert(afterPurchase.some((r) => r.stockCenterId === supplierCenter && r.status === 'READY_TO_RECEIVE'))
  assert.equal(await balance(supplierCompany, supplierCenter), 0)
  await receive('DISTRIBUIDOR TESTE REPOSICAO')
  await waitFor(() => balance(supplierCompany, supplierCenter), (v) => v === 1000, 'entrada parcial de 1 KG no distribuidor')
  console.log('PASS compra parcial: 1 de 2 embalagens recebida, resto permanece pendente, exportacao XLSX disponivel')
  await navigate('Suprimentos')
  await click(button('Enviar', page.locator('tr').filter({ hasText: 'BAR TESTE REPOSICAO' })))
  const supply = page.getByRole('dialog', { name: 'Conferir e editar requisicao', exact: true })
  assert((await supply.textContent()).includes('Saldo estoque'))
  await supply.locator('tbody input').first().fill('1')
  await click(button('Marcar item conferido para envio', supply))
  await click(button('Enviar para receber', supply))
  await closeFeedback()
  await waitFor(() => balance(supplierCompany, supplierCenter), (v) => v === 0, 'baixa parcial de 1 KG na empresa fornecedora')
  await company(consumerCompany)
  await receive('BAR TESTE REPOSICAO')
  await waitFor(() => balance(consumerCompany, consumerCenter), (v) => v === 0, 'recebimento de 1 KG na empresa consumidora')
  assert((await requisitions()).some((r) => r.stockCenterId === consumerCenter && r.status === 'SENT_TO_SUPPLIES'))
  assert.equal(errors.length, 0, errors.join('\n'))
  await page.screenshot({ path: 'tmp/replenishment-finished.png' })
  console.log('PASS suprimento entre centros: origem 1000 -> 0 G, destino -1000 -> 0 G, residual preservado')
  await company(remoteCompany)
  await navigate('Requisicao')
  await select('Centro de estoque *').selectOption(String(remoteCenter), { force: true })
  await page.waitForFunction(() => /Ultimo inventario do centro: \d{2}\/10\/2026/.test(document.body.textContent))
  const addable = select('Adicionar item abastecivel')
  const prepOption = await addable.locator('option').filter({ hasText: sharedPrep.name }).getAttribute('value')
  await addable.selectOption(prepOption, { force: true })
  await page.locator('label').filter({ hasText: /^Quantidade$/ }).locator('input').fill('2', { force: true })
  await click(button('Adicionar item'))
  await click(button('Salvar requisicao')); await closeFeedback()
  await click(button('Requisicoes feitas'))
  await click(button('Aprovar e enviar', page.locator('tr').filter({ hasText: 'BAR TESTE OUTRA EMPRESA' })))
  await closeFeedback()
  await company(consumerCompany)
  await navigate('Suprimentos')
  const foreignSupply = button('Enviar', page.locator('tr').filter({ hasText: 'BAR TESTE OUTRA EMPRESA' }))
  await waitFor(() => foreignSupply.isEnabled(), (ready) => ready, 'saldo carregado no suprimento entre empresas')
  await click(foreignSupply)
  const foreignModal = page.getByRole('dialog', { name: 'Conferir e editar requisicao', exact: true })
  await foreignModal.locator('tbody input').first().fill('1')
  await click(button('Marcar item conferido para envio', foreignModal))
  await click(button('Enviar para receber', foreignModal)); await closeFeedback()
  await waitFor(() => prepBalance(consumerCompany, supplierCenter), (value) => value === 1000, 'saida de 1 KG de preparo')
  await company(remoteCompany)
  await receive('BAR TESTE OUTRA EMPRESA', true)
  await waitFor(() => prepBalance(remoteCompany, remoteCenter), (value) => value === 1000, 'entrada de 1 KG na outra empresa')
  await navigate('Relatorios')
  const reportSelector = page.getByPlaceholder('Busque e selecione um relatorio')
  await reportSelector.fill('TRANSFERENCIAS ENTRE EMPRESAS')
  await page.getByRole('option', { name: 'TRANSFERENCIAS ENTRE EMPRESAS', exact: true, includeHidden: true }).dispatchEvent('mousedown')
  const transferred = page.locator('tr').filter({ hasText: sharedPrep.name }).first()
  await transferred.waitFor({ state: 'attached' })
  const costRow = (await transferred.textContent()).replace(/\s/g, '')
  assert(costRow.includes('10%') && costRow.includes('R$10,00') && costRow.includes('R$1,00') && costRow.includes('R$11,00'), costRow)
  const transferDownload = page.waitForEvent('download')
  await click(button('Exportar'))
  const exportModal = page.getByRole('dialog', { name: 'Exportar relatorio', exact: true })
  await exportModal.locator('select').selectOption('xlsx')
  await click(button('Exportar', exportModal))
  await (await transferDownload).saveAs('tmp/replenishment-intercompany.xlsx')
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log('PASS preparo entre empresas: origem 2000 -> 1000 G, destino 0 -> 1000 G; custo R$10,00 + 10% (R$1,00) = R$11,00 e XLSX')
} catch (error) {
  if (page) {
    console.log('FAILURE_DOM', (await page.locator('main').textContent()).slice(-16000))
    await page.screenshot({ path: 'tmp/replenishment-failure.png' })
  }
  throw error
} finally { await browser.close(); await db.$disconnect() }
