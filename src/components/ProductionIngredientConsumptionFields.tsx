import type {
  ProductionIngredientConsumptionAllocation,
  RecipePanelIngredientMetrics,
  TechnicalSheetIngredient,
} from '../types/domain'

export function IngredientEquivalentsEditor({
  isVisible,
  ingredient,
  productListId,
  onAdd,
  onChange,
  onDelete,
}: {
  isVisible: boolean
  ingredient: TechnicalSheetIngredient
  productListId: string
  onAdd: () => void
  onChange: (equivalentId: number, value: string) => void
  onDelete: (equivalentId: number) => void
}) {
  if (!isVisible) {
    return null
  }

  return (
    <div className="field field-wide">
      <span>Equivalentes permitidos na producao</span>
      <div className="inline-stack">
        {(ingredient.equivalentProducts ?? []).filter((item) => item.isActive !== false).map((equivalent) => (
          <div key={equivalent.id} className="inline-select-action">
            <input
              list={productListId}
              value={equivalent.productLabel}
              onChange={(event) => onChange(equivalent.id, event.target.value)}
              placeholder="PRODUTO OU FICHA EQUIVALENTE"
            />
            <button
              type="button"
              className="icon-button"
              title="Remover equivalente"
              onClick={() => onDelete(equivalent.id)}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="ghost-button" onClick={onAdd}>
          Adicionar equivalente
        </button>
      </div>
    </div>
  )
}

export function ProductionIngredientConsumptionField({
  hasEquivalentOptions,
  ingredient,
  baseIngredient,
  consumptionOverrides,
  singleInputValue,
  onAllocationChange,
  onSingleInputChange,
}: {
  hasEquivalentOptions: boolean
  ingredient: RecipePanelIngredientMetrics
  baseIngredient: RecipePanelIngredientMetrics
  consumptionOverrides: Record<string, string> | undefined
  singleInputValue: string
  onAllocationChange: (productId: string, value: string) => void
  onSingleInputChange: (value: string) => void
}) {
  if (!hasEquivalentOptions) {
    return (
      <input
        value={singleInputValue}
        onChange={(event) => onSingleInputChange(event.target.value)}
        placeholder={formatFallbackQuantity(baseIngredient.scaledInputQuantity)}
      />
    )
  }

  const allocations = ingredient.consumptionAllocations ?? []
  return (
    <div className="production-consumption-grid">
      {allocations.map((allocation) => (
        <ProductionAllocationInput
          key={allocation.productId}
          allocation={allocation}
          ingredient={ingredient}
          baseIngredient={baseIngredient}
          value={consumptionOverrides?.[allocation.productId] ?? ''}
          onChange={(value) => onAllocationChange(allocation.productId, value)}
        />
      ))}
    </div>
  )
}

function ProductionAllocationInput({
  allocation,
  ingredient,
  baseIngredient,
  value,
  onChange,
}: {
  allocation: ProductionIngredientConsumptionAllocation
  ingredient: RecipePanelIngredientMetrics
  baseIngredient: RecipePanelIngredientMetrics
  value: string
  onChange: (value: string) => void
}) {
  const fallbackValue =
    value ||
    (allocation.productId === ingredient.productId ? formatFallbackQuantity(baseIngredient.scaledInputQuantity) : '')

  return (
    <label className="field compact-field">
      <span>{allocation.productLabel}</span>
      <input value={fallbackValue} onChange={(event) => onChange(event.target.value)} />
      <small>{allocation.unitLabel}</small>
    </label>
  )
}

function formatFallbackQuantity(quantity: number) {
  return Number.isFinite(quantity) && quantity > 0 ? String(quantity).replace('.', ',') : ''
}
