import type {
  SalesConsumptionRecord,
  SalesImportBatchRecord,
  SalesImportRowRecord,
  StockCenterRecord,
} from '../types/domain'

type SalesSnapshot = {
  batches: SalesImportBatchRecord[]
  rows: SalesImportRowRecord[]
  consumptions: SalesConsumptionRecord[]
}

export async function recalculateSalesMinimumsAfterSheetSave(params: {
  companyIds: number[]
  loadCenters: () => Promise<StockCenterRecord[]>
  loadSales: () => Promise<SalesSnapshot>
  rebuildCompany: (centers: StockCenterRecord[], companyId: number, sales: SalesSnapshot) => StockCenterRecord[]
  persistCenters: (before: StockCenterRecord[], after: StockCenterRecord[]) => Promise<void>
}): Promise<StockCenterRecord[] | null> {
  const { companyIds, loadCenters, loadSales, rebuildCompany, persistCenters } = params
  const [centers, sales] = await Promise.all([loadCenters(), loadSales()])
  if (centers.length === 0) throw new Error('Base de centros vazia para recalcular minimos.')

  const affectedCompanyIds = [...new Set(companyIds)].filter((companyId) =>
    sales.batches.some((batch) => batch.companyId === companyId && batch.status !== 'CANCELLED'),
  )
  if (affectedCompanyIds.length === 0) return null
  if (affectedCompanyIds.some((companyId) =>
    !sales.rows.some((row) => row.companyId === companyId) &&
    !sales.consumptions.some((consumption) => consumption.companyId === companyId),
  )) {
    throw new Error('Base de vendas incompleta para recalcular minimos.')
  }

  const updatedCenters = affectedCompanyIds.reduce(
    (current, companyId) => rebuildCompany(current, companyId, sales),
    centers,
  )
  await persistCenters(centers, updatedCenters)
  return updatedCenters
}
