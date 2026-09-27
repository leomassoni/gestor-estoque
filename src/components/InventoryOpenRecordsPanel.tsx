import type { InventoryRecord } from '../types/domain'
import { formatDateForDisplay, formatInventoryRecordCode, formatTimeForDisplay } from '../utils/core'

type InventoryOpenRecordsPanelProps = {
  records: InventoryRecord[]
  selectedInventoryId: number | null
  getStockCenterName: (stockCenterId: number) => string
  canManageRecord: (record: InventoryRecord) => boolean
  onJoinInventory: (inventoryId: number) => void
  onDeleteInventory: (record: InventoryRecord) => void
}

export function InventoryOpenRecordsPanel({
  records,
  selectedInventoryId,
  getStockCenterName,
  canManageRecord,
  onJoinInventory,
  onDeleteInventory,
}: InventoryOpenRecordsPanelProps) {
  if (records.length === 0) {
    return null
  }

  return (
    <>
      <div className="section-heading section-heading-inline stock-center-subheading">
        <div>
          <p className="kicker">Inventarios abertos</p>
          <h2>Participar de inventario existente</h2>
        </div>
      </div>
      <div className="selector-list company-management-list">
        {records.map((inventoryRecord) => {
          const stockCenterName = getStockCenterName(inventoryRecord.stockCenterId)

          return (
            <article key={inventoryRecord.id} className="list-row user-list-row">
              <div className="user-row-header">
                <div className="inventory-record-copy">
                  <div className="user-title-group">
                    <strong>{stockCenterName}</strong>
                    <span className="status-pill status-active">ABERTO</span>
                  </div>
                  <div className="row-meta user-row-meta">
                    <div className="user-meta-line">
                      <span>
                        <strong className="meta-label">ID:</strong> {formatInventoryRecordCode(inventoryRecord.id)}
                      </span>
                      <span>
                        <strong className="meta-label">Data:</strong> {formatDateForDisplay(inventoryRecord.countedAt)}
                      </span>
                      <span>
                        <strong className="meta-label">Inicio:</strong> {formatTimeForDisplay(inventoryRecord.startedAt)}
                      </span>
                      <span>
                        <strong className="meta-label">Aberto por:</strong> {inventoryRecord.startedByUserName}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="row-actions inventory-session-row-actions">
                  <button
                    type="button"
                    className={selectedInventoryId === inventoryRecord.id ? 'ghost-button' : 'primary-button'}
                    onClick={() => onJoinInventory(inventoryRecord.id)}
                  >
                    {selectedInventoryId === inventoryRecord.id ? 'Inventario atual' : 'Entrar'}
                  </button>
                  {canManageRecord(inventoryRecord) ? (
                    <button type="button" className="danger-button" onClick={() => onDeleteInventory(inventoryRecord)}>
                      Excluir inventario
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
