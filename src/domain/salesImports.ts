import type { SalesConsumptionRecord } from '../types/domain'

export type SalesPostingTiming = { dayEndConfirmed: boolean; aggregate: boolean; periodStart: string; periodEnd: string }
export type SalesPostingStep = { productId: string; technicalSheetId: number | null; name: string; quantity: number; unit: string }
export type SalesPostingAllocation = { demandId: number; productId: string; technicalSheetId: number | null;
  sourceName: string;
  name: string; quantity: number; unit: string; consumedAt: string; balanceBefore: number; balanceAfter: number;
  theoretical: boolean; path: SalesPostingStep[]; movementRecordId?: number; movementSessionId?: number }
export type SalesPostingPending = { id: number; quantity: number; unit: string; consumedAt: string;
  sourceName: string;
  reason: string; message: string; path: SalesPostingStep[] }
export type SalesPostingPlan = {
  batchId: number; fileName: string; companyId: number; stockCenterId: number; centerName: string; revision: string;
  timing: SalesPostingTiming; aggregateRequired: boolean;
  allocations: SalesPostingAllocation[]; pending: SalesPostingPending[]; covered: Array<{ id: number }>;
  warnings: Array<{ name: string; balanceBefore: number; balanceAfter: number }>;
  inventory: { id: number; date: string } | null;
  policySheets: Array<{ id: number; name: string; kind: string; local: boolean; generated: boolean; policy: string }>;
  settings: { enabled: boolean; policies: Record<string, 'CASCADE_LOCAL' | 'STOCK_ONLY'>; canManage: boolean };
  operation: { id: string; status: string; revision: number; allocations: SalesPostingAllocation[];
    residual: SalesPostingPending[]; covered: Array<{ id: number }> } | null;
}

export async function salesPostingRequest<T>(batchId: number, action: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(`/api/sales-import-batches/${batchId}/posting-${action}`, {
    method, headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Nao foi possivel salvar a operacao de vendas no servidor.')
  return data as T
}

export type LegacySalesMovementParams = { companyId: number; stockCenterId: number; fileName: string;
  consumptions: SalesConsumptionRecord[]; mode?: 'OUT' | 'REVERSAL' }
