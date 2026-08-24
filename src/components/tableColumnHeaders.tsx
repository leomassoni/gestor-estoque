import type { Dispatch, DragEvent, SetStateAction } from 'react'
import type {
  ClosedInventoryColumnKey,
  ColumnKey,
  ColumnSort,
  InventoryReviewColumnKey,
  InventorySummaryColumnKey,
  ItemColumnKey,
  PurchaseDemandColumnKey,
  ReceiveReviewColumnKey,
  RequisitionDraftColumnKey,
  RequisitionFlowColumnKey,
  RequisitionHistoryColumnKey,
  StockCenterMinimumColumnKey,
  StockReportColumnKey,
  TechnicalSheetColumnKey,
} from '../types/domain'
import { normalizeRegistrationText } from '../utils/core'

export const tableColumnFilterNoneValue = '__GESTOR_ESTOQUE_FILTER_NONE__'

type ColumnDragOptions = {
  draggable?: boolean
  isDragging?: boolean
  isDropTarget?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  onDragOver?: (event: DragEvent<HTMLTableCellElement>) => void
  onDragLeave?: () => void
  onDrop?: (event: DragEvent<HTMLTableCellElement>) => void
}

function getSortLabels(isNumeric: boolean) {
  return isNumeric
    ? { asc: '0-9', desc: '9-0' }
    : { asc: 'A-Z', desc: 'Z-A' }
}

function getColumnFilterSelection(
  activeFilters: string[],
  distinctValues: string[],
  normalizeValue: (value: string) => string = (value) => value,
) {
  if (distinctValues.length === 0) {
    return []
  }
  if (activeFilters.length === 0) {
    return distinctValues
  }

  const activeSet = new Set(activeFilters.map((value) => normalizeValue(String(value))))
  if (activeSet.has(normalizeValue(tableColumnFilterNoneValue))) {
    return []
  }

  return distinctValues.filter((value) => activeSet.has(normalizeValue(String(value))))
}

function getColumnFilterBadgeLabel(
  activeFilters: string[],
  distinctValues: string[],
  normalizeValue?: (value: string) => string,
) {
  const hiddenCount = distinctValues.length - getColumnFilterSelection(activeFilters, distinctValues, normalizeValue).length
  return hiddenCount > 0 ? `-${hiddenCount}` : null
}

function buildNextColumnFilterValues(
  activeFilters: string[],
  distinctValues: string[],
  targetValue: string,
  isCurrentlyChecked: boolean,
  normalizeValue: (value: string) => string = (value) => value,
  storeValue: (value: string) => string = (value) => value,
) {
  const currentSelection = getColumnFilterSelection(activeFilters, distinctValues, normalizeValue)
  const nextSelection = isCurrentlyChecked
    ? currentSelection.filter((value) => normalizeValue(String(value)) !== normalizeValue(String(targetValue)))
    : [...currentSelection, targetValue]
  const dedupedSelection = Array.from(
    new Map(nextSelection.map((value) => [normalizeValue(String(value)), value] as const)).values(),
  )

  if (dedupedSelection.length === distinctValues.length) {
    return []
  }
  if (dedupedSelection.length === 0) {
    return [tableColumnFilterNoneValue]
  }

  return dedupedSelection.map(storeValue)
}

function isNumericProductColumn(key: ColumnKey) {
  return key === 'unitCost' || key === 'purchaseCost' || key === 'packages'
}

function isNumericTechnicalSheetColumn(key: TechnicalSheetColumnKey) {
  return (
    key === 'yield' ||
    key === 'ingredients' ||
    key === 'costPerYield' ||
    key === 'totalRecipeCost' ||
    key === 'finalCmvPercentage' ||
    key === 'finalSalePrice'
  )
}

function isNumericItemColumn(key: ItemColumnKey) {
  return key === 'sizeCapacity' || key === 'packages'
}

function isNumericStockCenterMinimumColumn(key: StockCenterMinimumColumnKey) {
  return key === 'yield' || key === 'minimum' || key === 'realMinimum' || key === 'consolidatedMinimum'
}

function isNumericInventoryReviewColumn(key: InventoryReviewColumnKey) {
  return key === 'total'
}

function isNumericInventorySummaryColumn(key: InventorySummaryColumnKey) {
  return key === 'closed' || key === 'open' || key === 'total'
}

function isNumericRequisitionDraftColumn(key: RequisitionDraftColumnKey) {
  return key === 'current' || key === 'requested' || key === 'suggestion'
}

function isNumericRequisitionHistoryColumn(key: RequisitionHistoryColumnKey) {
  return key === 'items'
}

