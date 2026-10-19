import type { AppUserRecord, InventoryCountRecord, InventoryCountSessionRecord, PendingInventoryMovementRecord,
  ProductRecord, SalesConsumptionRecord, TechnicalSheetRecord, StockCountableKind, StockCenterRecord, SaveFeedback,
  SalesImportBatchRecord, AuditLogRecord } from '../types/domain'
import { formatDecimal, getNextPersistedIntId, getTodayDateInputValue, parseDecimal } from '../utils/core'

import { salesPostingRequest, type SalesPostingPlan, type LegacySalesMovementParams } from "./salesImports"

export type LegacySalesMovementContext = {
  technicalSheets: TechnicalSheetRecord[]; products: ProductRecord[]; inventoryCountSessions: InventoryCountSessionRecord[];
  inventoryCounts: InventoryCountRecord[]; pendingInventoryMovements: PendingInventoryMovementRecord[];
  currentAppUser: AppUserRecord | null;
  normalizeSalesImportDateKey: (date: string) => string | null;
  isTechnicalSheetVisibleForCompany: (sheet: TechnicalSheetRecord, companyId: number | null) => boolean;
  isProductStockTracked: (product: ProductRecord) => boolean;
  isTechnicalSheetStockTracked: (sheet: TechnicalSheetRecord, products: ProductRecord[]) => boolean;
}

export type SalesPostingDispatchContext = {
  currentCompanyId: number | null; stockCenters: StockCenterRecord[]; currentCompanySalesConsumptions: SalesConsumptionRecord[];
  setSalesPostingBatchId: (id: number) => void; setSaveFeedback: (feedback: SaveFeedback) => void;
  buildSalesImportOperationalMovement: (params: LegacySalesMovementParams) => Promise<ReturnType<typeof buildLegacySalesImportMovement>>;
  registerOperationalInventoryMovement: (id: number, label: string, session: InventoryCountSessionRecord, records: InventoryCountRecord[]) => 'applied' | 'queued';
  normalizeSalesImportDateKey: (date: string) => string | null;
  refreshAppSalesImportRecordsFromApi: () => Promise<unknown>;
  registerAuditEvent: (event: Pick<AuditLogRecord, 'companyId' | 'module' | 'actionKey' | 'actionLabel' | 'targetType' | 'targetId' | 'targetLabel' | 'summary' | 'impactSummary' | 'severity' | 'result' | 'details'>) => void;
}

