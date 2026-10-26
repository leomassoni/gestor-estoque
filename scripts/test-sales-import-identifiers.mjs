import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: ['src/domain/salesImportIdentifiers.ts'], bundle: true,
  write: false, platform: 'node', format: 'esm' })
const { resolveSalesImportIdentifier: resolve } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const sheet = (id, name, primary = '', aliases = [], options = {}) => ({
  id, name, companyId: 13, ownerCompanyId: 13, productId: `EXE-TEST-${id}`,
  companyProductId: primary, companyProductIdsByCompanyId: primary ? { 13: primary } : {},
  companyProductIdAliasesByCompanyId: aliases.length ? { 13: aliases } : {}, ...options,
})
const bees = sheet(634, 'BEES KNEES', '61', ['60'])
const lagunitas = sheet(1067, 'LAGUNITAS', '634', ['635'])
const lastWord = sheet(639, 'LAST WORD', '81', ['82'])
const heineken = sheet(1120, 'HEINEKEN ZERO', '638', ['639'])
const markTwain = sheet(636, 'MARK TWAIN', '85', ['86'])
const blueMoon = sheet(1066, 'BLUE MOON', '636', ['637'])
for (const candidates of [[bees, lagunitas], [lagunitas, bees]]) {
  assert.equal(resolve(candidates, 13, '634').sheet, lagunitas)
  assert.equal(resolve(candidates, 13, '61').sheet, bees)
  assert.equal(resolve(candidates, 13, '60').sheet, bees)
}
for (const candidates of [[lastWord, heineken], [heineken, lastWord]]) {
  assert.equal(resolve(candidates, 13, '639').sheet, heineken)
  assert.equal(resolve(candidates, 13, '638').sheet, heineken)
  assert.equal(resolve(candidates, 13, '81').sheet, lastWord)
}
assert.equal(resolve([markTwain, blueMoon], 13, '636').sheet, blueMoon)
assert.equal(resolve([markTwain, blueMoon], 13, '637').sheet, blueMoon)
console.log('PASS IDs empresa e aliases prevalecem sobre chave numerica, independentemente da ordem')

assert.equal(resolve([bees], 13, bees.productId).sheet, bees)
assert.equal(resolve([bees], 13, '634').sheet, bees)
assert.equal(resolve([bees], 13, '634').matchedBy, 'INTERNAL_RECORD')
assert.equal(resolve([bees], 13, bees.productId).matchedBy, 'INTERNAL_PRODUCT')
assert.equal(resolve([bees], 13, ' 61 ').sheet, bees)
assert.equal(resolve([bees], 13, bees.productId.toLowerCase()).sheet, bees)
const numericProduct = sheet(900, 'LEGADO', '', [], { productId: '634' })
assert.equal(resolve([bees, numericProduct], 13, '634').sheet, numericProduct)
assert.equal(resolve([numericProduct, lagunitas], 13, '634').sheet, lagunitas)
console.log('PASS fallback por ID interno visivel e chave numerica preservado somente sem de-para')

const conflict = sheet(55, 'DUPLICATA', '61')
assert.equal(resolve([bees, conflict], 13, '61').ambiguous, true)
assert.equal(resolve([bees, conflict], 13, '61').sheet, null)
assert.equal(resolve([bees, sheet(56, 'ALIAS DUPLICADO', '', ['61'])], 13, '61').ambiguous, true)
assert.equal(resolve([bees, sheet(57, 'ALIAS DUPLICADO', '', ['60'])], 13, '60').ambiguous, true)
assert.equal(resolve([bees, { ...bees }], 13, '61').sheet?.id, 634)
assert.equal(resolve([bees, sheet(58, 'ID INTERNO REPETIDO', '', [], { productId: bees.productId })], 13, bees.productId).ambiguous, true)
assert.equal(resolve([bees], 13, 'DESCONHECIDO').sheet, null)
assert.equal(resolve([bees], 13, '').sheet, null)
assert.equal(resolve([], 13, '61').ambiguous, false)
console.log('PASS ambiguidades reais bloqueadas; desconhecidos e entradas vazias nao ganham correspondencia')

const shared = sheet(60, 'COMPARTILHADA', 'OWNER', [], { companyId: 2, ownerCompanyId: 2,
  companyProductIdsByCompanyId: { 2: 'OWNER', 13: 'LOCAL' },
  companyProductIdAliasesByCompanyId: { 2: ['OWNER-ALIAS'], 13: ['LOCAL-ALIAS'] } })
assert.equal(resolve([shared], 13, 'OWNER').sheet, null)
assert.equal(resolve([shared], 13, 'OWNER-ALIAS').sheet, null)
assert.equal(resolve([shared], 13, 'LOCAL').sheet, shared)
assert.equal(resolve([shared], 13, 'LOCAL-ALIAS').sheet, shared)
assert.equal(resolve([shared], 2, 'OWNER').sheet, shared)
assert.equal(resolve([shared], 2, 'LOCAL').sheet, null)
assert.equal(resolve([bees], null, '61').sheet, null)
assert.equal(resolve([bees], null, bees.productId).sheet, bees)
console.log('PASS IDs e aliases especificos da empresa; compartilhamento nao herda codigo da origem')

const many = Array.from({ length: 1000 }, (_, index) => sheet(index + 2000, `FICHA ${index}`, `PDV-${index}`))
const started = performance.now()
for (let index = 0; index < 1000; index++) assert.equal(resolve(many, 13, `PDV-${index}`).sheet.id, index + 2000)
console.log(`PASS 1000 resolucoes em catalogo de 1000 fichas: ${Math.round(performance.now() - started)} ms; sem estado ou persistencia`)
