import type {
  InventoryCountRecord,
  InventoryRecord,
  PendingInventoryMovementRecord,
  ProductRecord,
} from '../types/domain'
import {
  formatDateForDisplay,
  formatInventoryRecordCode,
  formatTimeForDisplay,
} from '../utils/core'

type InventoryPendingMovementsModalProps = {
  inventoryRecord: InventoryRecord
  stockCenterName: string
  movements: PendingInventoryMovementRecord[]
  productById: Map<string, ProductRecord>
  onClose: () => void
  getTotalCountedLabel: (record: InventoryCountRecord, productById: Map<string, ProductRecord>) => string
}

export function InventoryPendingMovementsModal({
  inventoryRecord,
  stockCenterName,
  movements,
  productById,
  onClose,
  getTotalCountedLabel,
}: InventoryPendingMovementsModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-inventory-movements-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="kicker">Inventario em andamento</p>
            <h2 id="pending-inventory-movements-title">Movimentacoes pendentes</h2>
          </div>
        </div>

        <p className="confirm-copy">
          {formatInventoryRecordCode(inventoryRecord.id)} • Centro {stockCenterName} • Data {formatDateForDisplay(inventoryRecord.countedAt)}.
          Essas movimentacoes foram registradas durante o inventario e so serao aplicadas ao estoque quando ele for finalizado.
        </p>

        {movements.length > 0 ? (
          <div className="selector-list company-management-list">
            {movements.map((movement) => (
              <article key={`pending-movement-${movement.id}`} className="list-row user-list-row">
                <div className="user-row-header">
                  <div className="inventory-record-copy">
                    <div className="user-title-group">
                      <strong>{movement.description}</strong>
                      <span className="status-pill status-warning">PENDENTE</span>
                    </div>
                    <div className="row-meta user-row-meta">
                      <div className="user-meta-line">
                        <span><strong className="meta-label">Registrado em:</strong> {formatDateForDisplay(movement.session.countedAt)} {formatTimeForDisplay(movement.createdAt)}</span>
                        <span><strong className="meta-label">Por:</strong> {movement.createdByUserName}</span>
                        <span><strong className="meta-label">Itens:</strong> {String(movement.records.length)}</span>
                      </div>
                    </div>
                    <div className="pending-movement-items">
                      {movement.records.map((record) => (
                        <span key={`pending-movement-record-${movement.id}-${record.id}`} className="pending-movement-item-chip">
                          {record.technicalSheetName}: {getTotalCountedLabel(record, productById)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Nenhuma movimentacao pendente neste inventario.</strong>
            <p>Novas movimentacoes operacionais feitas durante o inventario aparecerao aqui.</p>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </section>
    </div>
  )
}
