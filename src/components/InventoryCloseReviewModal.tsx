import type {
  InventoryCloseSessionAction,
  InventoryCloseState,
} from '../types/domain'
import {
  formatDateForDisplay,
  formatInventoryCountSessionCode,
  formatTimeForDisplay,
} from '../utils/core'

type InventoryCloseReviewModalProps = {
  closeState: InventoryCloseState
  isClosing: boolean
  onCancel: () => void
  onConfirm: () => void
  onUpdateSessionAction: (sessionId: number, action: InventoryCloseSessionAction) => void
}

export function InventoryCloseReviewModal({
  closeState,
  isClosing,
  onCancel,
  onConfirm,
  onUpdateSessionAction,
}: InventoryCloseReviewModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !isClosing && onCancel()}>
      <section
        className="modal-card modal-card-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-close-review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="kicker">Fechamento</p>
            <h2 id="inventory-close-review-title">Revisao das contagens do inventario</h2>
          </div>
        </div>

        <p className="confirm-copy">
          Centro {closeState.stockCenterName} • Data {formatDateForDisplay(closeState.countedAt)}.
          O webapp recarregou as contagens do servidor em {formatTimeForDisplay(closeState.refreshedAt)}. As contagens fechadas entram na consolidacao. Para contagens abertas, escolha se elas devem ser fechadas e consolidadas ou descartadas.
        </p>

        <div className="inventory-close-summary-grid">
          <div className="summary-metric-card">
            <span>Contagens fechadas</span>
            <strong>{String(closeState.sessions.filter((sessionRecord) => sessionRecord.isClosed).length)}</strong>
          </div>
          <div className="summary-metric-card">
            <span>Contagens abertas</span>
            <strong>{String(closeState.sessions.filter((sessionRecord) => !sessionRecord.isClosed).length)}</strong>
          </div>
          <div className="summary-metric-card">
            <span>Itens contados</span>
            <strong>{String(closeState.sessions.reduce((sum, sessionRecord) => sum + sessionRecord.itemCount, 0))}</strong>
          </div>
        </div>

        <div className="table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>Sessao</th>
                <th>Status</th>
                <th>Usuario</th>
                <th>Inicio</th>
                <th>Fechamento</th>
                <th>Itens</th>
                <th>Acao no fechamento</th>
              </tr>
            </thead>
            <tbody>
              {closeState.sessions.length > 0 ? (
                closeState.sessions.map((sessionRecord) => (
                  <tr key={`inventory-close-session-${sessionRecord.id}`}>
                    <td>{formatInventoryCountSessionCode(sessionRecord.id)}</td>
                    <td>
                      <span className={sessionRecord.isClosed ? 'status-pill status-active' : 'status-pill status-warning'}>
                        {sessionRecord.isClosed ? 'FECHADA' : 'ABERTA'}
                      </span>
                    </td>
                    <td>{sessionRecord.startedByUserName}</td>
                    <td>{formatTimeForDisplay(sessionRecord.startedAt)}</td>
                    <td>
                      {sessionRecord.isClosed
                        ? `${formatTimeForDisplay(sessionRecord.closedAt)} por ${sessionRecord.closedByUserName || '-'}`
                        : '-'}
                    </td>
                    <td>{String(sessionRecord.itemCount)}</td>
                    <td>
                      {sessionRecord.isClosed ? (
                        'Consolidar'
                      ) : (
                        <div className="inventory-close-session-actions">
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={closeState.openSessionActions[sessionRecord.id] === 'close'}
                              onChange={() => onUpdateSessionAction(sessionRecord.id, 'close')}
                            />
                            <span>Fechar e consolidar</span>
                          </label>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={closeState.openSessionActions[sessionRecord.id] === 'discard'}
                              onChange={() => onUpdateSessionAction(sessionRecord.id, 'discard')}
                            />
                            <span>Descartar</span>
                          </label>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>Nenhuma sessao de contagem vinculada a este inventario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onCancel} disabled={isClosing}>
            Cancelar
          </button>
          <button className="warning-button" type="button" onClick={onConfirm} disabled={isClosing}>
            {isClosing ? 'Finalizando...' : 'Finalizar inventario'}
          </button>
        </div>
      </section>
    </div>
  )
}
