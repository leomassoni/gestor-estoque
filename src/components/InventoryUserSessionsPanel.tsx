import type { InventoryCountSessionRecord } from '../types/domain'
import { formatDateForDisplay, formatInventoryCountSessionCode } from '../utils/core'

type InventoryUserSessionsPanelProps = {
  sessions: InventoryCountSessionRecord[]
  selectedSessionId: number | null
  isStartingInventoryCountSession: boolean
  getStockCenterName: (stockCenterId: number) => string
  canManageSession: (sessionRecord: InventoryCountSessionRecord) => boolean
  onShowSummary: (sessionRecord: InventoryCountSessionRecord) => void
  onContinueSession: (sessionId: number) => void
  onDeleteSession: (sessionRecord: InventoryCountSessionRecord) => void
}

export function InventoryUserSessionsPanel({
  sessions,
  selectedSessionId,
  isStartingInventoryCountSession,
  getStockCenterName,
  canManageSession,
  onShowSummary,
  onContinueSession,
  onDeleteSession,
}: InventoryUserSessionsPanelProps) {
  if (sessions.length === 0) {
    return null
  }

  return (
    <div className="empty-state empty-state-inline">
      <strong>Suas contagens neste inventario</strong>
      <p>
        Escolha uma contagem sua para continuar nela. Se ela estiver fechada, sera reaberta enquanto o inventario permanecer
        aberto. Apenas contagens fechadas entram na consolidacao do inventario.
      </p>
      <div className="selector-list company-management-list">
        {sessions.map((sessionRecord) => {
          const isCurrentOpenSession = selectedSessionId === sessionRecord.id && !sessionRecord.isClosed

          return (
            <article key={sessionRecord.id} className="list-row user-list-row">
              <div className="user-row-header">
                <div className="inventory-record-copy">
                  <div className="user-title-group">
                    <strong>{formatInventoryCountSessionCode(sessionRecord.id)}</strong>
                    <span className={sessionRecord.isClosed ? 'status-pill status-inactive' : 'status-pill status-active'}>
                      {sessionRecord.isClosed ? 'FECHADA' : 'ABERTA'}
                    </span>
                  </div>
                  <div className="row-meta user-row-meta">
                    <div className="user-meta-line">
                      <span>
                        <strong className="meta-label">Data:</strong> {formatDateForDisplay(sessionRecord.countedAt)}
                      </span>
                      <span>
                        <strong className="meta-label">Centro:</strong> {getStockCenterName(sessionRecord.stockCenterId)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="row-actions inventory-session-row-actions">
                  <button type="button" className="ghost-button" onClick={() => onShowSummary(sessionRecord)}>
                    Resumo
                  </button>
                  <button
                    type="button"
                    className={selectedSessionId === sessionRecord.id ? 'ghost-button' : 'primary-button'}
                    onClick={() => onContinueSession(sessionRecord.id)}
                    disabled={isStartingInventoryCountSession}
                  >
                    {isCurrentOpenSession ? 'Contagem atual' : 'Continuar'}
                  </button>
                  {canManageSession(sessionRecord) ? (
                    <button type="button" className="danger-button" onClick={() => onDeleteSession(sessionRecord)}>
                      Excluir
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
