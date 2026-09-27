type MasterOverviewPanelProps = {
  companyTradeName: string
  auditOverview: {
    total: number
    today: number
    alerts: number
    impacts: number
    actors: number
  }
}

export function MasterOverviewPanel({ companyTradeName, auditOverview }: MasterOverviewPanelProps) {
  const cards = [
    { label: 'Eventos da empresa', value: String(auditOverview.total) },
    { label: 'Eventos hoje', value: String(auditOverview.today) },
    { label: 'Alertas', value: String(auditOverview.alerts) },
    { label: 'Impactos', value: String(auditOverview.impacts) },
    { label: 'Usuarios/atores', value: String(auditOverview.actors) },
  ]

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Master</p>
          <h2>Painel informativo</h2>
        </div>
      </div>
      <p className="context-copy">
        Auditoria da empresa ativa para o usuario master. Este painel mostra acessos, acoes administrativas e impactos
        operacionais registrados em {companyTradeName}.
      </p>

      <div className="selector-list company-management-list">
        {cards.map((card) => (
          <article key={card.label} className="selector-item">
            <div className="selector-main company-card-static">
              <strong>{card.value}</strong>
              <span>{card.label}</span>
              <span>{companyTradeName}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