function isNumericRequisitionFlowColumn(key: RequisitionFlowColumnKey) {
  return key === 'items'
}

function isNumericPurchaseDemandColumn(key: PurchaseDemandColumnKey) {
  return key === 'current' || key === 'demand' || key === 'purchase'
}

function renderGenericColumnHeader<K extends string>(params: {
  key: K
  label: string
  openColumnMenu: K | null
  setOpenColumnMenu: Dispatch<SetStateAction<K | null>>
  columnFilters: Partial<Record<K, string[]>>
  distinctColumnValues: Record<K, string[]>
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<K, string[]>>>>
  setColumnVisibility: Dispatch<SetStateAction<Record<K, boolean>>>
  columnSort: ColumnSort<K> | null
  setColumnSort: Dispatch<SetStateAction<ColumnSort<K> | null>>
  sortLabels: { asc: string; desc: string }
  stickyKey?: K
  canHideColumn?: boolean
  dragOptions?: ColumnDragOptions
  normalizeFilterValue?: (value: string) => string
  storeFilterValue?: (value: string) => string
  stopMenuPropagation?: boolean
}) {
  const {
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels,
    stickyKey,
    dragOptions,
    normalizeFilterValue,
    storeFilterValue,
    stopMenuPropagation,
  } = params
  const distinctValues = distinctColumnValues[key] ?? []
  const activeFilters = columnFilters[key] ?? []
  const selectedValues = getColumnFilterSelection(activeFilters, distinctValues, normalizeFilterValue)
  const selectedValueSet = new Set(selectedValues.map((value) => (normalizeFilterValue ?? ((item: string) => item))(String(value))))
  const filterBadgeLabel = getColumnFilterBadgeLabel(activeFilters, distinctValues, normalizeFilterValue)
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const canHideColumn = params.canHideColumn ?? key !== stickyKey

  return (
    <th
      key={key}
      className={[
        openColumnMenu === key ? 'menu-open' : '',
        key === stickyKey ? 'sticky-product' : '',
        dragOptions?.draggable ? 'draggable-column-header' : '',
        dragOptions?.isDragging ? 'dragging-column-header' : '',
        dragOptions?.isDropTarget ? 'column-drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={dragOptions?.draggable && openColumnMenu !== key}
      onDragStart={dragOptions?.onDragStart}
      onDragEnd={dragOptions?.onDragEnd}
      onDragOver={dragOptions?.onDragOver}
      onDragLeave={dragOptions?.onDragLeave}
      onDrop={dragOptions?.onDrop}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {filterBadgeLabel ? <span className="header-filter-count">{filterBadgeLabel}</span> : null}
          <button
            className="header-tool-button"
            type="button"
            onClick={() => setOpenColumnMenu((current) => (current === key ? null : key))}
            aria-label={`Filtrar coluna ${label}`}
            title={`Filtrar coluna ${label}`}
          >
            ▼
          </button>
          {openColumnMenu === key ? (
            <div
              className="header-menu"
              onClick={stopMenuPropagation ? (event) => event.stopPropagation() : undefined}
              onMouseDown={stopMenuPropagation ? (event) => event.stopPropagation() : undefined}
            >
              <div className="header-menu-actions">
                <button type="button" className="ghost-button" onClick={() => setColumnSort({ key, direction: 'asc' })}>
                  {sortLabels.asc}
                </button>
                <button type="button" className="ghost-button" onClick={() => setColumnSort({ key, direction: 'desc' })}>
                  {sortLabels.desc}
                </button>
                <button
                  type="button"
                  className="ghost-button header-menu-icon-action"
                  onClick={() => {
                    setColumnSort((current) => (current?.key === key ? null : current))
                    setColumnFilters((current) => ({ ...current, [key]: [] }))
                  }}
                  aria-label={`Limpar filtros da coluna ${label}`}
                  title={`Limpar filtros da coluna ${label}`}
                >
                  🧹
                </button>
                {canHideColumn ? (
                  <button
                    type="button"
                    className="ghost-button header-menu-icon-action"
                    onClick={() => {
                      setColumnVisibility((current) => ({ ...current, [key]: false }))
                      setOpenColumnMenu(null)
                    }}
                    aria-label={`Ocultar coluna ${label}`}
                    title={`Ocultar coluna ${label}`}
                  >
                    👁
                  </button>
                ) : null}
              </div>
              <div className="header-menu-filter-actions">
                <button type="button" className="ghost-button" onClick={() => setColumnFilters((current) => ({ ...current, [key]: [] }))}>
                  Todos
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setColumnFilters((current) => ({ ...current, [key]: [tableColumnFilterNoneValue] }))}
                >
                  Nenhum
                </button>
              </div>
              <div className="header-menu-list">
                {distinctValues.map((value) => {
                  const checked = selectedValueSet.has((normalizeFilterValue ?? ((item: string) => item))(String(value)))
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => ({
                            ...current,
                            [key]: buildNextColumnFilterValues(
                              current[key] ?? [],
                              distinctValues,
                              value,
                              checked,
                              normalizeFilterValue,
                              storeFilterValue,
                            ),
                          }))
                        }
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </th>
  )
}

export function renderColumnHeader(
  key: ColumnKey,
  label: string,
  openColumnMenu: ColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<ColumnKey | null>>,
  columnFilters: Partial<Record<ColumnKey, string[]>>,
  distinctColumnValues: Record<ColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<ColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<ColumnKey, boolean>>>,
  columnSort: ColumnSort<ColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<ColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericProductColumn(key)),
    stickyKey: 'product',
  })
}

export function renderTechnicalSheetColumnHeader(
  key: TechnicalSheetColumnKey,
  label: string,
  openColumnMenu: TechnicalSheetColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<TechnicalSheetColumnKey | null>>,
  columnFilters: Partial<Record<TechnicalSheetColumnKey, string[]>>,
  distinctColumnValues: Record<TechnicalSheetColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<TechnicalSheetColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<TechnicalSheetColumnKey, boolean>>>,
  columnSort: ColumnSort<TechnicalSheetColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<TechnicalSheetColumnKey> | null>>,
  dragOptions?: ColumnDragOptions,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericTechnicalSheetColumn(key)),
    stickyKey: 'product',
    dragOptions,
  })
}

