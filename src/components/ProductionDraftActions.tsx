import { useState } from 'react'
import { ConfirmationModal } from './common'
import { getTodayDateInputValue } from '../utils/core'

type Action = 'start' | 'finish' | 'cancel'

type Props = {
  inProgress: boolean
  startedOn: string
  latestInventoryOn: string
  isSaving: boolean
  onClose: () => void
  onStart: () => Promise<boolean>
  onFinish: (finishedOn: string) => Promise<boolean>
  onCancel: () => Promise<boolean>
}

export function ProductionDraftActions({
  inProgress, startedOn, latestInventoryOn, isSaving, onClose, onStart, onFinish, onCancel,
}: Props) {
  const [finishedOn, setFinishedOn] = useState(getTodayDateInputValue)
  const [action, setAction] = useState<Action | null>(null)
  const today = getTodayDateInputValue()
  const validFinishDate = finishedOn >= startedOn && finishedOn <= today
  const beforeInventory = latestInventoryOn && finishedOn < latestInventoryOn
  const onInventoryDate = latestInventoryOn && finishedOn === latestInventoryOn

  async function confirm() {
    if (!action) return
    const saved = action === 'start' ? await onStart()
      : action === 'finish' ? await onFinish(finishedOn) : await onCancel()
    if (saved) setAction(null)
  }

  return (
    <>
      {inProgress ? (
        <div className="form-grid company-form-grid inner-panel">
          <label className="field">
            <span>Data da conclusao</span>
            <input type="date" value={finishedOn} min={startedOn} max={today}
              onChange={(event) => setFinishedOn(event.target.value)} />
          </label>
        </div>
      ) : null}
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onClose} disabled={isSaving}>Fechar</button>
        {inProgress ? (
          <>
            <button type="button" className="danger-button" onClick={() => setAction('cancel')} disabled={isSaving}>
              Cancelar inicio
            </button>
            <button type="button" className="primary-button" onClick={() => setAction('finish')}
              disabled={isSaving || !validFinishDate}>Confirmar producao</button>
          </>
        ) : (
          <button type="button" className="primary-button" onClick={() => setAction('start')} disabled={isSaving}>
            Iniciar
          </button>
        )}
      </div>
      {action ? (
        <ConfirmationModal
          title={action === 'start' ? 'Iniciar producao' : action === 'finish' ? 'Confirmar producao' : 'Cancelar inicio de producao'}
          message={action === 'start'
            ? 'Os insumos serao baixados agora e a producao podera ser continuada depois.'
            : action === 'cancel'
              ? 'O inicio sera encerrado. Consumos ja registrados serao estornados na data original; uma contagem posterior permanece como posicao atual do estoque. Nenhum produto final sera acrescentado.'
              : beforeInventory
                ? `A entrada sera registrada em ${finishedOn}, antes do ultimo inventario (${latestInventoryOn}). A contagem posterior prevalecera sobre ela. Confirme o rendimento real antes de concluir.`
                : onInventoryDate
                  ? `A conclusao sera registrada no mesmo dia do ultimo inventario (${latestInventoryOn}). Confira se o produto final ja foi contado: registra-lo novamente pode duplicar o saldo.`
                : `A entrada sera registrada em ${finishedOn}. Confirme o rendimento real e se o produto final nao foi contado em um inventario posterior.`}
          actionClass={action === 'cancel' ? 'danger-button' : 'primary-button'}
          actionLabel={action === 'start' ? 'Iniciar' : action === 'finish' ? 'Confirmar producao' : 'Cancelar inicio'}
          onCancel={() => setAction(null)} onConfirm={() => void confirm()} isBusy={isSaving}
        />
      ) : null}
    </>
  )
}
