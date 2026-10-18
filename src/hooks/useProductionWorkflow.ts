import { useRef, useState, type RefObject } from 'react'
import type {
  AppUserRecord, InventoryCountRecord, InventoryCountSessionRecord, PendingInventoryMovementRecord,
  ProductionDraftState, ProductRecord, RecipePanelComputedData, SaveFeedback, StockCenterRecord, TechnicalSheetRecord,
} from '../types/domain'
import { formatDecimal, formatEditableDecimal, getTodayDateInputValue, parseDecimal } from '../utils/core'

export type ProductionTransitionResult = {
  draft: ProductionDraftState | null
  movement: {
    result: 'applied' | 'queued'
    session: InventoryCountSessionRecord | null
    records: InventoryCountRecord[]
    pending: PendingInventoryMovementRecord | null
  }
}

type Context = {
  draft: ProductionDraftState | null
  sheet: TechnicalSheetRecord | null
  center: StockCenterRecord | null
  byproduct: TechnicalSheetRecord | null
  byproductSuggestedYield: number
  preparedData: RecipePanelComputedData | null
  companyId: number | null
  user: AppUserRecord | null
  products: ProductRecord[]
  sheets: TechnicalSheetRecord[]
  isProductVisible: (product: ProductRecord, companyId: number | null) => boolean
  resolveProductSheet: (product: ProductRecord) => TechnicalSheetRecord | null
  isProductStockTracked: (product: ProductRecord) => boolean
  isSheetStockTracked: (sheet: TechnicalSheetRecord) => boolean
  mutationRef: RefObject<{ pending: boolean; version: number }>
  onSaved: (result: ProductionTransitionResult, previousDraft: ProductionDraftState) => void
  onFeedback: (feedback: SaveFeedback) => void
  onStartConfirmed: () => void
  onFinishConfirmed: () => void
}

