import type { Dispatch, DragEvent, SetStateAction } from 'react'
import type {
  ColumnKey,
  ColumnSort,
  InventoryReviewColumnKey,
  InventorySummaryColumnKey,
  ItemColumnKey,
  ReceiveReviewColumnKey,
  RequisitionDraftColumnKey,
  RequisitionFlowColumnKey,
  RequisitionHistoryColumnKey,
  StockCenterMinimumColumnKey,
  StockReportColumnKey,
  TechnicalSheetColumnKey,
} from '../types/domain'

function getSortLabels(isNumeric: boolean) {
  return isNumeric
    ? { asc: '0-9', desc: '9-0' }
    : { asc: 'A-Z', desc: 'Z-A' }
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

function getColumnSortLabels(key: ColumnKey) {
  return getSortLabels(isNumericProductColumn(key))
}

function getTechnicalSheetColumnSortLabels(key: TechnicalSheetColumnKey) {
  return getSortLabels(isNumericTechnicalSheetColumn(key))
}

function getItemColumnSortLabels(key: ItemColumnKey) {
  return getSortLabels(isNumericItemColumn(key))
}

function isNumericStockCenterMinimumColumn(key: StockCenterMinimumColumnKey) {
  return key === 'yield' || key === 'minimum' || key === 'realMinimum' || key === 'consolidatedMinimum'
}

function getStockCenterMinimumColumnSortLabels(key: StockCenterMinimumColumnKey) {
  return getSortLabels(isNumericStockCenterMinimumColumn(key))
}

function isNumericInventoryReviewColumn(key: InventoryReviewColumnKey) {
  return key === 'total'
}

function getInventoryReviewColumnSortLabels(key: InventoryReviewColumnKey) {
  return getSortLabels(isNumericInventoryReviewColumn(key))
}

function isNumericInventorySummaryColumn(key: InventorySummaryColumnKey) {
  return key === 'closed' || key === 'open' || key === 'total'
}

function getInventorySummaryColumnSortLabels(key: InventorySummaryColumnKey) {
  return getSortLabels(isNumericInventorySummaryColumn(key))
}

function isNumericRequisitionDraftColumn(key: RequisitionDraftColumnKey) {
  return key === 'current' || key === 'requested' || key === 'suggestion'
}

function getRequisitionDraftColumnSortLabels(key: RequisitionDraftColumnKey) {
  return getSortLabels(isNumericRequisitionDraftColumn(key))
}

function isNumericRequisitionHistoryColumn(key: RequisitionHistoryColumnKey) {
  return key === 'items'
}

function getRequisitionHistoryColumnSortLabels(key: RequisitionHistoryColumnKey) {
  return getSortLabels(isNumericRequisitionHistoryColumn(key))
}

function isNumericRequisitionFlowColumn(key: RequisitionFlowColumnKey) {
  return key === 'items'
}

function getRequisitionFlowColumnSortLabels(key: RequisitionFlowColumnKey) {
  return getSortLabels(isNumericRequisitionFlowColumn(key))
}

function getReceiveReviewColumnSortLabels(key: ReceiveReviewColumnKey) {
  return getSortLabels(key === 'sent')
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'product' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                    setColumnFilters((current) => ({
                      ...current,
                      [key]: [],
                    }))
                  }}
                  aria-label={`Limpar filtros da coluna ${label}`}
                  title={`Limpar filtros da coluna ${label}`}
                >
                  🧹
                </button>
                {key !== 'product' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked
                              ? values.filter((item) => item !== value)
                              : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  dragOptions?: {
    draggable?: boolean
    isDragging?: boolean
    isDropTarget?: boolean
    onDragStart?: () => void
    onDragEnd?: () => void
    onDragOver?: (event: DragEvent<HTMLTableCellElement>) => void
    onDragLeave?: () => void
    onDrop?: (event: DragEvent<HTMLTableCellElement>) => void
  },
) {
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getTechnicalSheetColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[
        openColumnMenu === key ? 'menu-open' : '',
        key === 'product' ? 'sticky-product' : '',
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
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                    setColumnFilters((current) => ({
                      ...current,
                      [key]: [],
                    }))
                  }}
                  aria-label={`Limpar filtros da coluna ${label}`}
                  title={`Limpar filtros da coluna ${label}`}
                >
                  🧹
                </button>
                {key !== 'product' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked
                              ? values.filter((item) => item !== value)
                              : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getItemColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'item' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                    setColumnFilters((current) => ({
                      ...current,
                      [key]: [],
                    }))
                  }}
                  aria-label={`Limpar filtros da coluna ${label}`}
                  title={`Limpar filtros da coluna ${label}`}
                >
                  🧹
                </button>
                {key !== 'item' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked
                              ? values.filter((item) => item !== value)
                              : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getStockCenterMinimumColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'sheet' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                    setColumnFilters((current) => ({
                      ...current,
                      [key]: [],
                    }))
                  }}
                  aria-label={`Limpar filtros da coluna ${label}`}
                  title={`Limpar filtros da coluna ${label}`}
                >
                  🧹
                </button>
                {key !== 'sheet' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked
                              ? values.filter((item) => item !== value)
                              : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getInventoryReviewColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'product' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                {key !== 'product' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked ? values.filter((item) => item !== value) : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getInventorySummaryColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'product' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                {key !== 'product' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked ? values.filter((item) => item !== value) : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getRequisitionDraftColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'item' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                {key !== 'item' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked ? values.filter((item) => item !== value) : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getRequisitionHistoryColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'center' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                {key !== 'center' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked ? values.filter((item) => item !== value) : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getRequisitionFlowColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'center' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                {key !== 'center' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked ? values.filter((item) => item !== value) : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  const activeFilters = columnFilters[key] ?? []
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getReceiveReviewColumnSortLabels(key)

  return (
    <th
      key={key}
      className={[openColumnMenu === key ? 'menu-open' : '', key === 'item' ? 'sticky-product' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="header-cell">
        <span>
          {label}
          {sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''}
        </span>
        <div className="header-tools">
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
            <div className="header-menu">
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
                {key !== 'item' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const checked = activeFilters.includes(value)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = current[key] ?? []
                            const nextValues = checked ? values.filter((item) => item !== value) : [...values, value]
                            return { ...current, [key]: nextValues }
                          })
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
  dragOptions?: {
    draggable?: boolean
    isDragging?: boolean
    isDropTarget?: boolean
    onDragStart?: () => void
    onDragEnd?: () => void
    onDragOver?: (event: DragEvent<HTMLTableCellElement>) => void
    onDragLeave?: () => void
    onDrop?: (event: DragEvent<HTMLTableCellElement>) => void
  },
) {
  const activeFilters = columnFilters[key] ?? []
  const normalizedActiveFilters = activeFilters.map((value) => normalizeRegistrationText(String(value)))
  const sortDirection = columnSort?.key === key ? columnSort.direction : null
  const sortLabels = getSortLabels(key === 'quantity')

  return (
    <th
      key={key}
      className={[
        openColumnMenu === key ? 'menu-open' : '',
        key === 'main' ? 'sticky-product' : '',
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
          {activeFilters.length > 0 ? <span className="header-filter-count">{activeFilters.length}</span> : null}
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
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
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
                {key !== 'main' ? (
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
              <div className="header-menu-list">
                {distinctColumnValues[key].map((value) => {
                  const normalizedValue = normalizeRegistrationText(String(value))
                  const checked = normalizedActiveFilters.includes(normalizedValue)
                  return (
                    <label key={`${key}-${value}`} className="header-menu-option">
                      <span>{value || '(vazio)'}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setColumnFilters((current) => {
                            const values = (current[key] ?? []).map((item) => normalizeRegistrationText(String(item)))
                            const nextValues = checked
                              ? values.filter((item) => item !== normalizedValue)
                              : [...values, normalizedValue]
                            return { ...current, [key]: nextValues }
                          })
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
