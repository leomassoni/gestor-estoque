import type { InventoryFormState } from '../types/domain'

type InventoryCountQuantityPanelProps = {
  inventoryForm: InventoryFormState
  inventoryErrors: Partial<Record<keyof InventoryFormState, string>>
  canHaveOpenItems: boolean
  openPhysicalQuantityLabel: string
  totalCountedLabel: string
  onUpdateField: <K extends keyof InventoryFormState>(field: K, value: InventoryFormState[K]) => void
}

export function InventoryCountQuantityPanel({
  inventoryForm,
  inventoryErrors,
  canHaveOpenItems,
  openPhysicalQuantityLabel,
  totalCountedLabel,
  onUpdateField,
}: InventoryCountQuantityPanelProps) {
  return (
    <>
      <div className="section-heading section-heading-inline stock-center-subheading">
        <div>
          <p className="kicker">Fechados</p>
          <h2>Itens fechados</h2>
        </div>
      </div>

      <form className="form-grid company-form-grid" onSubmit={(event) => event.preventDefault()}>
        <label className="field company-field-wide">
          <span>Quantidade de itens fechados *</span>
          <input
            type="number"
            min="0"
            value={inventoryForm.closedItemsQuantity}
            onChange={(event) => onUpdateField('closedItemsQuantity', event.target.value)}
            placeholder="0"
          />
          {inventoryErrors.closedItemsQuantity ? (
            <p className="compact-feedback feedback error">{inventoryErrors.closedItemsQuantity}</p>
          ) : null}
        </label>
      </form>

      {canHaveOpenItems ? (
        <>
          <div className="section-heading section-heading-inline stock-center-subheading">
            <div>
              <p className="kicker">Abertos</p>
              <h2>Itens abertos</h2>
            </div>
          </div>

          <div className="field field-span-all">
            <span>Existem itens abertos deste item? *</span>
            <div className="checkbox-grid stock-center-user-grid inventory-open-items-row">
              <label className="checkbox-row stock-center-user-option">
                <input
                  type="radio"
                  name="inventory-open-items"
                  checked={inventoryForm.hasOpenItems === 'true'}
                  onChange={() => onUpdateField('hasOpenItems', 'true')}
                />
                <span>Sim</span>
              </label>
              <label className="checkbox-row stock-center-user-option">
                <input
                  type="radio"
                  name="inventory-open-items"
                  checked={inventoryForm.hasOpenItems === 'false'}
                  onChange={() => onUpdateField('hasOpenItems', 'false')}
                />
                <span>Nao</span>
              </label>
            </div>
            {inventoryErrors.hasOpenItems ? (
              <p className="compact-feedback feedback error">{inventoryErrors.hasOpenItems}</p>
            ) : null}
          </div>

          {inventoryForm.hasOpenItems === 'true' ? (
            <form className="form-grid company-form-grid" onSubmit={(event) => event.preventDefault()}>
              <label className="field company-field-wide">
                <span>Peso total pesado dos itens abertos (g) *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inventoryForm.openItemsGrossWeight}
                  onChange={(event) => onUpdateField('openItemsGrossWeight', event.target.value)}
                  placeholder="0,00"
                />
                {inventoryErrors.openItemsGrossWeight ? (
                  <p className="compact-feedback feedback error">{inventoryErrors.openItemsGrossWeight}</p>
                ) : null}
              </label>
              <label className="field company-field-wide">
                <span>Quantidade de itens abertos pesados *</span>
                <input
                  type="number"
                  min="1"
                  value={inventoryForm.openItemsContainerQuantity}
                  onChange={(event) => onUpdateField('openItemsContainerQuantity', event.target.value)}
                  placeholder="1"
                />
                {inventoryErrors.openItemsContainerQuantity ? (
                  <p className="compact-feedback feedback error">{inventoryErrors.openItemsContainerQuantity}</p>
                ) : null}
              </label>
            </form>
          ) : null}
        </>
      ) : (
        <input type="hidden" value={inventoryForm.hasOpenItems || 'false'} />
      )}

      <div className="receituario-summary-grid receituario-summary-grid-metrics">
        <article className="receituario-metric-card">
          <span>Conteudo liquido/pesado dos abertos</span>
          <strong>{openPhysicalQuantityLabel}</strong>
        </article>
        <article className="receituario-metric-card">
          <span>Total contado</span>
          <strong>{totalCountedLabel}</strong>
        </article>
      </div>
    </>
  )
}
