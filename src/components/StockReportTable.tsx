import { useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { renderStockReportColumnHeader } from './tableColumnHeaders'
import { stockReportOverscanRows, stockReportRowHeightPx, stockReportViewportHeightPx } from '../config/performance'
import type { ColumnSort, StockReportColumnKey, StockReportRow, StockReportTab } from '../types/domain'

type Props = {
  tab: StockReportTab
  columns: StockReportColumnKey[]
  rows: StockReportRow[]
  scrollPositionRef: { current: number }
  distinctColumnValues: Record<StockReportColumnKey, string[]>
  openColumnMenu: StockReportColumnKey | null
  setOpenColumnMenu: Dispatch<SetStateAction<StockReportColumnKey | null>>
  columnFilters: Partial<Record<StockReportColumnKey, string[]>>
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<StockReportColumnKey, string[]>>>>
  setColumnVisibility: Dispatch<SetStateAction<Record<StockReportColumnKey, boolean>>>
  columnSort: ColumnSort<StockReportColumnKey> | null
  setColumnSort: Dispatch<SetStateAction<ColumnSort<StockReportColumnKey> | null>>
  setColumnOrder: Dispatch<SetStateAction<StockReportColumnKey[]>>
  getColumnLabel: (key: StockReportColumnKey, tab: StockReportTab) => string
  getColumnValue: (row: StockReportRow, key: StockReportColumnKey) => string
  onOpenInventorySummary: (inventoryId: number) => void
}

export function StockReportTable({
  tab, columns, rows, scrollPositionRef, distinctColumnValues, openColumnMenu, setOpenColumnMenu,
  columnFilters, setColumnFilters, setColumnVisibility, columnSort, setColumnSort,
  setColumnOrder, getColumnLabel, getColumnValue, onOpenInventorySummary,
}: Props) {
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [draggedColumn, setDraggedColumn] = useState<StockReportColumnKey | null>(null)
  const [dropTarget, setDropTarget] = useState<StockReportColumnKey | null>(null)
  const hasInventoryActions = tab === 'INVENTARIOS'
  const colSpan = columns.length + (hasInventoryActions ? 1 : 0)
  const range = useMemo(() => {
    const totalRows = rows.length
    const visibleRowCount = Math.ceil(stockReportViewportHeightPx / stockReportRowHeightPx)
    const pageRowCount = visibleRowCount + stockReportOverscanRows * 2
    const startIndex = Math.min(
      Math.max(0, Math.floor(scrollTop / stockReportRowHeightPx) - stockReportOverscanRows),
      Math.max(0, totalRows - pageRowCount),
    )
    const endIndex = Math.min(totalRows, startIndex + pageRowCount)
    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * stockReportRowHeightPx,
      bottomSpacerHeight: Math.max(0, (totalRows - endIndex) * stockReportRowHeightPx),
    }
  }, [rows.length, scrollTop])
  const visibleRows = useMemo(() => rows.slice(range.startIndex, range.endIndex), [range.endIndex, range.startIndex, rows])

  useLayoutEffect(() => {
    const tableWrap = tableWrapRef.current
    if (!tableWrap || rows.length === 0) return
    let observer: ResizeObserver | null = null
    const syncScroll = () => {
      if (scrollPositionRef.current > 0 && tableWrap.scrollHeight <= tableWrap.clientHeight) return
      if (scrollPositionRef.current > 0 && tableWrap.scrollTop === 0) {
        tableWrap.scrollTop = scrollPositionRef.current
      }
      const actualScrollTop = tableWrap.scrollTop
      scrollPositionRef.current = actualScrollTop
      setScrollTop((current) => current === actualScrollTop ? current : actualScrollTop)
      observer?.disconnect()
    }
    syncScroll()
    if (scrollPositionRef.current > 0 && tableWrap.scrollHeight <= tableWrap.clientHeight) {
      const table = tableWrap.querySelector('table')
      if (table) {
        observer = new ResizeObserver(syncScroll)
        observer.observe(table)
      }
    }
    return () => observer?.disconnect()
  }, [rows, scrollPositionRef, scrollTop])

  return (
    <div
      ref={tableWrapRef}
      className="table-wrap stock-report-table-wrap"
      onScroll={(event) => {
        const nextScrollTop = event.currentTarget.scrollTop
        if (nextScrollTop === 0 && scrollPositionRef.current > 0 && event.currentTarget.scrollHeight <= event.currentTarget.clientHeight) {
          setScrollTop(0)
          return
        }
        scrollPositionRef.current = nextScrollTop
        setScrollTop(nextScrollTop)
      }}
    >
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
          {visibleRows.map((row) => (
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
