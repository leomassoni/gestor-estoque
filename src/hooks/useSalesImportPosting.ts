import { useCallback, useEffect, useRef, useState } from 'react'
import { salesPostingRequest, type SalesPostingPlan, type SalesPostingTiming } from '../domain/salesImports'

export function useSalesImportPosting(batchId: number, onCommitted: () => Promise<void>) {
  const [plan, setPlan] = useState<SalesPostingPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const mounted = useRef(true)
  const saving = useRef(false)
  const retry = useRef<{ signature: string; key: string } | null>(null)
  const committed = useRef(onCommitted)
  useEffect(() => { committed.current = onCommitted }, [onCommitted])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const execute = useCallback(async (work: () => Promise<void>) => {
    if (saving.current) return
    saving.current = true; setBusy(true); setError(''); setFeedback('')
    try { await work() } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Falha na operacao. Confira o estado salvo antes de repetir.')
    } finally { saving.current = false; if (mounted.current) setBusy(false) }
  }, [])

  const load = useCallback(() => execute(async () => {
    const result = await salesPostingRequest<{ plan: SalesPostingPlan }>(batchId, 'details')
    if (mounted.current) setPlan(result.plan)
  }), [batchId, execute])
  useEffect(() => { void load() }, [load])

  const preview = (timing: SalesPostingTiming) => execute(async () => {
    const result = await salesPostingRequest<{ plan: SalesPostingPlan }>(batchId, 'preview', { timing })
    if (mounted.current) setPlan(result.plan)
  })
  const saveSettings = (enabled: boolean, policies: SalesPostingPlan['settings']['policies']) => execute(async () => {
    await salesPostingRequest(batchId, 'settings', { enabled, policies }, 'PUT')
    const result = await salesPostingRequest<{ plan: SalesPostingPlan }>(batchId, 'preview', { timing: plan?.timing })
    if (mounted.current) { setPlan(result.plan); setFeedback('Configuracao salva para este centro de estoque.') }
  })
  const confirm = (allowPartial: boolean, confirmNegativeProducts: boolean) => execute(async () => {
    if (!plan) return
    const body = { revision: plan.revision, timing: plan.timing, allowPartial, confirmNegativeProducts }
    const signature = JSON.stringify(body)
    if (retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() }
    const result = await salesPostingRequest<{ operation: { status: string } }>(batchId, plan.operation ? 'resume' : 'confirm',
      { ...body, idempotencyKey: retry.current.key })
    retry.current = null
    const latest = await salesPostingRequest<{ plan: SalesPostingPlan }>(batchId, 'details')
    if (mounted.current) {
      setPlan(latest.plan)
      setFeedback(result.operation.status === 'POSTED' ? 'Baixa concluida e persistida no banco.'
        : result.operation.status === 'WAITING_INVENTORY' ? 'Intencao salva. Apos consolidar o inventario, retome e confira a nova previa.'
          : 'Parte resolvida salva. As pendencias continuam registradas e nao foram baixadas.')
    }
    await committed.current()
  })
  return { plan, busy, error, feedback, preview, confirm, saveSettings }
}
