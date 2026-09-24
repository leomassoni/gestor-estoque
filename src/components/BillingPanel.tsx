import { useEffect, useMemo, useState } from 'react'
import type {
  BillingCycle,
  BillingEventRecord,
  BillingPaymentRecord,
  CompanyRecord,
  CompanySubscriptionRecord,
  CompanySubscriptionStatus,
  SaveFeedback,
  SubscriptionPlanRecord,
} from '../types/domain'
import { formatMoney } from '../utils/core'

type BillingPanelProps = {
  companies: CompanyRecord[]
  currentCompanyId: number | null
  onFeedback: (feedback: SaveFeedback) => void
}

type BillingData = {
  plans: SubscriptionPlanRecord[]
  subscriptions: CompanySubscriptionRecord[]
  payments: BillingPaymentRecord[]
  events: BillingEventRecord[]
  asaasStatus: {
    configured: boolean
    environment: string
    apiBaseUrl: string
    webhookTokenConfigured: boolean
  } | null
}

type BillingDraft = {
  companyId: string
  planId: string
  status: CompanySubscriptionStatus
  billingCycle: BillingCycle
  discountPercent: string
  lifetimeAccess: boolean
  founderPromotion: boolean
  feedbackParticipant: boolean
  trialStartedAt: string
  trialEndsAt: string
  graceEndsAt: string
  currentPeriodStartedAt: string
  currentPeriodEndsAt: string
  notes: string
}

const statusLabels: Record<CompanySubscriptionStatus, string> = {
  TRIAL: 'Trial',
  GRACE: 'Carencia',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Vencida',
  BLOCKED: 'Bloqueada',
  CANCELLED: 'Cancelada',
  LIFETIME_FREE: 'Vitalicio free',
  SCHEDULED_FOR_DELETION: 'Exclusao agendada',
}

const cycleLabels: Record<BillingCycle, string> = {
  FORTNIGHTLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
}

const emptyDraft: BillingDraft = {
  companyId: '',
  planId: 'PROFESSIONAL',
  status: 'TRIAL',
  billingCycle: 'MONTHLY',
  discountPercent: '0',
  lifetimeAccess: false,
  founderPromotion: false,
  feedbackParticipant: false,
  trialStartedAt: '',
  trialEndsAt: '',
  graceEndsAt: '',
  currentPeriodStartedAt: '',
  currentPeriodEndsAt: '',
  notes: '',
}

function formatCurrencyFromCents(value: number) {
  return `R$ ${formatMoney((Number.isFinite(value) ? value : 0) / 100)}`
}

function toDateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

function getCompanyName(companies: CompanyRecord[], companyId: number) {
  return companies.find((company) => company.id === companyId)?.tradeName ?? `Empresa ${companyId}`
}

function getPlanPrice(plan: SubscriptionPlanRecord | null, cycle: BillingCycle) {
  if (!plan) {
    return 0
  }
  if (cycle === 'FORTNIGHTLY') {
    return plan.fortnightlyPriceCents
  }
  if (cycle === 'SEMIANNUAL') {
    return plan.semiannualPriceCents
  }
  if (cycle === 'ANNUAL') {
    return plan.annualPriceCents
  }
  return plan.monthlyPriceCents
}

function buildDraftFromSubscription(subscription: CompanySubscriptionRecord): BillingDraft {
  return {
    companyId: String(subscription.companyId),
    planId: subscription.planId,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    discountPercent: String(subscription.discountPercent),
    lifetimeAccess: subscription.lifetimeAccess,
    founderPromotion: subscription.founderPromotion,
    feedbackParticipant: subscription.feedbackParticipant,
    trialStartedAt: toDateInputValue(subscription.trialStartedAt),
    trialEndsAt: toDateInputValue(subscription.trialEndsAt),
    graceEndsAt: toDateInputValue(subscription.graceEndsAt),
    currentPeriodStartedAt: toDateInputValue(subscription.currentPeriodStartedAt),
    currentPeriodEndsAt: toDateInputValue(subscription.currentPeriodEndsAt),
    notes: subscription.notes,
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => null)
  return typeof data?.error === 'string' ? data.error : fallback
}

