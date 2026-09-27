import type { Dispatch, SetStateAction } from 'react'
import type { ClosedInventoryColumnKey, ColumnSort, InventoryRecord } from '../types/domain'
import {
  formatDateForDisplay,
  formatInventoryRecordCode,
  formatTimeForDisplay,
} from '../utils/core'
import { NormalizedTextInput } from './NormalizedTextField'
import { renderClosedInventoryColumnHeader } from './tableColumnHeaders'

type InventoryClosedRecordsPanelProps = {
  records: InventoryRecord[]
  filteredRecords: InventoryRecord[]
  search: string
  hiddenColumns: Array<[ClosedInventoryColumnKey, string]>
  columnVisibility: Record<ClosedInventoryColumnKey, boolean>
  openColumnMenu: ClosedInventoryColumnKey | null
  columnFilters: Partial<Record<ClosedInventoryColumnKey, string[]>>
  distinctColumnValues: Record<ClosedInventoryColumnKey, string[]>
  columnSort: ColumnSort<ClosedInventoryColumnKey> | null
  canReopenClosedInventory: boolean
  canDeleteClosedInventory: boolean
  setOpenColumnMenu: Dispatch<SetStateAction<ClosedInventoryColumnKey | null>>
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<ClosedInventoryColumnKey, string[]>>>>
  setColumnVisibility: Dispatch<SetStateAction<Record<ClosedInventoryColumnKey, boolean>>>
  setColumnSort: Dispatch<SetStateAction<ColumnSort<ClosedInventoryColumnKey> | null>>
  getStockCenterName: (stockCenterId: number) => string
  onSearchChange: (value: string) => void
  onScrollTopChange: (value: number) => void
  onOpenSummary: (inventoryRecord: InventoryRecord) => void
  onReopenInventory: (inventoryId: number) => void
  onDeleteInventory: (inventoryRecord: InventoryRecord) => void
}

export function InventoryClosedRecordsPanel({
  records,
  filteredRecords,
  search,
  hiddenColumns,
  columnVisibility,
  openColumnMenu,
  columnFilters,
  distinctColumnValues,
  columnSort,
  canReopenClosedInventory,
  canDeleteClosedInventory,
  setOpenColumnMenu,
  setColumnFilters,
  setColumnVisibility,
  setColumnSort,
  getStockCenterName,
  onSearchChange,
  onScrollTopChange,
  onOpenSummary,
  onReopenInventory,
  onDeleteInventory,
}: InventoryClosedRecordsPanelProps) {
  if (records.length === 0) {
    return (
      <div className="empty-state">
        <strong>Nenhum inventario fechado encontrado.</strong>
        <p>Finalize inventarios para que eles passem a aparecer neste historico operacional.</p>
      </div>
    )
  }

  const renderHeader = (key: ClosedInventoryColumnKey, label: string) =>
    columnVisibility[key]
      ? renderClosedInventoryColumnHeader(
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
        )
      : null

  return (
    <>
      <div className="list-toolbar">
        <label className="field search-field">
          <span>Buscar inventario fechado</span>
          <NormalizedTextInput
            value={search}
            onChange={onSearchChange}
            commitMode="debounce"
            placeholder="Busque por ID, data, centro, aberto por ou fechado por"
          />
        </label>
      </div>

      {hiddenColumns.length > 0 ? (
        <div className="hidden-columns">
          <strong>Colunas ocultas</strong>
          <div className="hidden-columns-list">
            {hiddenColumns.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="ghost-button hidden-column-chip"
                onClick={() =>
                  setColumnVisibility((current) => ({
                    ...current,
                    [key]: true,
                  }))
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="table-wrap" onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}>
        <table className="product-table">
          <thead>
            <tr>
              {renderHeader('id', 'ID do inventario')}
              {renderHeader('center', 'Centro de estoque')}
              {renderHeader('date', 'Data')}
              {renderHeader('startedBy', 'Aberto por')}
              {renderHeader('closedBy', 'Fechado por')}
              {renderHeader('startedAt', 'Inicio')}
              {renderHeader('closedAt', 'Fechamento')}
              <th className="sticky-actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((inventoryRecord) => (
                <tr key={`closed-inventory-${inventoryRecord.id}`}>
                  {columnVisibility.id ? <td>{formatInventoryRecordCode(inventoryRecord.id)}</td> : null}
                  {columnVisibility.center ? <td>{getStockCenterName(inventoryRecord.stockCenterId)}</td> : null}
                  {columnVisibility.date ? <td>{formatDateForDisplay(inventoryRecord.countedAt)}</td> : null}
                  {columnVisibility.startedBy ? <td>{inventoryRecord.startedByUserName}</td> : null}
                  {columnVisibility.closedBy ? <td>{inventoryRecord.closedByUserName || '-'}</td> : null}
                  {columnVisibility.startedAt ? <td>{formatTimeForDisplay(inventoryRecord.startedAt)}</td> : null}
                  {columnVisibility.closedAt ? (
                    <td>{inventoryRecord.closedAt ? formatTimeForDisplay(inventoryRecord.closedAt) : '-'}</td>
                  ) : null}
                  <td className="sticky-actions-cell">
                    <div className="table-actions">
                      <button
                        type="button"
                        className="icon-button icon-summary"
                        aria-label="Ver resumo do inventario fechado"
                        title="Ver resumo do inventario fechado"
                        onClick={() => onOpenSummary(inventoryRecord)}
                      >
                        <span aria-hidden="true">≡</span>
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-edit"
                        aria-label="Reabrir inventario fechado"
                        title="Reabrir inventario fechado"
                        onClick={() => onReopenInventory(inventoryRecord.id)}
                        disabled={!canReopenClosedInventory}
                      >
                        <span aria-hidden="true">↺</span>
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-delete"
                        aria-label="Excluir inventario fechado"
                        title="Excluir inventario fechado"
                        onClick={() => onDeleteInventory(inventoryRecord)}
                        disabled={!canDeleteClosedInventory}
                      >
                        <span aria-hidden="true">✕</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Object.values(columnVisibility).filter(Boolean).length + 1}>
                  Nenhum inventario encontrado para esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
