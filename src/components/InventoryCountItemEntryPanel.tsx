import type { InventoryContainerOption, InventoryCountableItem, InventoryFormState } from '../types/domain'
import { SingleValueAutocomplete } from './common'
import { InventoryCountMetricsPanel } from './InventoryCountMetricsPanel'
import { InventoryCountQuantityPanel } from './InventoryCountQuantityPanel'

export type InventoryCountItemEntryPanelProps = {
  editingInventoryCountId: number | null
  inventoryForm: InventoryFormState
  inventoryErrors: Partial<Record<keyof InventoryFormState, string>>
  storageLocationSuggestions: string[]
  technicalSheetSuggestions: string[]
  selectedCountableItem: InventoryCountableItem | null
  hasRecipientOptions: boolean
  recipientOptions: InventoryContainerOption[]
  canDeleteSectors: boolean
  canCreateSectors: boolean
  kindLabel: string
  closedReferenceLabel: string
  emptyWeightTitle: string
  emptyWeightLabel: string
  minimumLabel: string
  canHaveOpenItems: boolean
  openPhysicalQuantityLabel: string
  totalCountedLabel: string
  selectedSessionIsClosed: boolean
  isSavingInventoryCount: boolean
  onCancelEdit: () => void
  onSave: () => void
  onDeleteStorageLocation: (value: string) => void
  onUpdateField: <K extends keyof InventoryFormState>(field: K, value: InventoryFormState[K]) => void
}

export function InventoryCountItemEntryPanel({
  editingInventoryCountId,
  inventoryForm,
  inventoryErrors,
  storageLocationSuggestions,
  technicalSheetSuggestions,
  selectedCountableItem,
  hasRecipientOptions,
  recipientOptions,
  canDeleteSectors,
  canCreateSectors,
  kindLabel,
  closedReferenceLabel,
  emptyWeightTitle,
  emptyWeightLabel,
  minimumLabel,
  canHaveOpenItems,
  openPhysicalQuantityLabel,
  totalCountedLabel,
  selectedSessionIsClosed,
  isSavingInventoryCount,
  onCancelEdit,
  onSave,
  onDeleteStorageLocation,
  onUpdateField,
}: InventoryCountItemEntryPanelProps) {
  return (
    <>
      {editingInventoryCountId !== null ? (
        <div className="empty-state empty-state-inline">
          <strong>Editando item da contagem atual</strong>
          <p>As alteracoes serao aplicadas apenas ao item selecionado desta contagem.</p>
          <div className="form-actions">
            <button type="button" className="ghost-button" onClick={onCancelEdit}>
              Cancelar edicao
            </button>
          </div>
        </div>
      ) : null}

      <form className="form-grid company-form-grid" onSubmit={(event) => event.preventDefault()}>
        <label className="field company-field-wide">
          <span>Local de armazenamento *</span>
          <SingleValueAutocomplete
            value={inventoryForm.storageLocation}
            suggestions={storageLocationSuggestions}
            onChange={(value) => onUpdateField('storageLocation', value)}
            onDeleteSuggestion={canDeleteSectors ? onDeleteStorageLocation : undefined}
            placeholder="Digite para pesquisar ou criar local"
            allowCreate={canCreateSectors}
          />
          {inventoryErrors.storageLocation ? (
            <p className="compact-feedback feedback error">{inventoryErrors.storageLocation}</p>
          ) : null}
        </label>
        <label className="field company-field-wide">
          <span>Item *</span>
          <SingleValueAutocomplete
            value={inventoryForm.technicalSheetLabel}
            suggestions={technicalSheetSuggestions}
            onChange={(value) => onUpdateField('technicalSheetLabel', value)}
            placeholder="Digite para pesquisar produto, pre-preparo ou item"
            allowCreate={false}
          />
          {inventoryErrors.technicalSheetLabel ? (
            <p className="compact-feedback feedback error">{inventoryErrors.technicalSheetLabel}</p>
          ) : null}
        </label>
        <label className="field company-field-wide">
          <span>
            {selectedCountableItem?.kind === 'PRODUTO' || selectedCountableItem?.kind === 'ITEM'
              ? `Embalagem${hasRecipientOptions ? ' *' : ''}`
              : `Recipiente${hasRecipientOptions ? ' *' : ''}`}
          </span>
          {hasRecipientOptions ? (
            <SingleValueAutocomplete
              value={inventoryForm.recipientLabel}
              suggestions={recipientOptions.map((option) => option.label)}
              onChange={(value) => onUpdateField('recipientLabel', value)}
              placeholder={
                selectedCountableItem?.kind === 'PRODUTO'
                  ? 'Selecione a embalagem do produto'
                  : selectedCountableItem?.kind === 'ITEM'
                    ? 'Selecione unidade ou a embalagem do item'
                    : selectedCountableItem?.kind === 'PREPARO'
                      ? 'Selecione o recipiente vinculado a ficha'
                      : 'Escolha primeiro o item'
              }
              allowCreate={false}
            />
          ) : (
            <input
              value={
                selectedCountableItem
                  ? selectedCountableItem.kind === 'ITEM'
                    ? 'UNIDADE'
                    : 'SEM RECIPIENTE VINCULADO'
                  : ''
              }
              disabled
              placeholder="Escolha primeiro o item"
            />
          )}
          {selectedCountableItem?.kind === 'PREPARO' && !hasRecipientOptions ? (
            <p className="compact-feedback">
              Sem recipiente vinculado: cada item fechado sera contado pela porcao base da ficha.
            </p>
          ) : null}
          {selectedCountableItem?.kind === 'ITEM' ? (
            <p className="compact-feedback">
              A contagem padrao do item e em unidade, mas voce pode escolher uma embalagem cadastrada.
            </p>
          ) : null}
          {inventoryErrors.recipientLabel ? (
            <p className="compact-feedback feedback error">{inventoryErrors.recipientLabel}</p>
          ) : null}
        </label>
      </form>

      <InventoryCountMetricsPanel
        isVisible={Boolean(selectedCountableItem)}
        kindLabel={kindLabel}
        closedReferenceLabel={closedReferenceLabel}
        emptyWeightTitle={emptyWeightTitle}
        emptyWeightLabel={emptyWeightLabel}
        minimumLabel={minimumLabel}
      />

      <InventoryCountQuantityPanel
        inventoryForm={inventoryForm}
        inventoryErrors={inventoryErrors}
        canHaveOpenItems={canHaveOpenItems}
        openPhysicalQuantityLabel={openPhysicalQuantityLabel}
        totalCountedLabel={totalCountedLabel}
        onUpdateField={onUpdateField}
      />

      <div className="form-actions field-span-all">
        <button
          type="button"
          className="primary-button"
          onClick={onSave}
          disabled={selectedSessionIsClosed || isSavingInventoryCount}
        >
          {isSavingInventoryCount
            ? 'Salvando item...'
            : editingInventoryCountId === null
              ? 'Registrar item'
              : 'Salvar alteracoes do item'}
        </button>
      </div>
    </>
  )
}
