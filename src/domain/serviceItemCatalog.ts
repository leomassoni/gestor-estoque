import type { ServiceItemRecord } from '../types/domain'

export type ServiceItemCatalogStatus = { isLoading: boolean; error: string }

export async function fetchServiceItemCatalog(
  companyIds: number[], normalize: (value: unknown) => ServiceItemRecord | null, signal?: AbortSignal,
) {
  const records = new Map<string, ServiceItemRecord>()
  for (const companyId of companyIds) {
    const response = await fetch(`/api/service-items?companyId=${companyId}&includeImages=false`, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('Nao foi possivel atualizar os utensilios e recipientes. Tente novamente.')
    const payload = await response.json()
    if (!Array.isArray(payload.serviceItems)) throw new Error('Resposta invalida ao consultar os recipientes.')
    for (const value of payload.serviceItems) {
      const item = normalize(value)
      if (!item) throw new Error('Um recipiente retornou dados invalidos. Tente atualizar o catalogo novamente.')
      records.set(item.id, { ...item, imageDataUrlOmitted: true })
    }
  }
  return Array.from(records.values())
}

export function mergeServiceItemCatalog(current: ServiceItemRecord[], incoming: ServiceItemRecord[], companyIds: number[]) {
  const scope = new Set(companyIds)
  const previousById = new Map(current.map((item) => [item.id, item]))
  const merged = [
    ...current.filter((item) => !scope.has(item.companyId) && !scope.has(item.ownerCompanyId ?? item.companyId)),
    ...incoming.map((item) => {
      const previous = previousById.get(item.id)
      return { ...item, imageDataUrl: previous?.imageDataUrl ?? '',
        imageDataUrlOmitted: previous ? previous.imageDataUrlOmitted === true : true }
    }),
  ]
  const nextById = new Map(merged.map((item) => [item.id, item]))
  return current.length === nextById.size && current.every((item) =>
    JSON.stringify({ ...item, imageDataUrl: '' }) === JSON.stringify({ ...nextById.get(item.id), imageDataUrl: '' }))
    ? current : Array.from(nextById.values())
}

export async function fetchServiceItemForEditing(itemId: string, companyId: number | null,
  normalize: (value: unknown) => ServiceItemRecord | null) {
  if (companyId === null) throw new Error('Selecione uma empresa antes de editar o recipiente.')
  const query = new URLSearchParams({ companyId: String(companyId), itemId })
  const response = await fetch(`/api/service-items?${query}`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Nao foi possivel carregar o recipiente completo. Tente novamente.')
  const payload = await response.json()
  const item = Array.isArray(payload.serviceItems)
    ? payload.serviceItems.map(normalize).find((entry: ServiceItemRecord | null) => entry?.id === itemId) : null
  if (!item) throw new Error('Recipiente nao encontrado no servidor.')
  return item as ServiceItemRecord
}