export async function dispatchSalesImportPosting(batch: SalesImportBatchRecord, context: SalesPostingDispatchContext) {
  const { currentCompanyId, stockCenters, currentCompanySalesConsumptions, setSalesPostingBatchId, setSaveFeedback, buildSalesImportOperationalMovement, registerOperationalInventoryMovement, normalizeSalesImportDateKey, refreshAppSalesImportRecordsFromApi, registerAuditEvent } = context
  if (currentCompanyId === null) {
    return
  }
  try {
    const { plan } = await salesPostingRequest<{ plan: SalesPostingPlan }>(batch.id, 'details')
    if (plan.settings.enabled || plan.operation) {
      setSalesPostingBatchId(batch.id)
      return
    }
  } catch (error) {
    setSaveFeedback({ status: 'error', title: 'Falha ao conferir lote', message: error instanceof Error ? error.message : 'Atualize o lote antes de lancar a saida.' })
    return
  }
  const targetCenter = stockCenters.find((center) => center.id === batch.stockCenterId && center.companyId === batch.companyId) ?? null
  if (!targetCenter) {
    setSaveFeedback({
      status: 'error',
      title: 'Centro nao encontrado',
      message: 'Nao foi possivel localizar o centro de estoque deste lote.',
    })
    return
  }

  const batchConsumptions = currentCompanySalesConsumptions.filter(
    (consumption) =>
      consumption.sourceBatchId === batch.id &&
      consumption.stockPostingStatus !== 'CANCELLED' &&
      consumption.stockPostingStatus !== 'POSTED',
  )
    const movementPlan = await buildSalesImportOperationalMovement({
    companyId: batch.companyId,
    stockCenterId: batch.stockCenterId,
    fileName: batch.fileName,
    consumptions: batchConsumptions,
  })

  if (!movementPlan || movementPlan.length === 0) {
    setSaveFeedback({
      status: 'error',
      title: 'Sem itens rastreaveis',
      message: 'Este lote nao possui itens rastreaveis de estoque pendentes para lancamento.',
    })
    return
  }

  const postedMovementSessionIds = new Set<number>()
  let postingResult: 'applied' | 'queued' | null = null
  movementPlan.forEach((movement) => {
    const result = registerOperationalInventoryMovement(
      batch.stockCenterId,
      `SAIDA POR VENDAS IMPORTADAS • ${batch.fileName}`,
      movement.session,
      movement.records,
    )
    postingResult = result
    if (result === 'applied') {
      postedMovementSessionIds.add(movement.session.id)
    }
  })

  const now = new Date().toISOString()
  const updatedBatch: SalesImportBatchRecord = {
    ...batch,
    status: postingResult === 'queued' ? 'POST_QUEUED' : 'POSTED',
  }
  const updatedConsumptions = currentCompanySalesConsumptions
    .filter((consumption) => consumption.sourceBatchId === batch.id)
    .map((consumption) => {
      const dateKey = normalizeSalesImportDateKey(consumption.consumedAt) ?? getTodayDateInputValue()
      const matchedMovement = movementPlan.find(
        (movement) => movement.consumedAt === dateKey && movement.linkedConsumptionIds.includes(consumption.id),
      ) ?? null
      const sessionId = matchedMovement?.session.id ?? null
      if (!sessionId) {
        return consumption
      }

      return {
        ...consumption,
        stockPostingStatus: postedMovementSessionIds.has(sessionId) ? 'POSTED' : 'PENDING',
        stockMovementId: sessionId,
        postedAt: postedMovementSessionIds.has(sessionId) ? now : '',
      } satisfies SalesConsumptionRecord
    })

  try {
    const [batchResponse, ...consumptionResponses] = await Promise.all([
      fetch(`/api/sales-import-batches/${updatedBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBatch),
      }),
      ...updatedConsumptions.map((consumption) =>
        fetch(`/api/sales-consumptions/${consumption.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(consumption),
        }),
      ),
    ])
    if (!batchResponse.ok || consumptionResponses.some((response) => !response.ok)) {
      throw new Error('Nao foi possivel atualizar o lote e os consumos desta importacao no servidor.')
    }
  } catch (error) {
    console.error(error)
    setSaveFeedback({
      status: 'error',
      title: 'Saida registrada com alerta',
      message:
        error instanceof Error
          ? `A movimentacao foi iniciada, mas o status final nao foi atualizado no servidor: ${error.message}`
          : 'A movimentacao foi iniciada, mas o status final nao foi atualizado no servidor.',
    })
    return
  }

  await refreshAppSalesImportRecordsFromApi()
  registerAuditEvent({
    companyId: batch.companyId,
    module: 'IMPORTAR_VENDAS',
    actionKey: 'POST_SALES_IMPORT_BATCH',
    actionLabel: 'Lancamento de saida por importacao',
    targetType: 'SALES_IMPORT_BATCH',
    targetId: String(batch.id),
    targetLabel: batch.fileName,
    summary: `Lote ${batch.fileName} foi lancado como saida de estoque.`,
    impactSummary:
      postingResult === 'queued'
        ? 'Saidas ficaram pendentes por inventario aberto.'
        : `${updatedConsumptions.filter((consumption) => consumption.stockPostingStatus === 'POSTED').length} consumo(s) postado(s) no estoque.`,
    severity: 'HIGH',
    result: 'SUCCESS',
    details: {
      stockCenterId: batch.stockCenterId,
      movementSessions: Array.from(postedMovementSessionIds),
      postingResult,
    },
  })
  setSaveFeedback({
    status: 'success',
    title: postingResult === 'queued' ? 'Saida pendente no inventario' : 'Saida lancada',
    message:
      postingResult === 'queued'
        ? `O centro ${targetCenter.name} esta com inventario aberto. A baixa deste lote foi registrada como pendente e sera aplicada ao final do inventario.`
        : `A saida oficial de estoque deste lote foi lancada para o centro ${targetCenter.name}.`,
  })
}


