import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { authenticate, api, baseUrl } from './audit-madre-production-integrity.mjs'

const token = await authenticate()
const online = process.argv.includes('--online')
const appUrl = online ? baseUrl.replace(/\/api$/, '') : 'http://127.0.0.1:5174/'
const { session } = await api(token, 'auth/session')
assert.equal(session.kind, 'systemAdmin')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const pageErrors = []
const blockedMutations = []
page.setDefaultTimeout(90000)
page.on('pageerror', (error) => pageErrors.push(error.message))
await context.addInitScript(({ session, token }) => {
  localStorage.setItem('gestor-estoque:auth', JSON.stringify({ session, authToken: token, currentCompanyId: 13 }))
  localStorage.setItem('gestor-estoque:auth-token', token)
}, { session, token })
await page.route('**/api/**', async (route) => {
  const request = route.request()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
    blockedMutations.push(`${request.method()} ${request.url()}`)
    await route.abort('blockedbyclient')
    return
  }
  const url = new URL(request.url())
  if (online) {
    await route.continue()
    return
  }
  const response = await route.fetch({ url: `${baseUrl}${url.pathname.slice(4)}${url.search}` })
  await route.fulfill({ response })
})

try {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('aside').getByRole('button', { name: 'Receituarios' }).click()
  const panel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Painel de receitas' }) })
  await panel.waitFor()
  const search = panel.getByLabel('Buscar receita')
  const firstPreparation = await panel.locator('datalist option').first().getAttribute('value')
  assert(firstPreparation, 'Receituario sem pre-preparos para testar')
  await search.fill(firstPreparation)
  await panel.getByRole('heading', { name: firstPreparation, exact: true }).waitFor()
  const recipeCount = panel.getByLabel('Quantidade de receitas').first()
  await recipeCount.fill('2')
  assert.equal(await recipeCount.inputValue(), '2')
  assert(await panel.getByText('Rendimento final').count() > 0)

  await panel.getByRole('button', { name: 'Execucao', exact: true }).click()
  const firstExecution = await panel.locator('datalist option').first().getAttribute('value')
  assert(firstExecution, 'Receituario sem fichas de execucao para testar')
  await search.fill(firstExecution)
  await panel.getByRole('heading', { name: firstExecution, exact: true }).waitFor()
  assert(await panel.getByText('Insumos', { exact: true }).count() > 0)
  await panel.getByRole('button', { name: 'Exportar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar receituarios' })
  await dialog.waitFor()
  assert((await dialog.innerText()).includes('Execucao'))
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await page.locator('aside').getByRole('button', { name: 'Painel master' }).click()
  await page.locator('aside').getByRole('button', { name: 'Receituarios' }).click()
  await panel.getByRole('heading', { name: firstExecution, exact: true }).waitFor()
  assert.equal(await search.inputValue(), firstExecution)

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(blockedMutations, [])
  console.log(JSON.stringify({ firstPreparation, firstExecution, recipeScale: true, exportDialog: true, remountState: true, pageErrors, blockedMutations }))
} finally {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await browser.close()
}
