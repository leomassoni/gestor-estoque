import type { InventoryFormState, InventoryRecord, StockCenterRecord } from '../types/domain'
import { formatDateForDisplay } from '../utils/core'

type InventoryStartPanelProps = {
  eligibleStockCenters: StockCenterRecord[]
  inventoryForm: InventoryFormState
  inventoryErrors: Partial<Record<keyof InventoryFormState, string>>
  selectedInventoryRecord: InventoryRecord | null
  selectedInventoryCountSessionIsOpen: boolean
  selectedUserSessionCount: number
  isStartingInventoryRecord: boolean
  isStartingInventoryCountSession: boolean
  getStockCenterName: (stockCenterId: number) => string
  onUpdateInventoryFormField: <K extends keyof InventoryFormState>(field: K, value: InventoryFormState[K]) => void
  onStartInventoryRecord: () => void
  onStartInventoryCountSession: () => void
}

export function InventoryStartPanel({
  eligibleStockCenters,
  inventoryForm,
  inventoryErrors,
  selectedInventoryRecord,
  selectedInventoryCountSessionIsOpen,
  selectedUserSessionCount,
  isStartingInventoryRecord,
  isStartingInventoryCountSession,
  getStockCenterName,
  onUpdateInventoryFormField,
  onStartInventoryRecord,
  onStartInventoryCountSession,
}: InventoryStartPanelProps) {
  const selectedOpenInventory = selectedInventoryRecord && !selectedInventoryRecord.isClosed ? selectedInventoryRecord : null

  return (
    <>
      {selectedOpenInventory ? (
        <div className="empty-state empty-state-inline inventory-selected-center">
          <strong>Centro deste inventario: {getStockCenterName(selectedOpenInventory.stockCenterId)}</strong>
          <p>
            Data {formatDateForDisplay(selectedOpenInventory.countedAt)}. A contagem aberta dentro deste inventario usa
            obrigatoriamente este centro de estoque.
          </p>
        </div>
      ) : null}

      <form className="form-grid company-form-grid" onSubmit={(event) => event.preventDefault()}>
        {!selectedOpenInventory ? (
          <>
            <label className="field company-field-wide">
              <span>Centro de estoque *</span>
              <select
                value={inventoryForm.stockCenterId}
                onChange={(event) => onUpdateInventoryFormField('stockCenterId', event.target.value)}
              >
                <option value="">Selecione</option>
                {eligibleStockCenters.map((center) => (
                  <option key={center.id} value={String(center.id)}>
                    {center.name}
                  </option>
                ))}
              </select>
              {inventoryErrors.stockCenterId ? <p className="compact-feedback feedback error">{inventoryErrors.stockCenterId}</p> : null}
            </label>
            <label className="field company-field-wide">
              <span>Data da contagem *</span>
              <input
                type="date"
                value={inventoryForm.countedAt}
                onChange={(event) => onUpdateInventoryFormField('countedAt', event.target.value)}
              />
              {inventoryErrors.countedAt ? <p className="compact-feedback feedback error">{inventoryErrors.countedAt}</p> : null}
            </label>
          </>
        ) : null}

        <div className="form-actions field-span-all">
          {!selectedInventoryRecord || selectedInventoryRecord.isClosed ? (
            <button
              type="button"
              className="primary-button"
              onClick={onStartInventoryRecord}
              disabled={isStartingInventoryRecord}
            >
              {isStartingInventoryRecord ? 'Salvando inventario...' : 'Iniciar inventario'}
            </button>
          ) : null}
          {selectedOpenInventory && !selectedInventoryCountSessionIsOpen ? (
            <button
              type="button"
              className="primary-button"
              onClick={onStartInventoryCountSession}
              disabled={isStartingInventoryCountSession}
            >
              {isStartingInventoryCountSession
                ? 'Salvando contagem...'
                : selectedUserSessionCount > 0
                  ? 'Continuar contagem'
                  : 'Iniciar contagem'}
            </button>
          ) : null}
          {selectedOpenInventory && selectedInventoryCountSessionIsOpen ? (
            <span className="compact-feedback">Contagem aberta. Registre os itens abaixo ou saia da contagem atual.</span>
          ) : null}
        </div>
      </form>
    </>
  )
}
