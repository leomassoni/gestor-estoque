import type { ManualProductionRequestRecord } from '../types/domain'

export function getCancellableManualProductionRequestIdSet(
  requests: ManualProductionRequestRecord[], companyId: number | null,
): Set<number> {
  const roots = new Set(requests.filter((request) => request.companyId === companyId).map((request) => request.id))
  return requests.filter((request) =>
    request.companyId === companyId &&
    !request.sourceRequisitionId && request.planningSourceKind !== 'EXECUCAO' &&
    (!request.isDependencyRequest || !roots.has(request.rootRequestId)),
  ).reduce((ids, request) => ids.add(request.id), new Set<number>())
}

export async function cancelManualProductionRequestsOnApi(params: {
  companyId: number
  centerId: number
  sheetId: number
  requestIds: number[]
}): Promise<number[]> {
  const response = await fetch('/api/manual-production-requests/cancel', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Nao foi possivel cancelar os pedidos manuais.')
  if (!Array.isArray(payload.deletedIds) || payload.deletedIds.some((id: unknown) => !Number.isSafeInteger(id))) {
    throw new Error('O servidor nao confirmou quais pedidos foram cancelados. Atualize a fila.')
  }
  return payload.deletedIds
}