export function useProductionWorkflow(context: Context) {
  const [isSaving, setIsSaving] = useState(false)
  const startAttempts = useRef(new Map<string, string>())
  const { draft, sheet, center, companyId, user, mutationRef } = context

  function sessionFor(startedAt: string): InventoryCountSessionRecord {
    const now = new Date().toISOString()
    return {
      id: 1, inventoryId: null, companyId: companyId!, stockCenterId: center!.id,
      countedAt: getTodayDateInputValue(), isClosed: true, startedAt,
      startedByUserId: draft?.startedByUserId ?? user?.id ?? null,
      startedByUserName: draft?.startedByUserName || user?.fullName || 'ADMINISTRADOR DO SISTEMA',
      closedAt: now, closedByUserId: user?.id ?? null,
      closedByUserName: user?.fullName || 'ADMINISTRADOR DO SISTEMA',
    }
  }

  function recordFor(session: InventoryCountSessionRecord, patch: Partial<InventoryCountRecord>): InventoryCountRecord {
    return {
      id: 1, inventoryId: null, sessionId: 1, companyId: session.companyId,
      stockCenterId: session.stockCenterId, countedAt: session.countedAt,
      storageLocation: '', technicalSheetId: null, productId: '', serviceItemId: '', packageId: null,
      technicalSheetName: '', technicalSheetKind: 'PREPARO', recipientItemId: '', recipientLabel: '',
      closedItemsQuantity: '', hasOpenItems: false, openItemsGrossWeight: '', openItemsContainerQuantity: '',
      openItemsNetQuantity: '', totalCountedQuantity: '', totalCountedUnit: 'MILLILITER',
      createdByUserId: user?.id ?? null, createdByUserName: user?.fullName || 'ADMINISTRADOR DO SISTEMA',
      ...patch,
    }
  }

  async function commit(phase: 'start' | 'finish', nextDraft: ProductionDraftState,
    session: InventoryCountSessionRecord, records: InventoryCountRecord[]) {
    if (mutationRef.current.pending || !draft) return
    mutationRef.current.pending = true
    mutationRef.current.version += 1
    setIsSaving(true)
    try {
      const response = await fetch(`/api/production-transitions/${phase}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: nextDraft, session, records }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel salvar a producao no servidor.')
      context.onSaved(payload as ProductionTransitionResult, nextDraft)
      if (phase === 'start') context.onStartConfirmed()
      else context.onFinishConfirmed()
      context.onFeedback({ status: 'success', title: phase === 'start' ? 'Producao iniciada' : 'Producao confirmada',
        message: payload.movement.result === 'queued'
          ? 'Movimentacao salva no servidor. Sera aplicada ao estoque quando o inventario aberto for finalizado.'
          : phase === 'start' ? 'Producao iniciada e consumo dos insumos salvo no servidor.'
            : 'Producao concluida e entrada em estoque salva no servidor.',
      })
    } catch (error) {
      context.onFeedback({ status: 'error', title: 'Falha ao salvar producao',
        message: error instanceof Error ? error.message : 'Tente novamente. A producao continua disponivel para conferencia.',
      })
    } finally {
      mutationRef.current.version += 1
      mutationRef.current.pending = false
      setIsSaving(false)
    }
  }

  async function beginProductionDraft() {
    if (!draft || !sheet || !center || companyId === null || !context.preparedData || mutationRef.current.pending) return
    const key = `${companyId}:${center.id}:${sheet.id}`
    const startedAt = draft.startedAt || startAttempts.current.get(key) || new Date().toISOString()
    startAttempts.current.set(key, startedAt)
    const session = sessionFor(startedAt)
    const records = context.preparedData.ingredientMetrics.flatMap((ingredient) => {
      const allocations = ingredient.consumptionAllocations ?? [{
        productId: ingredient.productId, productLabel: ingredient.label,
        quantity: ingredient.scaledInputQuantity, stockTracked: true,
      }]
      return allocations.filter((a) => a.stockTracked && a.quantity > 0 && a.productId).flatMap((allocation) => {
        const product = context.products.find((p) => p.id === allocation.productId && context.isProductVisible(p, companyId))
        const linkedSheet = product ? context.resolveProductSheet(product) : null
        if (!product || !context.isProductStockTracked(product) || (linkedSheet && !context.isSheetStockTracked(linkedSheet))) return []
        const quantity = formatEditableDecimal(-allocation.quantity)
        return [recordFor(session, {
          storageLocation: 'SAIDA PARA PRODUCAO', technicalSheetId: linkedSheet?.id ?? null,
          productId: linkedSheet ? '' : product.id, technicalSheetName: allocation.productLabel,
          technicalSheetKind: linkedSheet ? 'PREPARO' : 'PRODUTO',
          recipientLabel: `PRODUCAO INICIADA ${sheet.name}`, closedItemsQuantity: quantity,
          totalCountedQuantity: quantity, totalCountedUnit: linkedSheet?.outputUnit === 'GRAM' || product.controlUnit === 'GRAM'
            ? 'GRAM' : linkedSheet?.outputUnit === 'UNIT' || product.controlUnit === 'UNIT' ? 'UNIT' : 'MILLILITER',
        })]
      })
    })
    await commit('start', { ...draft, companyId, startedAt,
      startedByUserId: user?.id ?? null, startedByUserName: user?.fullName || 'ADMINISTRADOR DO SISTEMA' }, session, records)
  }

  async function confirmProductionDraft() {
    if (!draft || !sheet || !center || companyId === null || mutationRef.current.pending) return
    const finalYield = parseDecimal(draft.finalYield) ?? 0
    const byproductYield = parseDecimal(draft.byproductYield) ?? 0
    const error = finalYield <= 0 ? 'Informe um rendimento final valido para confirmar a producao.'
      : sheet.targetPh.trim() && !draft.confirmedPh.trim() ? 'Confirme o valor de PH antes de finalizar a producao.'
        : sheet.targetBrix.trim() && !draft.confirmedBrix.trim() ? 'Confirme o valor de Brix antes de finalizar a producao.'
          : context.byproduct && byproductYield <= 0 ? `Informe a quantidade real gerada de ${context.byproduct.name}.`
            : context.byproduct && !context.isSheetStockTracked(context.byproduct)
              ? `${context.byproduct.name} esta configurado para nao controlar estoque.` : ''
    if (error) {
      context.onFeedback({ status: 'error', title: 'Producao incompleta', message: error })
      return
    }
    const session = sessionFor(draft.startedAt)
    const outputRecord = (output: TechnicalSheetRecord, quantity: number, expected: number, label: string) => recordFor(session, {
      storageLocation: 'ENTRADA DE PRODUCAO', technicalSheetId: output.id, technicalSheetName: output.name,
      recipientLabel: label, closedItemsQuantity: formatDecimal(quantity), totalCountedQuantity: formatDecimal(quantity),
      totalCountedUnit: output.outputUnit === 'GRAM' ? 'GRAM' : output.outputUnit === 'UNIT' ? 'UNIT' : 'MILLILITER',
      productionExpectedYield: formatDecimal(expected), productionFinalYield: formatDecimal(quantity),
      productionYieldDifference: formatDecimal(quantity - expected),
    })
    const production = outputRecord(sheet, finalYield, parseDecimal(draft.desiredYield) ?? 0, 'PRODUCAO CONFIRMADA')
    Object.assign(production, { productionTargetPh: sheet.targetPh.trim(), productionConfirmedPh: draft.confirmedPh.trim(),
      productionTargetBrix: sheet.targetBrix.trim(), productionConfirmedBrix: draft.confirmedBrix.trim() })
    const records = [production]
    if (context.byproduct) records.push(outputRecord(context.byproduct, byproductYield, context.byproductSuggestedYield,
      `${sheet.yieldDifferenceDestination === 'RETURN_TO_STOCK' ? 'RETORNO AO ESTOQUE' : 'SUBPRODUTO DE PRODUCAO'} ${sheet.name}`))
    await commit('finish', { ...draft, companyId }, session, records)
    startAttempts.current.delete(`${companyId}:${center.id}:${sheet.id}`)
  }

  return { beginProductionDraft, confirmProductionDraft, isProductionSaving: isSaving }
}
