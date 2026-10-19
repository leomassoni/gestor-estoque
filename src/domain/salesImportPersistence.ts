import type { SalesImportBatchRecord, SalesImportRowRecord, SalesConsumptionRecord, SalesImportTemplateRecord } from '../types/domain'

let savingImport = false
export async function runSalesImportSaveOnce(action: () => Promise<void>) {
  if (savingImport) return
  savingImport = true
  try { await action() } finally { savingImport = false }
}

async function create<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Nao foi possivel persistir a importacao no servidor.')
  return result as T
}

async function persistInChunks<T, R>(items: T[], persist: (item: T) => Promise<R>): Promise<R[]> {
  const saved: R[] = []
  for (let index = 0; index < items.length; index += 6) {
    saved.push(...await Promise.all(items.slice(index, index + 6).map(persist)))
  }
  return saved
}

export async function persistSalesImportSourceRecords(batch: SalesImportBatchRecord, rows: SalesImportRowRecord[],
  consumptions: SalesConsumptionRecord[], template: SalesImportTemplateRecord | null) {
  if (template) await create('sales-import-templates', template)
  const saved = await create<{ batch: SalesImportBatchRecord }>('sales-import-batches', {
    ...batch, __serverAllocateIds: true, summary: { ...batch.summary, expectedConsumptionRows: consumptions.length },
  })
  const canonical = { ...batch, ...saved.batch, importCode: String(saved.batch.summary.importCode) }
  const savedRows = await persistInChunks(rows, (row) => create<{ row: SalesImportRowRecord }>('sales-import-rows', { ...row, batchId: canonical.id, __serverAllocateIds: true }))
  const savedConsumptions = await persistInChunks(consumptions, (consumption) => create<{ consumption: SalesConsumptionRecord }>('sales-consumptions', {
    ...consumption, sourceBatchId: canonical.id, __serverAllocateIds: true,
  }))
  return { batch: canonical, rows: savedRows.map((r) => r.row), consumptions: savedConsumptions.map((r) => r.consumption) }
}
