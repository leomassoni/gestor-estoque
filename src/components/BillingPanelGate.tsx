import { lazy, Suspense } from 'react'
import type { CompanyRecord, SaveFeedback } from '../types/domain'

const BillingPanel = lazy(() =>
  import('./BillingPanel').then((module) => ({ default: module.BillingPanel })),
)

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}
const billingPanelEnabled = viteEnv.VITE_BILLING_PANEL_ENABLED === 'true'

type BillingPanelGateProps = {
  companies: CompanyRecord[]
  currentCompanyId: number | null
  onFeedback: (feedback: SaveFeedback) => void
}

export function BillingPanelGate({ companies, currentCompanyId, onFeedback }: BillingPanelGateProps) {
  if (!billingPanelEnabled) {
    return null
  }

  return (
    <Suspense
      fallback={
        <section className="panel">
          <div className="empty-state empty-state-inline">
            <strong>Carregando assinaturas...</strong>
          </div>
        </section>
      }
    >
      <BillingPanel
        companies={companies}
        currentCompanyId={currentCompanyId}
        onFeedback={onFeedback}
      />
    </Suspense>
  )
}
