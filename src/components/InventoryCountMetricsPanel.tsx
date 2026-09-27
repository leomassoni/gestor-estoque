type InventoryCountMetricsPanelProps = {
  isVisible: boolean
  kindLabel: string
  closedReferenceLabel: string
  emptyWeightTitle: string
  emptyWeightLabel: string
  minimumLabel: string
}

export function InventoryCountMetricsPanel({
  isVisible,
  kindLabel,
  closedReferenceLabel,
  emptyWeightTitle,
  emptyWeightLabel,
  minimumLabel,
}: InventoryCountMetricsPanelProps) {
  if (!isVisible) {
    return null
  }

  return (
    <div className="receituario-summary-grid receituario-summary-grid-metrics">
      <article className="receituario-metric-card">
        <span>Tipo</span>
        <strong>{kindLabel}</strong>
      </article>
      <article className="receituario-metric-card">
        <span>Referencia por item fechado</span>
        <strong>{closedReferenceLabel}</strong>
      </article>
      <article className="receituario-metric-card">
        <span>{emptyWeightTitle}</span>
        <strong>{emptyWeightLabel}</strong>
      </article>
      <article className="receituario-metric-card">
        <span>Estoque minimo do centro</span>
        <strong>{minimumLabel}</strong>
      </article>
    </div>
  )
}
