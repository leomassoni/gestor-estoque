import assert from 'node:assert/strict'
import { fetchServiceItemCatalog, fetchServiceItemForEditing, mergeServiceItemCatalog } from '../src/domain/serviceItemCatalog.ts'

const original = globalThis.fetch
const first = { id: 'REC-1', companyId: 13, ownerCompanyId: 13, name: 'GARRAFA 700ML', imageDataUrl: 'data:image/png;base64,PHOTO', imageDataUrlOmitted: false }
const other = { ...first, id: 'REC-2', companyId: 2, ownerCompanyId: 2 }
const metadata = { ...first, imageDataUrl: '' }
assert.equal(mergeServiceItemCatalog([first, other], [metadata], [13])[0].imageDataUrl, first.imageDataUrl)
const current = [first, other]
assert.strictEqual(mergeServiceItemCatalog(current, [metadata], [13]), current)
const changed = mergeServiceItemCatalog(current, [{ ...metadata, name: 'GARRAFA NOVA 700ML' }], [13])
assert.equal(changed.find((item) => item.id === first.id).imageDataUrl, first.imageDataUrl)
assert.equal(changed.find((item) => item.id === other.id).companyId, 2)
assert(mergeServiceItemCatalog([], [metadata], [13])[0].imageDataUrlOmitted)
const requests = []
try {
  globalThis.fetch = async (path) => {
    requests.push(path)
    return Response.json({ serviceItems: [path.includes('itemId=') ? first : metadata] })
  }
  const normalize = (value) => value?.id ? value : null
  const records = await fetchServiceItemCatalog([13, 2], normalize)
  assert.equal(records.length, 1)
  assert(requests.every((path) => path.includes('includeImages=false')))
  assert.equal((await fetchServiceItemForEditing(first.id, 13, normalize)).imageDataUrl, first.imageDataUrl)
  assert(!requests.at(-1).includes('includeImages=false'))
  globalThis.fetch = async () => Response.json({ error: 'Falha simulada' }, { status: 503 })
  await assert.rejects(() => fetchServiceItemCatalog([13], normalize), /Nao foi possivel/)
  globalThis.fetch = async () => Response.json({ serviceItems: [{}] })
  await assert.rejects(() => fetchServiceItemCatalog([13], normalize), /dados invalidos/)
  globalThis.fetch = async () => Response.json({ serviceItems: [] })
  await assert.rejects(() => fetchServiceItemForEditing(first.id, 13, normalize), /nao encontrado/)
  console.log('PASS catalogo leve, fotos preservadas, escopo, identidade estavel, deduplicacao, falhas e edicao completa')
} finally { globalThis.fetch = original }
