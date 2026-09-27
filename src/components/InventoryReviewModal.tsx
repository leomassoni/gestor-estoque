import type { Dispatch, SetStateAction } from 'react'
import type {
  ColumnSort,
  InventoryReviewColumnKey,
  InventoryReviewModalState,
  InventoryReviewRow,
} from '../types/domain'
import { formatDateForDisplay } from '../utils/core'
import { NormalizedTextInput } from './NormalizedTextField'
import { renderInventoryReviewColumnHeader } from './tableColumnHeaders'

type InventoryReviewModalProps = {
  modalState: InventoryReviewModalState
  search: string
  hiddenColumns: Array<[InventoryReviewColumnKey, string]>
  rows: InventoryReviewRow[]
  columnVisibility: Record<InventoryReviewColumnKey, boolean>
  openColumnMenu: InventoryReviewColumnKey | null
  columnFilters: Partial<Record<InventoryReviewColumnKey, string[]>>
  distinctColumnValues: Record<InventoryReviewColumnKey, string[]>
  columnSort: ColumnSort<InventoryReviewColumnKey> | null
  onClose: () => void
  onSearchChange: (value: string) => void
  onShowColumn: (key: InventoryReviewColumnKey) => void
  setOpenColumnMenu: Dispatch<SetStateAction<InventoryReviewColumnKey | null>>
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<InventoryReviewColumnKey, string[]>>>>
  setColumnVisibility: Dispatch<SetStateAction<Record<InventoryReviewColumnKey, boolean>>>
  setColumnSort: Dispatch<SetStateAction<ColumnSort<InventoryReviewColumnKey> | null>>
  onCloseCount: () => void
}

export function InventoryReviewModal({
  modalState,
  search,
  hiddenColumns,
  rows,
  columnVisibility,
  openColumnMenu,
  columnFilters,
  distinctColumnValues,
  columnSort,
  onClose,
  onSearchChange,
  onShowColumn,
  setOpenColumnMenu,
  setColumnFilters,
  setColumnVisibility,
  setColumnSort,
  onCloseCount,
}: InventoryReviewModalProps) {
  const renderHeader = (key: InventoryReviewColumnKey, label: string) =>
    columnVisibility[key]
      ? renderInventoryReviewColumnHeader(
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-card modal-card-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-review-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="kicker">Revisao</p>
            <h2 id="inventory-review-modal-title">Resumo consolidado da contagem</h2>
          </div>
        </div>

        <p className="confirm-copy">
          Centro {modalState.stockCenterName} • Data {formatDateForDisplay(modalState.countedAt)}.
          Revise os totais por produto antes de fechar. Se discordar de algo, volte para a contagem e ajuste os lancamentos.
        </p>

        <div className="list-toolbar">
          <label className="field search-field">
            <span>Buscar produto</span>
            <NormalizedTextInput
              value={search}
              onChange={onSearchChange}
              commitMode="debounce"
              placeholder="Busque por produto, IDs, familia, tipo ou status"
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
                  onClick={() => onShowColumn(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                {renderHeader('product', 'Produto')}
                {renderHeader('internalId', 'ID interno')}
                {renderHeader('companyId', 'ID empresa')}
                {renderHeader('type', 'Tipo')}
                {renderHeader('family', 'Familia')}
                {renderHeader('total', 'Total contado')}
                {renderHeader('unit', 'Unidade')}
                {renderHeader('status', 'Status')}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={row.isZero ? 'inventory-review-zero-row' : ''}>
                  {columnVisibility.product ? <td className="sticky-product-cell"><strong>{row.name}</strong></td> : null}
                  {columnVisibility.internalId ? <td>{row.internalId}</td> : null}
                  {columnVisibility.companyId ? <td>{row.companyProductId}</td> : null}
                  {columnVisibility.type ? <td>{row.kindLabel}</td> : null}
                  {columnVisibility.family ? <td>{row.family || '-'}</td> : null}
                  {columnVisibility.total ? <td>{row.totalCountedLabel}</td> : null}
                  {columnVisibility.unit ? <td>{row.unitLabel}</td> : null}
                  {columnVisibility.status ? <td>{row.statusLabel}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            Voltar a contagem
          </button>
          <button className="warning-button" type="button" onClick={onCloseCount}>
            Fechar contagem
          </button>
        </div>
      </section>
    </div>
  )
}
