import type { InventoryRecord } from '../types/domain'
import { formatDateForDisplay, formatInventoryRecordCode, formatTimeForDisplay } from '../utils/core'

type InventorySelectedRecordPanelProps = {
  selectedInventoryRecord: InventoryRecord | null
  pendingMovementCount: number
  isPreparingInventoryClose: boolean
  isClosingInventoryRecord: boolean
  getStockCenterName: (stockCenterId: number) => string
  onShowPendingMovements: () => void
  onLeaveInventory: (inventoryRecord: InventoryRecord) => void
  onRequestCloseInventory: (inventoryRecord: InventoryRecord) => void
}

export function InventorySelectedRecordPanel({
  selectedInventoryRecord,
  pendingMovementCount,
  isPreparingInventoryClose,
  isClosingInventoryRecord,
  getStockCenterName,
  onShowPendingMovements,
  onLeaveInventory,
  onRequestCloseInventory,
}: InventorySelectedRecordPanelProps) {
  if (!selectedInventoryRecord) {
    return null
  }

  const isOpen = !selectedInventoryRecord.isClosed
  const stockCenterName = getStockCenterName(selectedInventoryRecord.stockCenterId)

  return (
    <div className="empty-state empty-state-inline">
      <strong>
        {formatInventoryRecordCode(selectedInventoryRecord.id)} •{' '}
        {selectedInventoryRecord.isClosed ? 'Inventario fechado' : 'Inventario em andamento'} • {stockCenterName} •{' '}
        {formatDateForDisplay(selectedInventoryRecord.countedAt)}
      </strong>
      <p>
        Inicio {formatTimeForDisplay(selectedInventoryRecord.startedAt)}.{' '}
        {selectedInventoryRecord.isClosed
          ? 'Este inventario ja foi finalizado e seu saldo consolidado ja entrou nas movimentacoes.'
          : 'Abra uma ou mais contagens dentro deste inventario. O movimento de estoque so sera gerado quando o inventario for finalizado apos a revisao das contagens no servidor.'}
      </p>
      {isOpen && pendingMovementCount > 0 ? (
        <p className="compact-feedback">
          Existem {String(pendingMovementCount)} movimentacao(oes) operacional(is) pendente(s) para este inventario. Elas so
          entrarao no estoque depois da finalizacao do inventario.
        </p>
      ) : null}
      {isOpen ? (
        <div className="form-actions inventory-record-actions">
          {pendingMovementCount > 0 ? (
            <button type="button" className="ghost-button" onClick={onShowPendingMovements}>
              Ver movimentacoes pendentes
            </button>
          ) : null}
          <button type="button" className="ghost-button" onClick={() => onLeaveInventory(selectedInventoryRecord)}>
            Sair do inventario
          </button>
          <button
            type="button"
            className="warning-button"
            onClick={() => onRequestCloseInventory(selectedInventoryRecord)}
            disabled={isPreparingInventoryClose || isClosingInventoryRecord}
          >
            {isPreparingInventoryClose ? 'Revisando contagens...' : 'Finalizar inventario'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
