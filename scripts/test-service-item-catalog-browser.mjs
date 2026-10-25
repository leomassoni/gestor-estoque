import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = 'http://127.0.0.1:4001'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(90000)
const click = (locator) => locator.first().evaluate((element) => element.click())
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true, includeHidden: true })
let token
async function api(path, data, method = data ? 'POST' : 'GET') {
  const response = await page.request.fetch(`${base}/api/${path}`, { method, data,
    headers: token ? { Authorization: `Bearer ${token}` } : {} })
  assert.equal(response.status(), 200, await response.text())
  return response.json()
}
try {
  const login = await api('auth/login', { username: 'igarape.aeb', password: 'production-regression-only' })
  token = login.token
  const source = (await api('service-items?companyId=13')).serviceItems.find((item) => item.isActive)
  assert(source)
  const stamp = Date.now()
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII='
  const fixture = (await api('service-items', { ...source, id: `REC-LOAD-${stamp}`,
    name: `TESTE CATALOGO RECIPIENTE ${stamp}`, companyId: 13, ownerCompanyId: 13,
    imageDataUrl: image, sizeValue: '700', emptyWeight: '180' })).serviceItem
  const full = await api(`service-items?companyId=13&itemId=${fixture.id}`)
  assert.equal(full.serviceItems.length, 1)
  assert.equal(full.serviceItems[0].imageDataUrl, image)
  const light = await api('service-items?companyId=13&includeImages=false')
  assert(light.serviceItems.every((item) => item.imageDataUrl === ''))
  const metadataItem = light.serviceItems.find((item) => item.id === fixture.id)
  assert(metadataItem.imageDataUrlOmitted)
  await api(`service-items/${fixture.id}`, metadataItem, 'PUT')
  assert.equal((await api(`service-items?companyId=13&itemId=${fixture.id}`)).serviceItems[0].imageDataUrl, image)
  let initialFullFailure = true
  let metadataFailure = false
  let release
  const gate = new Promise((resolve) => { release = resolve })
  let blocked = true
  let metadataRequests = 0
  await page.route('**/api/service-items*', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== 'GET') return route.continue()
    const metadata = url.searchParams.get('includeImages') === 'false'
    if (!metadata && !url.searchParams.has('itemId') && initialFullFailure) {
      return route.fulfill({ status: 503, json: { error: 'Falha inicial simulada' } })
    }
    if (metadata) {
      metadataRequests += 1
      if (blocked) await gate
      if (metadataFailure) return route.fulfill({ status: 503, json: { error: 'Falha temporaria simulada' } })
    }
    return route.continue()
  })
  await context.addInitScript(({ token: savedToken, session }) => {
    localStorage.setItem('gestor-estoque:auth', JSON.stringify({ session, authToken: savedToken, currentCompanyId: 13 }))
    localStorage.setItem('gestor-estoque:auth-token', savedToken)
  }, login)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await click(page.getByRole('button', { name: /^Cadastros/, includeHidden: true }))
  await click(button('Utensilios e Recipientes', page.locator('aside')))
  await page.getByText('Carregando itens...', { exact: true }).waitFor({ state: 'visible' })
  assert.equal(await page.getByText('Nenhum item encontrado.', { exact: true }).count(), 0)
  await page.evaluate(() => { for (let i = 0; i < 3; i++) window.dispatchEvent(new Event('focus')) })
  assert.equal(metadataRequests, 1, 'Atualizacoes concorrentes nao devem repetir a consulta')
  blocked = false
  release()
  const row = page.locator('tr').filter({ hasText: fixture.name })
  await row.waitFor({ state: 'visible' })
  console.log('PASS catalogo aparece sem reload apos falha inicial; estado de carga e consulta unica')

  metadataFailure = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByRole('alert').filter({ hasText: 'Nao foi possivel atualizar' }).waitFor({ state: 'visible' })
  assert.equal(await row.count(), 1)
  metadataFailure = false
  await click(button('Tentar novamente'))
  await page.getByRole('alert').waitFor({ state: 'detached' })
  console.log('PASS falha preserva itens carregados e permite tentar novamente')

  initialFullFailure = false
  await click(button('Editar item', row))
  const preview = page.getByRole('img', { name: `Foto de ${fixture.name}`, exact: true })
  await preview.waitFor({ state: 'visible' })
  assert.equal(await preview.getAttribute('src'), image)
  const saving = page.waitForResponse((response) => response.url().endsWith(`/api/service-items/${fixture.id}`) && response.request().method() === 'PUT')
  await click(button('Salvar'))
  assert.equal((await saving).status(), 200)
  await click(button('Fechar', page.locator('.modal-backdrop-front')))
  assert.equal((await api(`service-items?companyId=13&itemId=${fixture.id}`)).serviceItems[0].imageDataUrl, image)
  console.log('PASS consulta completa antes de editar e foto preservada ao salvar')

  const added = (await api('service-items', { ...fixture, id: `REC-LOAD-NEW-${stamp}`,
    name: `TESTE NOVO RECIPIENTE ${stamp}` })).serviceItem
  await click(button('Receituarios', page.locator('aside')))
  await click(button('Utensilios e Recipientes', page.locator('aside')))
  await page.locator('tr').filter({ hasText: added.name }).waitFor({ state: 'visible' })
  assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'navigate')
  console.log('PASS novo cadastro de outra sessao aparece ao retornar ao painel, sem atualizar a pagina')
  assert.equal((await page.request.get(`${base}/api/service-items?companyId=13&includeImages=false`)).status(), 401)
  assert.equal((await page.request.get(`${base}/api/service-items?companyId=13&itemId=${fixture.id}`)).status(), 401)
} catch (error) {
  console.error('TEST_FAILURE', error)
  await page.screenshot({ path: 'tmp/service-item-catalog-error.png' }).catch(() => {})
  console.log(await page.locator('body').textContent().catch(() => 'unavailable'))
  throw error
} finally { await browser.close() }
