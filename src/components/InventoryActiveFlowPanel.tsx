import type {
  InventoryCountSessionRecord,
  InventoryFormState,
  InventoryRecord,
  StockCenterRecord,
} from '../types/domain'
import { InventoryCountItemEntryPanel, type InventoryCountItemEntryPanelProps } from './InventoryCountItemEntryPanel'
import { InventoryOpenRecordsPanel } from './InventoryOpenRecordsPanel'
import { InventorySelectedRecordPanel } from './InventorySelectedRecordPanel'
import { InventorySelectedSessionPanel } from './InventorySelectedSessionPanel'
import { InventoryStartPanel } from './InventoryStartPanel'
import { InventoryUserSessionsPanel } from './InventoryUserSessionsPanel'

type InventoryActiveFlowPanelProps = {
  eligibleStockCenters: StockCenterRecord[]
  visibleOpenInventoryRecords: InventoryRecord[]
  selectedInventoryRecord: InventoryRecord | null
  selectedInventoryPendingMovementCount: number
  isPreparingInventoryClose: boolean
  isClosingInventoryRecord: boolean
  inventoryForm: InventoryFormState
  inventoryErrors: Partial<Record<keyof InventoryFormState, string>>
  selectedInventoryCountSession: InventoryCountSessionRecord | null
  selectedUserInventoryCountSessions: InventoryCountSessionRecord[]
  isStartingInventoryRecord: boolean
  isStartingInventoryCountSession: boolean
  countEntryProps: InventoryCountItemEntryPanelProps
  getStockCenterName: (stockCenterId: number) => string
  canManageRecord: (inventoryRecord: InventoryRecord) => boolean
  canManageSession: (sessionRecord: InventoryCountSessionRecord) => boolean
  onJoinInventory: (inventoryId: number) => void
  onDeleteInventory: (inventoryRecord: InventoryRecord) => void
  onShowPendingMovements: () => void
  onLeaveInventory: (inventoryRecord: InventoryRecord) => void
  onRequestCloseInventory: (inventoryRecord: InventoryRecord) => void
  onUpdateInventoryFormField: <K extends keyof InventoryFormState>(field: K, value: InventoryFormState[K]) => void
  onStartInventoryRecord: () => void
  onStartInventoryCountSession: () => void
  onShowSessionSummary: (sessionRecord: InventoryCountSessionRecord) => void
  onContinueSession: (sessionId: number) => void
  onDeleteSession: (sessionRecord: InventoryCountSessionRecord) => void
}

export function InventoryActiveFlowPanel({
  eligibleStockCenters,
  visibleOpenInventoryRecords,
  selectedInventoryRecord,
  selectedInventoryPendingMovementCount,
  isPreparingInventoryClose,
  isClosingInventoryRecord,
  inventoryForm,
  inventoryErrors,
  selectedInventoryCountSession,
  selectedUserInventoryCountSessions,
  isStartingInventoryRecord,
  isStartingInventoryCountSession,
  countEntryProps,
  getStockCenterName,
  canManageRecord,
  canManageSession,
  onJoinInventory,
  onDeleteInventory,
  onShowPendingMovements,
  onLeaveInventory,
  onRequestCloseInventory,
  onUpdateInventoryFormField,
  onStartInventoryRecord,
  onStartInventoryCountSession,
  onShowSessionSummary,
  onContinueSession,
  onDeleteSession,
}: InventoryActiveFlowPanelProps) {
  if (eligibleStockCenters.length === 0) {
    return (
      <div className="empty-state">
        <strong>Nenhum centro de estoque disponivel para este usuario.</strong>
        <p>Vincule o usuario a pelo menos um centro de estoque para liberar a contagem.</p>
      </div>
    )
  }

  return (
    <>
      <InventoryOpenRecordsPanel
        records={visibleOpenInventoryRecords}
        selectedInventoryId={selectedInventoryRecord?.id ?? null}
        getStockCenterName={getStockCenterName}
        canManageRecord={canManageRecord}
        onJoinInventory={onJoinInventory}
        onDeleteInventory={onDeleteInventory}
      />

      <InventorySelectedRecordPanel
        selectedInventoryRecord={selectedInventoryRecord}
        pendingMovementCount={selectedInventoryPendingMovementCount}
        isPreparingInventoryClose={isPreparingInventoryClose}
        isClosingInventoryRecord={isClosingInventoryRecord}
        getStockCenterName={getStockCenterName}
        onShowPendingMovements={onShowPendingMovements}
        onLeaveInventory={onLeaveInventory}
        onRequestCloseInventory={onRequestCloseInventory}
      />

      <InventoryStartPanel
        eligibleStockCenters={eligibleStockCenters}
        inventoryForm={inventoryForm}
        inventoryErrors={inventoryErrors}
        selectedInventoryRecord={selectedInventoryRecord}
        selectedInventoryCountSessionIsOpen={Boolean(selectedInventoryCountSession && !selectedInventoryCountSession.isClosed)}
        selectedUserSessionCount={selectedUserInventoryCountSessions.length}
        isStartingInventoryRecord={isStartingInventoryRecord}
        isStartingInventoryCountSession={isStartingInventoryCountSession}
        getStockCenterName={getStockCenterName}
        onUpdateInventoryFormField={onUpdateInventoryFormField}
        onStartInventoryRecord={onStartInventoryRecord}
        onStartInventoryCountSession={onStartInventoryCountSession}
      />

      {selectedInventoryRecord ? (
        <>
          <InventoryUserSessionsPanel
            sessions={selectedUserInventoryCountSessions}
            selectedSessionId={selectedInventoryCountSession?.id ?? null}
            isStartingInventoryCountSession={isStartingInventoryCountSession}
            getStockCenterName={getStockCenterName}
            canManageSession={canManageSession}
            onShowSummary={onShowSessionSummary}
            onContinueSession={onContinueSession}
            onDeleteSession={onDeleteSession}
          />

          <InventorySelectedSessionPanel
            selectedSession={selectedInventoryCountSession}
            getStockCenterName={getStockCenterName}
          />

          {selectedInventoryCountSession ? (
            <InventoryCountItemEntryPanel {...countEntryProps} />
          ) : (
            <div className="empty-state empty-state-inline">
              <strong>Inicie uma contagem para continuar.</strong>
              <p>O inventario ja esta aberto. Agora inicie uma contagem dentro dele para liberar o registro dos itens.</p>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state empty-state-inline">
          <strong>Inicie um inventario para continuar.</strong>
          <p>Defina o centro e a data desejada e depois clique em iniciar inventario para liberar novas contagens.</p>
        </div>
      )}
    </>
  )
}
