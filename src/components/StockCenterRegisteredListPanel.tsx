import { NormalizedTextInput } from './NormalizedTextField'
import type { AppUserRecord, StockCenterRecord } from '../types/domain'
import { normalizeSuggestionSet } from '../utils/core'

type StockCenterRegisteredListPanelProps = {
  centerListId: string
  centerSearch: string
  companyUsers: AppUserRecord[]
  visibleCenters: StockCenterRecord[]
  onCenterSearchChange: (value: string) => void
  onDeleteCenter: (centerId: number) => void
  onEditCenter: (centerId: number) => void
  onToggleCenterStatus: (centerId: number) => void
}

export function StockCenterRegisteredListPanel({
  centerListId,
  centerSearch,
  companyUsers,
  visibleCenters,
  onCenterSearchChange,
  onDeleteCenter,
  onEditCenter,
  onToggleCenterStatus,
}: StockCenterRegisteredListPanelProps) {
  const centerSuggestions = normalizeSuggestionSet(visibleCenters.flatMap((center) => [center.name, center.code, center.sector]))

  return (
    <>
      <div className="section-heading section-heading-inline stock-center-subheading">
        <div>
          <p className="kicker">Estoque</p>
          <h2>Centros cadastrados</h2>
        </div>
      </div>

      <div className="list-toolbar">
        <label className="field search-field">
          <span>Buscar centro de estoque</span>
          <NormalizedTextInput
            list={centerListId}
            value={centerSearch}
            onChange={onCenterSearchChange}
            commitMode="debounce"
            placeholder="Busque por nome, codigo ou setor"
          />
          <datalist id={centerListId}>
            {centerSuggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </label>
      </div>

      {visibleCenters.length > 0 ? (
        <div className="selector-list company-management-list">
          {visibleCenters.map((center) => {
            const participantNames = center.userIds
              .map((userId) => companyUsers.find((user) => user.id === userId)?.fullName ?? null)
              .filter((value): value is string => Boolean(value))
            const responsibleNames = center.responsibleUserIds
              .map((userId) => companyUsers.find((user) => user.id === userId)?.fullName ?? null)
              .filter((value): value is string => Boolean(value))

            return (
              <article key={center.id} className="list-row user-list-row">
                <div className="user-row-header">
                  <div className="user-title-group">
                    <strong>{center.name}</strong>
                    <span className={center.isActive ? 'status-pill status-active' : 'status-pill status-inactive'}>
                      {center.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="ghost-button" onClick={() => onEditCenter(center.id)}>
                      Atualizar
                    </button>
                    <button
                      type="button"
                      className={center.isActive ? 'warning-button' : 'ghost-button'}
                      onClick={() => onToggleCenterStatus(center.id)}
                    >
                      {center.isActive ? 'Inativar' : 'Ativar'}
                    </button>
                    <button type="button" className="danger-button" onClick={() => onDeleteCenter(center.id)}>
                      Excluir
                    </button>
                  </div>
                </div>
                <div className="row-meta user-row-meta">
                  <div className="user-meta-line">
                    <span><strong className="meta-label">Codigo:</strong> {center.code}</span>
                    <span><strong className="meta-label">Setor:</strong> {center.sector}</span>
                    <span><strong className="meta-label">Responsaveis:</strong> {responsibleNames.join(', ') || 'Nao definido'}</span>
                    <span><strong className="meta-label">Usuarios:</strong> {participantNames.join(', ') || 'Nenhum usuario associado'}</span>
                    <span><strong className="meta-label">Estoques minimos definidos:</strong> {String(center.minimumStocks.length)}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <strong>Nenhum centro de estoque cadastrado.</strong>
          <p>Cadastre o estoque central, bares, cozinhas ou outras frentes que controlam saldo de forma independente.</p>
        </div>
      )}
    </>
  )
}
