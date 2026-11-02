import { useState } from 'react'
import type { ManualProductionRequestRecord, ProductionRequestRow } from '../types/domain'
import { formatDecimal, parseDecimal } from '../utils/core'

type Props = {
  row: ProductionRequestRow
  requests: ManualProductionRequestRecord[]
  onCancel: () => void
  onConfirm: (requestIds: number[]) => Promise<boolean>
}

export function ManualProductionCancellationModal({ row, requests, onCancel, onConfirm }: Props) {
  const available = requests.filter((request) => row.cancellableManualRequestIds.includes(request.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id - left.id)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() =>
    new Set(available.length === 1 ? [available[0].id] : []))
  const [isBusy, setIsBusy] = useState(false)
  const selected = available.filter((request) => selectedIds.has(request.id))
  const rootIds = new Set(selected.filter((request) => !request.isDependencyRequest).map((request) => request.rootRequestId))
  const dependencies = requests.filter((request) => request.companyId === selected[0]?.companyId &&
    request.isDependencyRequest && rootIds.has(request.rootRequestId))
  const quantity = selected.reduce((sum, request) => sum + (parseDecimal(request.desiredYield) ?? 0), 0)

  function toggle(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirm() {
    if (isBusy || selected.length === 0) return
    setIsBusy(true)
    try {
      await onConfirm(selected.map((request) => request.id))
    } finally {
      setIsBusy(false)
    }
  }

  return <div className="modal-backdrop manual-production-cancel-backdrop" role="presentation"
    onClick={isBusy ? undefined : onCancel}>
    <section className="modal-card modal-card-compact" role="dialog" aria-modal="true"
      aria-labelledby="manual-production-cancel-title" onClick={(event) => event.stopPropagation()}>
      <div className="section-heading">
        <div>
          <p className="kicker">Confirmacao</p>
          <h2 id="manual-production-cancel-title">Cancelar entrada manual?</h2>
        </div>
      </div>
      <p className="confirm-copy">{row.sheetName}</p>
      <div className="manual-production-cancel-list" role="group" aria-label="Entradas manuais">
        {available.map((request) => <label className="checkbox-row manual-production-cancel-option" key={request.id}>
          <input type="checkbox" checked={selectedIds.has(request.id)} disabled={isBusy}
            onChange={() => toggle(request.id)} />
          <span>
            <strong>{formatDecimal(parseDecimal(request.desiredYield) ?? 0)} {row.baseUnitLabel}</strong>
            <small>Pedido #{request.rootRequestId} | {request.createdByUserName} | {new Date(request.createdAt).toLocaleString('pt-BR')}</small>
          </span>
        </label>)}
      </div>
      <p className="confirm-copy">
        {selected.length > 0
          ? `Serao retirados ${formatDecimal(quantity)} ${row.baseUnitLabel} da fila.`
          : 'Selecione ao menos uma entrada.'}
        {dependencies.length > 0 ? ` ${dependencies.length} dependencia(s) vinculada(s) tambem serao retiradas.` : ''}
        {' '}Minimos por vendas, requisicoes e estoque nao mudam. Pedidos de compra ja criados permanecem para conferencia.
      </p>
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={isBusy}>Voltar</button>
        <button type="button" className="danger-button" onClick={() => void confirm()}
          disabled={isBusy || selected.length === 0}>{isBusy ? 'Salvando...' : 'Cancelar selecionadas'}</button>
      </div>
    </section>
  </div>
}
