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
}: {
  rows: ExecutionPlanningListRow[]
  onCancelPlanning: (rootRequestId: number) => void
}) {
  if (rows.length === 0) {
    return null
  }

  return (
    <div className="inner-panel">
      <div className="section-heading section-heading-inline">
        <div>
          <p className="kicker">Planejamentos por ficha</p>
          <h2>Origens criadas por ficha de execucao</h2>
        </div>
      </div>
      <p className="context-copy">
        As producoes continuam na fila normal abaixo. Este bloco serve para rastrear e cancelar a origem completa da demanda enquanto ela ainda estiver pendente.
      </p>
      <div className="selector-list company-management-list">
        {rows.map((row) => (
          <article key={`execution-planning-${row.rootRequestId}`} className="list-row">
            <strong>{row.executionSheetName}</strong>
            <div className="row-meta">
              <span><strong className="meta-label">Centro:</strong> {row.centerName}</span>
              <span><strong className="meta-label">Quantidade:</strong> {row.requestedQuantityLabel}</span>
              <span><strong className="meta-label">Producoes:</strong> {row.productionCount}</span>
              <span><strong className="meta-label">Requisicoes:</strong> {row.requisitionCount}</span>
              <span><strong className="meta-label">Pendentes para cancelamento:</strong> {row.cancellableRequisitionCount}</span>
              <span><strong className="meta-label">Ja movidas/recebidas:</strong> {row.movedRequisitionCount}</span>
            </div>
            <div className="table-actions">
              <button type="button" className="danger-button" onClick={() => onCancelPlanning(row.rootRequestId)}>
                Cancelar planejamento
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
