import type { InventoryCountSessionRecord } from '../types/domain'
import { formatDateForDisplay, formatInventoryCountSessionCode } from '../utils/core'

type InventorySelectedSessionPanelProps = {
  selectedSession: InventoryCountSessionRecord | null
  getStockCenterName: (stockCenterId: number) => string
}

export function InventorySelectedSessionPanel({
  selectedSession,
  getStockCenterName,
}: InventorySelectedSessionPanelProps) {
  if (!selectedSession) {
    return null
  }

  return (
    <div className="empty-state empty-state-inline">
      <strong>
        {formatInventoryCountSessionCode(selectedSession.id)} •{' '}
        {selectedSession.isClosed ? 'Contagem fechada' : 'Contagem em andamento'} •{' '}
        {getStockCenterName(selectedSession.stockCenterId)} • {formatDateForDisplay(selectedSession.countedAt)}
      </strong>
      <p>
        {selectedSession.isClosed
          ? 'Esta contagem foi fechada, mas pode ser reaberta pelo autor enquanto o inventario permanecer aberto.'
          : 'Registre os itens desta contagem. Se fechar agora, ela ainda podera ser retomada pelo autor enquanto o inventario estiver aberto.'}
      </p>
    </div>
  )
}