export function BillingPanel({ companies, currentCompanyId, onFeedback }: BillingPanelProps) {
  const [data, setData] = useState<BillingData>({
    plans: [],
    subscriptions: [],
    payments: [],
    events: [],
    asaasStatus: null,
  })
  const [draft, setDraft] = useState<BillingDraft>(() => ({
    ...emptyDraft,
    companyId: currentCompanyId ? String(currentCompanyId) : '',
  }))
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState('')

  const selectedCompanyId = Number.parseInt(draft.companyId, 10)
  const selectedSubscription = data.subscriptions.find((subscription) => subscription.companyId === selectedCompanyId) ?? null
  const selectedPlan = data.plans.find((plan) => plan.id === draft.planId) ?? null
  const basePriceCents = getPlanPrice(selectedPlan, draft.billingCycle)
  const discountPercent = Math.min(Math.max(Number.parseInt(draft.discountPercent || '0', 10) || 0, 0), 100)
  const contractedPriceCents = draft.lifetimeAccess ? 0 : Math.round(basePriceCents * (1 - discountPercent / 100))

  const orderedSubscriptions = useMemo(
    () =>
      [...data.subscriptions].sort((left, right) =>
        getCompanyName(companies, left.companyId).localeCompare(getCompanyName(companies, right.companyId), 'pt-BR'),
      ),
    [companies, data.subscriptions],
  )

  async function loadBillingData() {
    setIsLoading(true)
    try {
      const [plansResponse, subscriptionsResponse, asaasStatusResponse] = await Promise.all([
        fetch('/api/billing/plans', { cache: 'no-store' }),
        fetch('/api/billing/subscriptions', { cache: 'no-store' }),
        fetch('/api/billing/asaas/status', { cache: 'no-store' }),
      ])
      if (!plansResponse.ok || !subscriptionsResponse.ok || !asaasStatusResponse.ok) {
        throw new Error('Falha ao carregar dados de assinatura.')
      }
      const [plansData, subscriptionsData, asaasStatusData] = await Promise.all([
        plansResponse.json(),
        subscriptionsResponse.json(),
        asaasStatusResponse.json(),
      ])
      setData({
        plans: Array.isArray(plansData?.plans) ? plansData.plans : [],
        subscriptions: Array.isArray(subscriptionsData?.subscriptions) ? subscriptionsData.subscriptions : [],
        payments: Array.isArray(subscriptionsData?.payments) ? subscriptionsData.payments : [],
        events: Array.isArray(subscriptionsData?.events) ? subscriptionsData.events : [],
        asaasStatus: asaasStatusData,
      })

      const current =
        subscriptionsData?.subscriptions?.find?.((subscription: CompanySubscriptionRecord) => subscription.companyId === currentCompanyId) ??
        subscriptionsData?.subscriptions?.[0] ??
        null
      if (current) {
        setDraft(buildDraftFromSubscription(current))
      }
    } catch (error) {
      onFeedback({
        status: 'error',
        title: 'Nao foi possivel carregar assinaturas',
        message: error instanceof Error ? error.message : 'Tente novamente.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBillingData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectSubscription(subscription: CompanySubscriptionRecord) {
    setPaymentUrl('')
    setDraft(buildDraftFromSubscription(subscription))
  }

  async function saveSubscription() {
    const companyId = Number.parseInt(draft.companyId, 10)
    if (!Number.isFinite(companyId)) {
      onFeedback({ status: 'error', title: 'Empresa obrigatoria', message: 'Selecione uma empresa para salvar a assinatura.' })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/billing/subscriptions/${companyId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planId: draft.planId,
          status: draft.lifetimeAccess ? 'LIFETIME_FREE' : draft.status,
          billingCycle: draft.billingCycle,
          discountPercent,
          lifetimeAccess: draft.lifetimeAccess,
          founderPromotion: draft.founderPromotion,
          feedbackParticipant: draft.feedbackParticipant,
          trialStartedAt: draft.trialStartedAt || null,
          trialEndsAt: draft.trialEndsAt || null,
          graceEndsAt: draft.graceEndsAt || null,
          currentPeriodStartedAt: draft.currentPeriodStartedAt || null,
          currentPeriodEndsAt: draft.currentPeriodEndsAt || null,
          notes: draft.notes,
        }),
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Falha ao salvar assinatura.'))
      }
      const responseData = await response.json()
      const saved = responseData.subscription as CompanySubscriptionRecord
      setData((current) => ({
        ...current,
        subscriptions: current.subscriptions.some((subscription) => subscription.companyId === saved.companyId)
          ? current.subscriptions.map((subscription) => (subscription.companyId === saved.companyId ? saved : subscription))
          : [...current.subscriptions, saved],
      }))
      setDraft(buildDraftFromSubscription(saved))
      onFeedback({ status: 'success', title: 'Assinatura salva', message: 'Os dados comerciais da empresa foram atualizados.' })
    } catch (error) {
      onFeedback({
        status: 'error',
        title: 'Erro ao salvar assinatura',
        message: error instanceof Error ? error.message : 'Tente novamente.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function createTrial() {
    const companyId = Number.parseInt(draft.companyId, 10)
    if (!Number.isFinite(companyId)) {
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch(`/api/billing/subscriptions/${companyId}/trial`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planId: draft.planId,
          billingCycle: draft.billingCycle,
          discountPercent,
          founderPromotion: draft.founderPromotion,
          feedbackParticipant: draft.feedbackParticipant,
        }),
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Falha ao iniciar trial.'))
      }
      await loadBillingData()
      onFeedback({ status: 'success', title: 'Trial registrado', message: 'A empresa ficou com trial de 15 dias e carencia de 5 dias.' })
    } catch (error) {
      onFeedback({ status: 'error', title: 'Erro ao iniciar trial', message: error instanceof Error ? error.message : 'Tente novamente.' })
    } finally {
      setIsSaving(false)
    }
  }

  async function createAsaasCharge() {
    const companyId = Number.parseInt(draft.companyId, 10)
    if (!Number.isFinite(companyId)) {
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch(`/api/billing/subscriptions/${companyId}/asaas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billingType: 'UNDEFINED' }),
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Falha ao criar cobranca Asaas.'))
      }
      const responseData = await response.json()
      setPaymentUrl(typeof responseData.paymentUrl === 'string' ? responseData.paymentUrl : '')
      await loadBillingData()
      onFeedback({
        status: 'success',
        title: 'Cobranca Asaas criada',
        message: responseData.paymentUrl ? 'Use o link exibido no painel para enviar ao cliente.' : 'Cobranca criada. Aguarde o webhook do pagamento.',
      })
    } catch (error) {
      onFeedback({ status: 'error', title: 'Erro ao criar cobranca', message: error instanceof Error ? error.message : 'Tente novamente.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Assinaturas</p>
          <h2>Planos, trial e cobranca</h2>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="ghost-button" onClick={() => void loadBillingData()} disabled={isLoading}>
            Atualizar
          </button>
        </div>
      </div>

      <p className="context-copy">
        Controle comercial por empresa. Empresas atuais podem permanecer como vitalicio free, enquanto novas empresas entram em trial ou cobranca recorrente.
      </p>

      <div className="selector-list company-management-list">
        <article className="selector-item">
          <div className="selector-main company-card-static">
            <strong>Asaas</strong>
            <span>{data.asaasStatus?.configured ? 'API configurada' : 'API nao configurada'}</span>
            <span>Ambiente: {data.asaasStatus?.environment ?? '-'}</span>
            <span>Webhook token: {data.asaasStatus?.webhookTokenConfigured ? 'configurado' : 'pendente'}</span>
          </div>
        </article>
        {data.plans.map((plan) => (
          <article key={plan.id} className="selector-item">
            <div className="selector-main company-card-static">
              <strong>{plan.name}</strong>
              <span>{plan.description}</span>
              <span>Mensal: {formatCurrencyFromCents(plan.monthlyPriceCents)}</span>
              <span>Quinzenal: {formatCurrencyFromCents(plan.fortnightlyPriceCents)}</span>
              <span>Semestral: {formatCurrencyFromCents(plan.semiannualPriceCents)}</span>
              <span>Anual: {formatCurrencyFromCents(plan.annualPriceCents)}</span>
            </div>
          </article>
        ))}
      </div>

      <section className="inner-panel">
        <div className="section-heading">
          <div>
            <p className="kicker">Configuracao</p>
            <h2>Assinatura da empresa</h2>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Empresa</span>
            <select
              value={draft.companyId}
              onChange={(event) => {
                const companyId = Number.parseInt(event.target.value, 10)
                const subscription = data.subscriptions.find((item) => item.companyId === companyId) ?? null
                setPaymentUrl('')
                setDraft(subscription ? buildDraftFromSubscription(subscription) : { ...emptyDraft, companyId: event.target.value })
              }}
            >
              <option value="">Selecione</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.tradeName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Plano</span>
            <select value={draft.planId} onChange={(event) => setDraft((current) => ({ ...current, planId: event.target.value }))}>
              {data.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ciclo</span>
            <select value={draft.billingCycle} onChange={(event) => setDraft((current) => ({ ...current, billingCycle: event.target.value as BillingCycle }))}>
              {Object.entries(cycleLabels).map(([cycle, label]) => (
                <option key={cycle} value={cycle}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as CompanySubscriptionStatus }))}>
              {Object.entries(statusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Desconto (%)</span>
            <input
              value={draft.discountPercent}
              onChange={(event) => setDraft((current) => ({ ...current, discountPercent: event.target.value.replace(/\D/g, '').slice(0, 3) }))}
              inputMode="numeric"
            />
          </label>
          <label className="field">
            <span>Valor cheio</span>
            <input value={formatCurrencyFromCents(basePriceCents)} readOnly />
          </label>
          <label className="field">
            <span>Valor contratado</span>
            <input value={formatCurrencyFromCents(contractedPriceCents)} readOnly />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.lifetimeAccess}
              onChange={(event) => setDraft((current) => ({ ...current, lifetimeAccess: event.target.checked, status: event.target.checked ? 'LIFETIME_FREE' : current.status }))}
            />
            <span>Acesso vitalicio free</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.founderPromotion}
              onChange={(event) => setDraft((current) => ({ ...current, founderPromotion: event.target.checked }))}
            />
            <span>Programa fundador</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.feedbackParticipant}
              onChange={(event) => setDraft((current) => ({ ...current, feedbackParticipant: event.target.checked }))}
            />
            <span>Participa de feedback</span>
          </label>
          <label className="field">
            <span>Inicio trial</span>
            <input type="date" value={draft.trialStartedAt} onChange={(event) => setDraft((current) => ({ ...current, trialStartedAt: event.target.value }))} />
          </label>
          <label className="field">
            <span>Fim trial</span>
            <input type="date" value={draft.trialEndsAt} onChange={(event) => setDraft((current) => ({ ...current, trialEndsAt: event.target.value }))} />
          </label>
          <label className="field">
            <span>Fim carencia</span>
            <input type="date" value={draft.graceEndsAt} onChange={(event) => setDraft((current) => ({ ...current, graceEndsAt: event.target.value }))} />
          </label>
          <label className="field">
            <span>Inicio periodo</span>
            <input type="date" value={draft.currentPeriodStartedAt} onChange={(event) => setDraft((current) => ({ ...current, currentPeriodStartedAt: event.target.value }))} />
          </label>
          <label className="field">
            <span>Fim periodo</span>
            <input type="date" value={draft.currentPeriodEndsAt} onChange={(event) => setDraft((current) => ({ ...current, currentPeriodEndsAt: event.target.value }))} />
          </label>
          <label className="field field-span-all">
            <span>Observacoes</span>
            <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="primary-button" onClick={() => void saveSubscription()} disabled={isSaving || !draft.companyId}>
            Salvar assinatura
          </button>
          <button type="button" className="ghost-button" onClick={() => void createTrial()} disabled={isSaving || !draft.companyId}>
            Criar trial 15+5
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void createAsaasCharge()}
            disabled={isSaving || !draft.companyId || draft.lifetimeAccess || contractedPriceCents <= 0}
          >
            Criar cobranca Asaas
          </button>
        </div>

        {paymentUrl ? (
          <div className="empty-state empty-state-inline">
            <strong>Link de pagamento criado</strong>
            <p>{paymentUrl}</p>
          </div>
        ) : null}

        {selectedSubscription ? (
          <div className="context-copy">
            Asaas customer: {selectedSubscription.asaasCustomerId || '-'} | assinatura: {selectedSubscription.asaasSubscriptionId || '-'} | ultimo pagamento: {selectedSubscription.lastPaymentStatus || '-'}
          </div>
        ) : null}
      </section>

      <section className="inner-panel">
        <div className="section-heading">
          <div>
            <p className="kicker">Empresas</p>
            <h2>Status comercial</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Ciclo</th>
                <th>Valor</th>
                <th>Trial</th>
                <th>Asaas</th>
              </tr>
            </thead>
            <tbody>
              {orderedSubscriptions.map((subscription) => (
                <tr key={subscription.companyId} onClick={() => selectSubscription(subscription)} style={{ cursor: 'pointer' }}>
                  <td>{getCompanyName(companies, subscription.companyId)}</td>
                  <td>{data.plans.find((plan) => plan.id === subscription.planId)?.name ?? subscription.planId}</td>
                  <td>{statusLabels[subscription.status] ?? subscription.status}</td>
                  <td>{cycleLabels[subscription.billingCycle] ?? subscription.billingCycle}</td>
                  <td>{formatCurrencyFromCents(subscription.contractedPriceCents)}</td>
                  <td>
                    {toDateInputValue(subscription.trialStartedAt) || '-'} a {toDateInputValue(subscription.trialEndsAt) || '-'}
                  </td>
                  <td>{subscription.asaasSubscriptionId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="inner-panel">
        <div className="section-heading">
          <div>
            <p className="kicker">Pagamentos</p>
            <h2>Ultimas cobrancas e webhooks</h2>
          </div>
        </div>
        <div className="selector-list company-management-list">
          {data.payments.slice(0, 6).map((payment) => (
            <article key={payment.id} className="selector-item">
              <div className="selector-main company-card-static">
                <strong>{getCompanyName(companies, payment.companyId)} - {payment.status}</strong>
                <span>{formatCurrencyFromCents(payment.valueCents)} | vencimento {payment.dueDate || '-'}</span>
                <span>{payment.invoiceUrl || 'Sem link registrado'}</span>
              </div>
            </article>
          ))}
          {data.events.slice(0, 6).map((event) => (
            <article key={`event-${event.id}`} className="selector-item">
              <div className="selector-main company-card-static">
                <strong>{event.eventType} - {event.result}</strong>
                <span>{event.processedAt ? `${event.processedAt.slice(0, 10)} ${event.processedAt.slice(11, 16)}` : '-'}</span>
                <span>{event.errorMessage || event.providerPaymentId || event.providerSubscriptionId || '-'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
