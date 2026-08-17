type ExecutionPlanningListRow = {
  rootRequestId: number
  centerName: string
  executionSheetName: string
  requestedQuantityLabel: string
  productionCount: number
  requisitionCount: number
  cancellableRequisitionCount: number
  movedRequisitionCount: number
}

export function ExecutionPlanningList({
  rows,
  onCancelPlanning,
  selectedRootRequestIds,
  selectedCount,
  onTogglePlanningSelection,
  onToggleAllPlanningSelection,
  onCancelSelectedPlanning,
}: {
  rows: ExecutionPlanningListRow[]
  onCancelPlanning: (rootRequestId: number) => void
  selectedRootRequestIds?: Set<number>
  selectedCount?: number
  onTogglePlanningSelection?: (rootRequestId: number, isSelected: boolean) => void
  onToggleAllPlanningSelection?: (isSelected: boolean) => void
  onCancelSelectedPlanning?: () => void
}) {
  if (rows.length === 0) {
    return null
  }

  const selectionEnabled = Boolean(selectedRootRequestIds && onTogglePlanningSelection && onToggleAllPlanningSelection)
  const allRowsSelected = selectionEnabled && rows.every((row) => selectedRootRequestIds?.has(row.rootRequestId))

  return (
    <div className="inner-panel production-planning-panel">
      <div className="section-heading section-heading-inline">
        <div>
          <p className="kicker">Planejamentos por ficha</p>
          <h2>Origens criadas por ficha de execucao</h2>
        </div>
        {onCancelSelectedPlanning ? (
          <button
            type="button"
            className="danger-button"
            onClick={onCancelSelectedPlanning}
            disabled={(selectedCount ?? 0) === 0}
          >
            Cancelar selecionados ({selectedCount ?? 0})
          </button>
        ) : null}
      </div>
      <p className="context-copy">
        As producoes continuam na fila normal abaixo. Este bloco serve para rastrear e cancelar a origem completa da demanda enquanto ela ainda estiver pendente.
      </p>
      <div className="table-wrap">
        <table className="product-table">
          <thead>
            <tr>
              {selectionEnabled ? (
                <th>
                  <input
                    type="checkbox"
                    aria-label="Selecionar planejamentos exibidos"
                    checked={allRowsSelected}
                    onChange={(event) => onToggleAllPlanningSelection?.(event.target.checked)}
                  />
                </th>
              ) : null}
              <th className="sticky-product">Ficha de execucao</th>
              <th>Centro</th>
              <th>Quantidade</th>
              <th>Producoes</th>
              <th>Requisicoes</th>
              <th>Pendentes</th>
              <th>Ja movidas</th>
              <th className="sticky-actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`execution-planning-${row.rootRequestId}`}>
                {selectionEnabled ? (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar planejamento ${row.executionSheetName}`}
                      checked={selectedRootRequestIds?.has(row.rootRequestId) ?? false}
                      onChange={(event) => onTogglePlanningSelection?.(row.rootRequestId, event.target.checked)}
                    />
                  </td>
                ) : null}
                <td className="sticky-product-cell">
                  <strong>{row.executionSheetName}</strong>
                  <div className="table-cell-support">Planejamento #{row.rootRequestId}</div>
                </td>
                <td>{row.centerName}</td>
                <td>{row.requestedQuantityLabel}</td>
                <td>{row.productionCount}</td>
                <td>{row.requisitionCount}</td>
                <td>{row.cancellableRequisitionCount}</td>
                <td>{row.movedRequisitionCount}</td>
                <td className="sticky-actions-cell">
                  <div className="table-actions">
                    <button
                      type="button"
                      className="icon-button icon-delete"
                      onClick={() => onCancelPlanning(row.rootRequestId)}
                      aria-label={`Cancelar planejamento ${row.executionSheetName}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
