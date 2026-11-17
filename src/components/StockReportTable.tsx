import { useState, type Dispatch, type SetStateAction } from 'react'
import { renderStockReportColumnHeader } from './tableColumnHeaders'
import type { ColumnSort, StockReportColumnKey, StockReportRow, StockReportTab } from '../types/domain'

type Props = {
  tab: StockReportTab
  columns: StockReportColumnKey[]
  rows: StockReportRow[]
  range: { topSpacerHeight: number; bottomSpacerHeight: number }
  distinctColumnValues: Record<StockReportColumnKey, string[]>
  openColumnMenu: StockReportColumnKey | null
  setOpenColumnMenu: Dispatch<SetStateAction<StockReportColumnKey | null>>
  columnFilters: Partial<Record<StockReportColumnKey, string[]>>
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<StockReportColumnKey, string[]>>>>
  setColumnVisibility: Dispatch<SetStateAction<Record<StockReportColumnKey, boolean>>>
  columnSort: ColumnSort<StockReportColumnKey> | null
  setColumnSort: Dispatch<SetStateAction<ColumnSort<StockReportColumnKey> | null>>
  setColumnOrder: Dispatch<SetStateAction<StockReportColumnKey[]>>
  onScroll: (scrollTop: number) => void
  getColumnLabel: (key: StockReportColumnKey, tab: StockReportTab) => string
  getColumnValue: (row: StockReportRow, key: StockReportColumnKey) => string
  onOpenInventorySummary: (inventoryId: number) => void
}

export function StockReportTable({
  tab, columns, rows, range, distinctColumnValues, openColumnMenu, setOpenColumnMenu,
  columnFilters, setColumnFilters, setColumnVisibility, columnSort, setColumnSort,
  setColumnOrder, onScroll, getColumnLabel, getColumnValue, onOpenInventorySummary,
}: Props) {
  const [draggedColumn, setDraggedColumn] = useState<StockReportColumnKey | null>(null)
  const [dropTarget, setDropTarget] = useState<StockReportColumnKey | null>(null)
  const hasInventoryActions = tab === 'INVENTARIOS'
  const colSpan = columns.length + (hasInventoryActions ? 1 : 0)

  return (
    <div className="table-wrap stock-report-table-wrap" onScroll={(event) => onScroll(event.currentTarget.scrollTop)}>
      <table className="product-table">
        <thead>
          <tr>
            {columns.map((key) => renderStockReportColumnHeader(
              key,
              getColumnLabel(key, tab),
              openColumnMenu,
              setOpenColumnMenu,
              columnFilters,
              distinctColumnValues,
              setColumnFilters,
              setColumnVisibility,
              columnSort,
              setColumnSort,
              {
                draggable: key !== 'main',
                isDragging: draggedColumn === key,
                isDropTarget: dropTarget === key,
                onDragStart: () => {
                  if (key !== 'main') {
                    setDraggedColumn(key)
                    setDropTarget(null)
                  }
                },
                onDragEnd: () => {
                  setDraggedColumn(null)
                  setDropTarget(null)
                },
                onDragOver: (event) => {
                  if (key !== 'main' && draggedColumn && draggedColumn !== key) {
                    event.preventDefault()
                    setDropTarget(key)
                  }
                },
                onDragLeave: () => {
                  if (dropTarget === key) setDropTarget(null)
                },
                onDrop: (event) => {
                  event.preventDefault()
                  if (!draggedColumn || draggedColumn === key || key === 'main') {
                    setDraggedColumn(null)
                    setDropTarget(null)
                    return
                  }
                  setColumnOrder((current) => {
                    const next = current.filter((columnKey) => columnKey !== draggedColumn)
                    const targetIndex = next.indexOf(key)
                    if (targetIndex < 0) return current
                    next.splice(targetIndex, 0, draggedColumn)
                    return next
                  })
                  setDraggedColumn(null)
                  setDropTarget(null)
                },
              },
            ))}
            {hasInventoryActions ? <th className="sticky-actions">Acoes</th> : null}
          </tr>
        </thead>
        <tbody>
          {range.topSpacerHeight > 0 ? (
            <tr aria-hidden="true"><td colSpan={colSpan} style={{ height: `${range.topSpacerHeight}px`, padding: 0, border: 0 }} /></tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((key) => key === 'main' ? (
                <td key={`${row.id}-${key}`} className="sticky-product-cell"><strong>{row.main}</strong></td>
              ) : (
                <td key={`${row.id}-${key}`}>{getColumnValue(row, key) || '-'}</td>
              ))}
              {hasInventoryActions ? (
                <td className="sticky-actions-cell">
                  <div className="table-actions">
                    <button
                      type="button"
                      className="icon-button icon-summary"
                      aria-label="Ver resumo do inventario"
                      title="Ver resumo do inventario"
                      onClick={() => {
                        if (typeof row.inventoryId === 'number') onOpenInventorySummary(row.inventoryId)
                      }}
                      disabled={typeof row.inventoryId !== 'number'}
                    >
                      <span aria-hidden="true">≡</span>
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
          {range.bottomSpacerHeight > 0 ? (
            <tr aria-hidden="true"><td colSpan={colSpan} style={{ height: `${range.bottomSpacerHeight}px`, padding: 0, border: 0 }} /></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