export function renderItemColumnHeader(
  key: ItemColumnKey,
  label: string,
  openColumnMenu: ItemColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<ItemColumnKey | null>>,
  columnFilters: Partial<Record<ItemColumnKey, string[]>>,
  distinctColumnValues: Record<ItemColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<ItemColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<ItemColumnKey, boolean>>>,
  columnSort: ColumnSort<ItemColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<ItemColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericItemColumn(key)),
    stickyKey: 'item',
  })
}

export function renderStockCenterMinimumColumnHeader(
  key: StockCenterMinimumColumnKey,
  label: string,
  openColumnMenu: StockCenterMinimumColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<StockCenterMinimumColumnKey | null>>,
  columnFilters: Partial<Record<StockCenterMinimumColumnKey, string[]>>,
  distinctColumnValues: Record<StockCenterMinimumColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<StockCenterMinimumColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<StockCenterMinimumColumnKey, boolean>>>,
  columnSort: ColumnSort<StockCenterMinimumColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<StockCenterMinimumColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericStockCenterMinimumColumn(key)),
    stickyKey: 'sheet',
  })
}

export function renderInventoryReviewColumnHeader(
  key: InventoryReviewColumnKey,
  label: string,
  openColumnMenu: InventoryReviewColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<InventoryReviewColumnKey | null>>,
  columnFilters: Partial<Record<InventoryReviewColumnKey, string[]>>,
  distinctColumnValues: Record<InventoryReviewColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<InventoryReviewColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<InventoryReviewColumnKey, boolean>>>,
  columnSort: ColumnSort<InventoryReviewColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<InventoryReviewColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericInventoryReviewColumn(key)),
    stickyKey: 'product',
  })
}

export function renderInventorySummaryColumnHeader(
  key: InventorySummaryColumnKey,
  label: string,
  openColumnMenu: InventorySummaryColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<InventorySummaryColumnKey | null>>,
  columnFilters: Partial<Record<InventorySummaryColumnKey, string[]>>,
  distinctColumnValues: Record<InventorySummaryColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<InventorySummaryColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<InventorySummaryColumnKey, boolean>>>,
  columnSort: ColumnSort<InventorySummaryColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<InventorySummaryColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericInventorySummaryColumn(key)),
    stickyKey: 'product',
  })
}

export function renderRequisitionDraftColumnHeader(
  key: RequisitionDraftColumnKey,
  label: string,
  openColumnMenu: RequisitionDraftColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<RequisitionDraftColumnKey | null>>,
  columnFilters: Partial<Record<RequisitionDraftColumnKey, string[]>>,
  distinctColumnValues: Record<RequisitionDraftColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<RequisitionDraftColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<RequisitionDraftColumnKey, boolean>>>,
  columnSort: ColumnSort<RequisitionDraftColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<RequisitionDraftColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericRequisitionDraftColumn(key)),
    stickyKey: 'item',
  })
}

