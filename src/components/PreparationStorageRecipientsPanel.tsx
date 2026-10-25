import { useMemo, type KeyboardEvent } from 'react'
import type { ServiceItemRecord, TechnicalSheetServiceItem } from '../types/domain'
import { SingleValueAutocomplete } from './common'
import type { ServiceItemCatalogStatus } from '../domain/serviceItemCatalog'

type Props = {
  editing: TechnicalSheetServiceItem | null
  registered: TechnicalSheetServiceItem[]
  options: ServiceItemRecord[]
  catalogStatus?: ServiceItemCatalogStatus
  onRetry?: () => void
  allowEmpty: boolean
  onAdd: () => void
  onLabelChange: (id: number, value: string) => void
  onQuantityChange: (id: number, value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>, id: number) => void
  onCreate: (id: number) => void
  onConfirm: (id: number) => void
  onEdit: (id: number) => void
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}

export function PreparationStorageRecipientsPanel({ editing, registered, options, catalogStatus, onRetry, allowEmpty,
  onAdd, onLabelChange, onQuantityChange, onKeyDown, onCreate, onConfirm, onEdit, onToggle, onDelete }: Props) {
  const suggestions = useMemo(() => options.map((item) => item.name), [options])
  return <div className="ingredient-stack">
    <div className="section-heading section-heading-inline">
      <div><p className="kicker">Opcional</p><h2>Recipientes de armazenamento</h2></div>
      <button type="button" className="icon-button" aria-label="Adicionar recipiente de armazenamento"
        title="Adicionar recipiente de armazenamento" onClick={onAdd}>+</button>
    </div>
    {catalogStatus?.isLoading && !options.length && <p role="status">Carregando recipientes...</p>}
    {catalogStatus?.error && <div role="alert">{catalogStatus.error}
      <button type="button" className="ghost-button" onClick={onRetry}>Tentar novamente</button></div>}
    {editing && <div className="ingredient-entry-form">
      <div className="ingredient-row ingredient-row-entry">
        <label className="field field-wide">
          <span>Recipiente</span>
          <div className="inline-select-action">
            <SingleValueAutocomplete key={editing.id} value={editing.itemLabel} suggestions={suggestions}
              onChange={(value) => onLabelChange(editing.id, value)} commitOnInput allowCreate={false}
              placeholder="DIGITE O RECIPIENTE" />
            {!editing.itemId.trim() && editing.itemLabel.trim() && <button type="button" className="ghost-button"
              onClick={() => onCreate(editing.id)}>Cadastrar</button>}
          </div>
        </label>
        <label className="field"><span>Entrada</span>
          <input value={editing.quantity} onChange={(event) => onQuantityChange(editing.id, event.target.value)}
            onKeyDown={(event) => onKeyDown(event, editing.id)} placeholder="EX.: 1" />
        </label>
        <div className="field hint-card"><span>Unidade</span><strong>UN</strong></div>
        <div className="ingredient-entry-actions"><button type="button" className="primary-button"
          onClick={() => onConfirm(editing.id)} disabled={!editing.itemLabel.trim() && !editing.quantity.trim()}>Confirmar</button></div>
      </div>
    </div>}
    {registered.length ? <div className="ingredient-stack">
      {registered.map((item) => <div key={item.id}
        className={`ingredient-row ingredient-row-summary${item.isActive ? '' : ' ingredient-row-inactive'}`}>
        <div className="field field-wide"><div className="ingredient-summary-line">
          <div className="ingredient-summary-block ingredient-summary-block-wide"><span>Recipiente</span>
            <strong className="ingredient-summary-title">{item.itemLabel || 'NAO INFORMADO'}</strong></div>
          <div className="ingredient-summary-block"><span>Entrada</span><strong>{item.quantity || '0'}</strong></div>
          <div className="ingredient-summary-block ingredient-summary-unit"><span>Unidade</span><strong>UN</strong></div>
          <div className="package-actions ingredient-actions">
            <button type="button" className="icon-button icon-edit" aria-label="Editar recipiente da ficha"
              title="Editar recipiente da ficha" disabled={!item.isActive} onClick={() => onEdit(item.id)}>&#9998;</button>
            <button type="button" className="icon-button icon-disable"
              aria-label={item.isActive ? 'Inativar recipiente da ficha' : 'Ativar recipiente da ficha'}
              title={item.isActive ? 'Inativar recipiente da ficha' : 'Ativar recipiente da ficha'} onClick={() => onToggle(item.id)}>&#9680;</button>
            <button type="button" className="icon-button icon-delete" aria-label="Excluir recipiente da ficha"
              title="Excluir recipiente da ficha" disabled={!allowEmpty && registered.length === 1 && !editing}
              onClick={() => onDelete(item.id)}>&times;</button>
          </div>
        </div></div>
      </div>)}
    </div> : <div className="empty-state"><strong>Nenhum recipiente de armazenamento cadastrado.</strong></div>}
  </div>
}
