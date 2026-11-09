import type { ProductionRequestRow } from '../types/domain'
import { formatDecimal } from '../utils/core'
import { productionColumnOptions, useProductionQueueTable } from '../hooks/useProductionQueueTable'
import { renderProductionColumnHeader } from './tableColumnHeaders'

type ProductionTableState = ReturnType<typeof useProductionQueueTable>

type Props = {
  rows: ProductionRequestRow[]
  table: ProductionTableState
  onStart: (row: ProductionRequestRow) => void
  onCancelManual: (row: ProductionRequestRow) => void
}

export function ProductionQueueTable({ rows, table, onStart, onCancelManual }: Props) {
  const { filters, setFilters, sort, setSort, visibility, setVisibility, openMenu, setOpenMenu,
    distinctValues, visibleRows, paginatedRows, prioritySummary, hiddenColumns,
    pageCount, currentPage, setPage, pageSize } = table
  const paginationStart = visibleRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const paginationEnd = Math.min(visibleRows.length, currentPage * pageSize)
  const pages = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount]
        .filter(page => page >= 1 && page <= pageCount)))
      .sort((left, right) => left - right)
      .flatMap((page, index, all) => index > 0 && page - all[index - 1] > 1 ? ['gap' as const, page] : [page])
  const pagination = visibleRows.length > pageSize ? (
    <nav className="pagination-row" aria-label="Paginas da entrada de producoes">
      <span className="pagination-range">{formatDecimal(paginationStart)}-{formatDecimal(paginationEnd)} de {formatDecimal(visibleRows.length)}</span>
      <div className="pagination-actions">
        <button type="button" className="ghost-button pagination-button" onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1} aria-label="Pagina anterior">&lt;</button>
        {pages.map((page, index) => page === 'gap'
          ? <span key={`gap-${index}`} className="pagination-gap" aria-hidden="true">...</span>
          : <button key={page} type="button" className={page === currentPage ? 'primary-button pagination-button' : 'ghost-button pagination-button'}
              onClick={() => setPage(page)} aria-current={page === currentPage ? 'page' : undefined}>{formatDecimal(page)}</button>)}
        <button type="button" className="ghost-button pagination-button" onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage >= pageCount} aria-label="Proxima pagina">&gt;</button>
      </div>
    </nav>
  ) : null

  const header = (key: (typeof productionColumnOptions)[number][0], label: string) =>
    visibility[key] ? renderProductionColumnHeader(key, label, openMenu, setOpenMenu, filters,
      distinctValues, setFilters, setVisibility, sort, setSort) : null

  return (
    <>
      {hiddenColumns.length > 0 ? (
        <div className="hidden-columns">
          <strong>Colunas ocultas</strong>
          <div className="hidden-columns-list">
            {hiddenColumns.map(([key, label]) => (
              <button key={key} type="button" className="ghost-button hidden-column-chip"
                onClick={() => setVisibility(current => ({ ...current, [key]: true }))}>{label}</button>
            ))}
          </div>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <>
          <div className="list-summary-row" aria-live="polite">
            <span>{visibleRows.length === rows.length
              ? `${formatDecimal(visibleRows.length)} producao(oes) na fila`
              : `${formatDecimal(visibleRows.length)} de ${formatDecimal(rows.length)} producao(oes) exibida(s)`}</span>
            {prioritySummary.length > 0 ? (
              <span>Prioridades: {prioritySummary.map(([priority, count]) => `${priority}: ${formatDecimal(count)}`).join('; ')}</span>
            ) : null}
          </div>
          {pagination}
          <div className="table-wrap">
            <table className="product-table">
              <thead><tr>
                {productionColumnOptions.map(([key, label]) => header(key, label))}
                <th className="sticky-actions">Acoes</th>
              </tr></thead>
              <tbody>
                {paginatedRows.map(row => (
                  <tr key={`${row.centerId}-${row.sheetId}`}>
                    {visibility.sheet ? <td className="sticky-product-cell"><strong>{row.sheetName}</strong><div className="table-cell-support">{row.internalId}</div></td> : null}
                    {visibility.priority ? <td>{row.priority}</td> : null}
                    {visibility.current ? <td>{row.currentQuantityLabel}</td> : null}
                    {visibility.useMinimum ? <td>{row.useMinimumLabel}</td> : null}
                    {visibility.realMinimum ? <td>{row.realMinimumLabel}</td> : null}
                    {visibility.suggestion ? <td>{row.suggestedProductionLabel}</td> : null}
                    {visibility.source ? <td>{row.sourceDetails.length > 0 ? (
                      <details className="table-cell-details"><summary>{row.sourceLabel}</summary><ul>
                        {row.sourceDetails.map((detail, index) => <li key={`${row.centerId}-${row.sheetId}-source-${index}`}>{detail}</li>)}
                      </ul></details>
                    ) : row.sourceLabel}</td> : null}
                    {visibility.requestedAt ? <td>{row.requestedAtDetails.length > 0 ? (
                      <details className="table-cell-details"><summary>{row.requestedAtLabel}</summary><ul>
                        {row.requestedAtDetails.map((detail, index) => <li key={`${row.centerId}-${row.sheetId}-date-${index}`}>{detail}</li>)}
                      </ul></details>
                    ) : row.requestedAtLabel}</td> : null}
                    {visibility.status ? <td>{row.statusLabel}</td> : null}
                    <td className="sticky-actions-cell"><div className="table-actions">
                      <button type="button" className="primary-button production-action-button" onClick={() => onStart(row)}>
                        <span aria-hidden="true">▶</span><span>{row.statusLabel === 'Em producao' ? 'Continuar' : 'Produzir'}</span>
                      </button>
                      {row.cancellableManualRequestIds.length > 0 && row.statusLabel !== 'Em producao' ? (
                        <button type="button" className="icon-button icon-delete" onClick={() => onCancelManual(row)}
                          aria-label={`Cancelar entrada manual de ${row.sheetName}`} title="Cancelar entrada manual">
                          <span aria-hidden="true">×</span>
                        </button>
                      ) : null}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleRows.length === 0 ? <div className="empty-state"><strong>Nenhuma producao corresponde aos filtros.</strong></div> : null}
          {pagination}
        </>
      ) : (
        <div className="empty-state">
          <strong>Nenhuma producao pendente.</strong>
          <p>Quando o estoque do centro estiver abaixo do minimo real calculado, a sugestao aparecera aqui.</p>
        </div>
      )}
    </>
  )
}