export function buildLegacySalesImportMovement(params: LegacySalesMovementParams, context: LegacySalesMovementContext) {
  const { technicalSheets, products, inventoryCountSessions, inventoryCounts, pendingInventoryMovements, currentAppUser,
    normalizeSalesImportDateKey, isTechnicalSheetVisibleForCompany, isProductStockTracked, isTechnicalSheetStockTracked } = context
  const { companyId, consumptions, fileName, mode = 'OUT', stockCenterId } = params
  const validConsumptions = consumptions.filter((record) => {
    const quantityConsumed = parseDecimal(record.quantityConsumed) ?? 0
    return quantityConsumed > 0
  })
  if (validConsumptions.length === 0) {
    return null
  }

  const groupedByDate = new Map<string, SalesConsumptionRecord[]>()
  validConsumptions.forEach((consumption) => {
    const dateKey = normalizeSalesImportDateKey(consumption.consumedAt) ?? getTodayDateInputValue()
    const currentGroup = groupedByDate.get(dateKey) ?? []
    groupedByDate.set(dateKey, [...currentGroup, consumption])
  })

  const usedIds = [
    ...inventoryCountSessions.map((record) => record.id),
    ...inventoryCounts.map((record) => record.id),
    ...pendingInventoryMovements.map((record) => record.id),
  ]
  const movementPlan: Array<{
    session: InventoryCountSessionRecord
    records: InventoryCountRecord[]
    consumedAt: string
    linkedConsumptionIds: number[]
  }> = []
  let nextId = getNextPersistedIntId(usedIds)
  Array.from(groupedByDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([consumedAt, dateConsumptions], dateIndex) => {
      const aggregatedByTarget = new Map<
        string,
        {
          linkedTechnicalSheet: TechnicalSheetRecord | null
          linkedProduct: ProductRecord | null
          quantityConsumed: number
          linkedConsumptionIds: number[]
        }
      >()

      dateConsumptions.forEach((consumption) => {
        const linkedTechnicalSheet =
          technicalSheets.find(
            (sheet) =>
              isTechnicalSheetVisibleForCompany(sheet, companyId) &&
              (sheet.kind === 'PREPARO' || sheet.kind === 'PRODUTO_INTERNO') &&
              sheet.productId === consumption.ingredientProductId,
          ) ?? null
        const linkedProduct =
          products.find(
            (product) =>
              product.companyId === companyId &&
              product.id === consumption.ingredientProductId,
          ) ?? null

        if (linkedProduct && !isProductStockTracked(linkedProduct)) {
          return
        }
        if (linkedTechnicalSheet && !isTechnicalSheetStockTracked(linkedTechnicalSheet, products)) {
          return
        }

        const aggregationKey = linkedTechnicalSheet
          ? `${linkedTechnicalSheet.kind}:${linkedTechnicalSheet.id}`
          : linkedProduct
            ? `PRODUTO:${linkedProduct.id}`
            : ''
        if (!aggregationKey) {
          return
        }

        const quantityConsumed = parseDecimal(consumption.quantityConsumed) ?? 0
        if (quantityConsumed <= 0) {
          return
        }

        const current = aggregatedByTarget.get(aggregationKey) ?? {
          linkedTechnicalSheet,
          linkedProduct,
          quantityConsumed: 0,
          linkedConsumptionIds: [],
        }
        aggregatedByTarget.set(aggregationKey, {
          linkedTechnicalSheet,
          linkedProduct,
          quantityConsumed: current.quantityConsumed + quantityConsumed,
          linkedConsumptionIds: [...current.linkedConsumptionIds, consumption.id],
        })
      })

      if (aggregatedByTarget.size === 0) {
        return
      }

      const sessionId = nextId
      nextId += 1
      const movementTimestamp = new Date(`${consumedAt}T23:59:00.000Z`)
      movementTimestamp.setUTCSeconds(Math.min(59, mode === 'REVERSAL' ? 30 + dateIndex : dateIndex))
      const movementTimestampIso = movementTimestamp.toISOString()
      const session: InventoryCountSessionRecord = {
        id: sessionId,
        inventoryId: null,
        companyId,
        stockCenterId,
        countedAt: consumedAt,
        isClosed: true,
        startedAt: movementTimestampIso,
        startedByUserId: currentAppUser?.id ?? null,
        startedByUserName: currentAppUser?.fullName ?? 'Administrador do sistema',
        closedAt: movementTimestampIso,
        closedByUserId: currentAppUser?.id ?? null,
        closedByUserName: currentAppUser?.fullName ?? 'Administrador do sistema',
      }

      const linkedConsumptionIds: number[] = []
      const records: InventoryCountRecord[] = Array.from(aggregatedByTarget.values()).map((entry) => {
        const recordId = nextId
        nextId += 1
        linkedConsumptionIds.push(...entry.linkedConsumptionIds)
        return {
          id: recordId,
          inventoryId: null,
          sessionId,
          companyId,
          stockCenterId,
          countedAt: consumedAt,
          storageLocation: mode === 'REVERSAL' ? 'ESTORNO DE VENDAS IMPORTADAS' : 'SAIDA POR VENDAS IMPORTADAS',
          technicalSheetId: entry.linkedTechnicalSheet?.id ?? null,
          productId: entry.linkedTechnicalSheet ? '' : entry.linkedProduct?.id ?? '',
          serviceItemId: '',
          packageId: null,
          technicalSheetName: entry.linkedTechnicalSheet?.name ?? entry.linkedProduct?.name ?? 'ITEM IMPORTADO',
          technicalSheetKind: entry.linkedTechnicalSheet
            ? (entry.linkedTechnicalSheet.kind as StockCountableKind)
            : 'PRODUTO',
          recipientItemId: '',
          recipientLabel: `${mode === 'REVERSAL' ? 'ESTORNO DE VENDAS IMPORTADAS' : 'VENDAS IMPORTADAS'} • ${fileName}`,
          closedItemsQuantity: formatDecimal(mode === 'REVERSAL' ? entry.quantityConsumed : -entry.quantityConsumed),
          hasOpenItems: false,
          openItemsGrossWeight: '',
          openItemsContainerQuantity: '',
          openItemsNetQuantity: '',
          totalCountedQuantity: formatDecimal(mode === 'REVERSAL' ? entry.quantityConsumed : -entry.quantityConsumed),
          totalCountedUnit:
            entry.linkedTechnicalSheet?.outputUnit === 'GRAM'
              ? 'GRAM'
              : entry.linkedTechnicalSheet?.outputUnit === 'UNIT'
                ? 'UNIT'
                : entry.linkedProduct?.controlUnit === 'GRAM'
                  ? 'GRAM'
                  : entry.linkedProduct?.controlUnit === 'UNIT'
                    ? 'UNIT'
                    : 'MILLILITER',
          createdByUserId: currentAppUser?.id ?? null,
          createdByUserName: currentAppUser?.fullName ?? 'Administrador do sistema',
        } satisfies InventoryCountRecord
      })

      movementPlan.push({
        session,
        records,
        consumedAt,
        linkedConsumptionIds,
      })
    })

  if (movementPlan.length === 0) {
    return null
  }

  return movementPlan
}
