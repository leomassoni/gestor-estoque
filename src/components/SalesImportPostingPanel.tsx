import { useEffect, useState } from 'react'
import { useSalesImportPosting } from '../hooks/useSalesImportPosting'
import type { SalesPostingPlan, SalesPostingTiming } from '../domain/salesImports'
import { formatDateForDisplay, formatDecimal } from '../utils/core'
import { SalesPostingAllocationTable } from './SalesPostingAllocationTable'

export function SalesImportPostingPanel({ batchId, onClose, onCommitted }: {
  batchId: number; onClose: () => void; onCommitted: () => Promise<void>
}) {
  const posting = useSalesImportPosting(batchId, onCommitted)
  const { plan, busy, error, feedback } = posting
  const [draft, setDraft] = useState<{ revision: string; timing: SalesPostingTiming; negative: boolean;
    partial: boolean; enabled: boolean; policies: SalesPostingPlan['settings']['policies'] }>({
      revision: '', timing: { dayEndConfirmed: false, aggregate: false, periodStart: '', periodEnd: '' },
      negative: false, partial: false, enabled: false, policies: {},
    })
  const currentDraft = draft.revision === plan?.revision ? draft : { ...draft, revision: plan?.revision ?? '',
    timing: plan?.timing ?? draft.timing, enabled: plan?.settings.enabled ?? false,
    policies: plan?.settings.policies ?? {}, negative: false, partial: false }
  const { timing, negative, partial, enabled, policies } = currentDraft
  const updateDraft = (patch: Partial<typeof draft>) => setDraft({ ...currentDraft, ...patch })
  const setTiming = (value: SalesPostingTiming) => updateDraft({ timing: value })
  const setNegative = (value: boolean) => updateDraft({ negative: value })
  const setPartial = (value: boolean) => updateDraft({ partial: value })
  const setEnabled = (value: boolean) => updateDraft({ enabled: value })
  const setPolicies = (value: SalesPostingPlan['settings']['policies']) => updateDraft({ policies: value })
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [busy, onClose])
  const dirty = !!plan && JSON.stringify(timing) !== JSON.stringify(plan.timing)
  const finished = ['POSTED', 'REVERSED'].includes(plan?.operation?.status ?? '')
  const waiting = !!plan?.pending.length && plan.pending.every((p) => p.reason === 'OPEN_INVENTORY')
  const existing = plan?.operation?.allocations ?? []
  const timingLocked = busy || existing.length > 0

  return <div className="modal-backdrop" role="presentation">
    <section className="modal-card modal-card-full" role="dialog" aria-modal="true" aria-labelledby="sales-posting-title" aria-busy={busy}>
      <div className="section-heading">
        <div><p className="kicker">Conferencia de estoque</p><h2 id="sales-posting-title">Baixa de vendas em cascata</h2></div>
        <button type="button" className="icon-button" aria-label="Fechar conferencia" title="Fechar conferencia" disabled={busy} onClick={onClose}>X</button>
      </div>
      {error && <p className="feedback-message" role="alert">{error}</p>}
      {feedback && <p role="status">{feedback}</p>}
      {!plan ? <p role="status">{busy ? 'Carregando...' : 'Nao foi possivel carregar a conferencia.'}</p> : <>
        <p><strong>{plan.fileName}</strong> | {plan.centerName} | Empresa {plan.companyId}</p>
        <p>Inventario de referencia: {plan.inventory ? `#${plan.inventory.id} - ${formatDateForDisplay(plan.inventory.date)}` : 'SEM INVENTARIO CONSOLIDADO'}</p>
        {plan.operation && <p>Situacao: <strong>{({ POSTED: 'CONCLUIDO', PARTIAL: 'PARCIAL COM PENDENCIAS', WAITING_INVENTORY: 'AGUARDANDO INVENTARIO', REVERSED: 'ESTORNADO' } as Record<string, string>)[plan.operation.status] ?? plan.operation.status}</strong></p>}
        {!finished && <div className="form-grid">
          <label className="checkbox-field field-span-all"><input type="checkbox" checked={timing.aggregate} disabled={timingLocked || plan.aggregateRequired}
            onChange={(event) => setTiming({ ...timing, aggregate: event.target.checked })} />Relatorio consolidado por periodo</label>
          {timing.aggregate && <>
            <label className="field"><span>Inicio do periodo</span><input type="date" value={timing.periodStart} disabled={timingLocked} onChange={(event) => setTiming({ ...timing, periodStart: event.target.value })} /></label>
            <label className="field"><span>Fim do periodo</span><input type="date" value={timing.periodEnd} disabled={timingLocked} onChange={(event) => setTiming({ ...timing, periodEnd: event.target.value })} /></label>
          </>}
          <label className="checkbox-field field-span-all"><input type="checkbox" checked={timing.dayEndConfirmed} disabled={timingLocked}
            onChange={(event) => setTiming({ ...timing, dayEndConfirmed: event.target.checked })} />Confirmo o consumo consolidado no fechamento diario ou fim do periodo declarado e conferi as datas de producoes e recebimentos</label>
        </div>}
        {plan.settings.canManage && !finished && <details>
          <summary>Configuracao do centro - master</summary>
          <label className="checkbox-field"><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} />Habilitar baixa em cascata neste centro</label>
          {plan.policySheets.map((sheet) => <label className="field" key={sheet.id}>
            <span>{sheet.name}{sheet.generated ? ' - SUBPRODUTO/RETORNO' : sheet.local ? ' - PRODUCAO LOCAL' : ''}</span>
            <select value={policies[String(sheet.id)] ?? 'DEFAULT'} disabled={busy || sheet.generated} onChange={(event) => {
              const next = { ...policies }; if (event.target.value === 'DEFAULT') delete next[String(sheet.id)]
              else next[String(sheet.id)] = event.target.value as 'CASCADE_LOCAL' | 'STOCK_ONLY'; setPolicies(next)
            }}><option value="DEFAULT">Regra automatica do centro</option><option value="STOCK_ONLY">Somente saldo</option><option value="CASCADE_LOCAL">Cascata local autorizada</option></select>
          </label>)}
          <button type="button" className="secondary-button" disabled={busy} onClick={() => void posting.saveSettings(enabled, policies)}>Salvar configuracao</button>
        </details>}
        {!plan.settings.enabled && !plan.operation && <p role="status">Baixa em cascata desabilitada neste centro. A simulacao nao movimenta estoque.</p>}
        <p>{plan.allocations.length} baixas propostas | {plan.pending.length} pendencias | {plan.covered.length + (plan.operation?.covered.length ?? 0)} consumos abrangidos por inventario posterior</p>
        {!!plan.warnings.length && <div role="alert"><h3>Produtos com saldo negativo previsto</h3><ul>{plan.warnings.map((warning, index) =>
          <li key={index}>{warning.name}: {formatDecimal(warning.balanceBefore)} → {formatDecimal(warning.balanceAfter)}</li>)}</ul></div>}
        {!!plan.pending.length && <section><h3>Pendencias nao baixadas</h3><ul>{plan.pending.map((pending, index) => <li key={index}>
          <strong>{pending.sourceName} &gt; {pending.path.map((step) => step.name).join(' > ') || `CONSUMO ${pending.id}`}</strong>: {formatDecimal(pending.quantity)} {pending.unit}. {pending.message}
        </li>)}</ul></section>}
        <SalesPostingAllocationTable title="Baixas propostas" items={plan.allocations} />
        <SalesPostingAllocationTable title="Baixas ja persistidas" items={existing} />
        {!finished && <>
          {!!plan.warnings.length && <label className="checkbox-field"><input type="checkbox" checked={negative} disabled={busy} onChange={(event) => setNegative(event.target.checked)} />Confirmo os saldos negativos dos produtos indicados</label>}
          {!!plan.pending.length && !waiting && <label className="checkbox-field"><input type="checkbox" checked={partial} disabled={busy} onChange={(event) => setPartial(event.target.checked)} />Aplicar somente a parte resolvida e manter as pendencias</label>}
          <div className="form-actions">
            <button type="button" className="secondary-button" disabled={busy} onClick={() => void posting.preview(timing)}>{busy ? 'Aguarde...' : 'Atualizar previa'}</button>
            <button type="button" className="primary-button" disabled={busy || dirty || (!plan.settings.enabled && !plan.operation) || (!!plan.warnings.length && !negative) || (!!plan.pending.length && !waiting && !partial)}
              onClick={() => void posting.confirm(partial, negative)}>{waiting ? 'Salvar intencao e aguardar inventario' : plan.pending.length ? 'Salvar parte resolvida e pendencias' : plan.operation ? 'Concluir baixa pendente' : 'Confirmar baixa'}</button>
          </div>
        </>}
      </>}
    </section>
  </div>
}