export function renderRequisitionHistoryColumnHeader(
  key: RequisitionHistoryColumnKey,
  label: string,
  openColumnMenu: RequisitionHistoryColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<RequisitionHistoryColumnKey | null>>,
  columnFilters: Partial<Record<RequisitionHistoryColumnKey, string[]>>,
  distinctColumnValues: Record<RequisitionHistoryColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<RequisitionHistoryColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<RequisitionHistoryColumnKey, boolean>>>,
  columnSort: ColumnSort<RequisitionHistoryColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<RequisitionHistoryColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericRequisitionHistoryColumn(key)),
    stickyKey: 'center',
  })
}

export function renderRequisitionFlowColumnHeader(
  key: RequisitionFlowColumnKey,
  label: string,
  openColumnMenu: RequisitionFlowColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<RequisitionFlowColumnKey | null>>,
  columnFilters: Partial<Record<RequisitionFlowColumnKey, string[]>>,
  distinctColumnValues: Record<RequisitionFlowColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<RequisitionFlowColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<RequisitionFlowColumnKey, boolean>>>,
  columnSort: ColumnSort<RequisitionFlowColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<RequisitionFlowColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericRequisitionFlowColumn(key)),
    stickyKey: 'center',
  })
}

export function renderReceiveReviewColumnHeader(
  key: ReceiveReviewColumnKey,
  label: string,
  openColumnMenu: ReceiveReviewColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<ReceiveReviewColumnKey | null>>,
  columnFilters: Partial<Record<ReceiveReviewColumnKey, string[]>>,
  distinctColumnValues: Record<ReceiveReviewColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<ReceiveReviewColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<ReceiveReviewColumnKey, boolean>>>,
  columnSort: ColumnSort<ReceiveReviewColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<ReceiveReviewColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(key === 'sent'),
    stickyKey: 'item',
  })
}

export function renderPurchaseDemandColumnHeader(
  key: PurchaseDemandColumnKey,
  label: string,
  openColumnMenu: PurchaseDemandColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<PurchaseDemandColumnKey | null>>,
  columnFilters: Partial<Record<PurchaseDemandColumnKey, string[]>>,
  distinctColumnValues: Record<PurchaseDemandColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<PurchaseDemandColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<PurchaseDemandColumnKey, boolean>>>,
  columnSort: ColumnSort<PurchaseDemandColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<PurchaseDemandColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(isNumericPurchaseDemandColumn(key)),
    stickyKey: 'product',
    stopMenuPropagation: true,
  })
}

export function renderStockReportColumnHeader(
  key: StockReportColumnKey,
  label: string,
  openColumnMenu: StockReportColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<StockReportColumnKey | null>>,
  columnFilters: Partial<Record<StockReportColumnKey, string[]>>,
  distinctColumnValues: Record<StockReportColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<StockReportColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<StockReportColumnKey, boolean>>>,
  columnSort: ColumnSort<StockReportColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<StockReportColumnKey> | null>>,
  dragOptions?: ColumnDragOptions,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(key === 'quantity'),
    stickyKey: 'main',
    dragOptions,
    normalizeFilterValue: normalizeRegistrationText,
    storeFilterValue: normalizeRegistrationText,
    stopMenuPropagation: true,
  })
}

export function renderClosedInventoryColumnHeader(
  key: ClosedInventoryColumnKey,
  label: string,
  openColumnMenu: ClosedInventoryColumnKey | null,
  setOpenColumnMenu: Dispatch<SetStateAction<ClosedInventoryColumnKey | null>>,
  columnFilters: Partial<Record<ClosedInventoryColumnKey, string[]>>,
  distinctColumnValues: Record<ClosedInventoryColumnKey, string[]>,
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<ClosedInventoryColumnKey, string[]>>>>,
  setColumnVisibility: Dispatch<SetStateAction<Record<ClosedInventoryColumnKey, boolean>>>,
  columnSort: ColumnSort<ClosedInventoryColumnKey> | null,
  setColumnSort: Dispatch<SetStateAction<ColumnSort<ClosedInventoryColumnKey> | null>>,
) {
  return renderGenericColumnHeader({
    key,
    label,
    openColumnMenu,
    setOpenColumnMenu,
    columnFilters,
    distinctColumnValues,
    setColumnFilters,
    setColumnVisibility,
    columnSort,
    setColumnSort,
    sortLabels: getSortLabels(key === 'id'),
    stopMenuPropagation: true,
  })
}
