import { useEffect, useMemo, useRef, useState } from 'react'
import { NormalizedTextInput } from './NormalizedTextField'
import type { AuditLogRecord, AuditPanelTab, AuditResult, AuditSeverity } from '../types/domain'
import { formatDateForDisplay, formatTimeForDisplay, normalizeFreeText } from '../utils/core'

type MasterAuditPanelProps = {
  records: AuditLogRecord[]
  companyNames: Map<number, string>
  initialViewState: MasterAuditViewState
  onViewStateChange: (state: MasterAuditViewState) => void
}

export type MasterAuditViewState = {
  tab: AuditPanelTab
  search: string
  severity: 'ALL' | AuditSeverity
  moduleFilter: string
  selectedId: number | null
}

const resultLabels: Record<AuditResult, string> = {
  SUCCESS: 'Sucesso',
  WARNING: 'Alerta',
  ERROR: 'Erro',
}

const severityLabels: Record<AuditSeverity, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
}

export function MasterAuditPanel({ records, companyNames, initialViewState, onViewStateChange }: MasterAuditPanelProps) {
  const [tab, setTab] = useState<AuditPanelTab>(initialViewState.tab)
  const [search, setSearch] = useState(initialViewState.search)
  const [severity, setSeverity] = useState<'ALL' | AuditSeverity>(initialViewState.severity)
  const [moduleFilter, setModuleFilter] = useState(initialViewState.moduleFilter)
  const [selectedId, setSelectedId] = useState<number | null>(initialViewState.selectedId)
  const latestViewStateRef = useRef(initialViewState)

  useEffect(() => {
    latestViewStateRef.current = { tab, search, severity, moduleFilter, selectedId }
  }, [tab, search, severity, moduleFilter, selectedId])

  useEffect(() => () => onViewStateChange(latestViewStateRef.current), [onViewStateChange])

  const modules = useMemo(
    () => Array.from(new Set(records.map((record) => record.module))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [records],
  )
  const filteredRecords = useMemo(() => {
    const normalizedSearch = normalizeFreeText(search)
    return records.filter((record) => {
      const matchesSearch =
        normalizedSearch === '' ||
        [
          record.actorUserName,
          record.actorUsername,
          record.module,
          record.actionLabel,
          record.targetLabel,
          record.summary,
          record.impactSummary,
        ].some((value) => normalizeFreeText(value).includes(normalizedSearch))
      const matchesSeverity = severity === 'ALL' || record.severity === severity
      const matchesModule = moduleFilter === 'ALL' || record.module === moduleFilter
      const matchesTab =
        tab === 'AUDITORIA'
          ? true
          : tab === 'ALERTAS'
            ? record.severity === 'HIGH' || record.severity === 'CRITICAL' || record.result !== 'SUCCESS'
            : record.impactSummary.trim() !== '' || record.relatedCompanyIds.length > 0
      return matchesSearch && matchesSeverity && matchesModule && matchesTab
    })
  }, [records, search, severity, moduleFilter, tab])

  useEffect(() => {
    if (selectedId !== null && !filteredRecords.some((record) => record.id === selectedId)) {
      setSelectedId(filteredRecords[0]?.id ?? null)
    }
  }, [filteredRecords, selectedId])

  const selectedRecord = selectedId === null
    ? null
    : filteredRecords.find((record) => record.id === selectedId) ?? null

  function getCompanyName(companyId: number) {
    return companyNames.get(companyId) ?? `EMPRESA ${companyId}`
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Auditoria</p>
          <h2>Eventos por empresa</h2>
        </div>
      </div>

      <div className="panel-tabs" role="tablist" aria-label="Painel master">
        <button type="button" className={tab === 'AUDITORIA' ? 'panel-tab active' : 'panel-tab'} onClick={() => setTab('AUDITORIA')}>
          Auditoria
        </button>
        <button type="button" className={tab === 'ALERTAS' ? 'panel-tab active' : 'panel-tab'} onClick={() => setTab('ALERTAS')}>
          Alertas
        </button>
        <button type="button" className={tab === 'IMPACTOS' ? 'panel-tab active' : 'panel-tab'} onClick={() => setTab('IMPACTOS')}>
          Impactos
        </button>
      </div>

      <div className="report-search-row">
        <label className="field search-field report-search-field">
          <span>Buscar</span>
          <NormalizedTextInput
            value={search}
            onChange={setSearch}
            commitMode="debounce"
            placeholder="Busque usuario, modulo, acao, alvo ou resumo"
          />
        </label>
        <label className="field report-selector-field">
          <span>Severidade</span>
          <select value={severity} onChange={(event) => setSeverity(event.target.value as 'ALL' | AuditSeverity)}>
            <option value="ALL">Todas</option>
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="CRITICAL">Critica</option>
          </select>
        </label>
        <label className="field report-selector-field">
          <span>Modulo</span>
          <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="ALL">Todos</option>
            {modules.map((moduleName) => <option key={moduleName} value={moduleName}>{moduleName}</option>)}
          </select>
        </label>
      </div>

      {filteredRecords.length > 0 ? (
        <div className="selector-list company-management-list">
          <section className="inner-panel">
            <div className="table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Data</th><th>Usuario</th><th>Modulo</th><th>Acao</th><th>Alvo</th><th>Resultado</th><th>Impacto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => setSelectedId(record.id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedRecord?.id === record.id ? 'rgba(22, 101, 52, 0.08)' : undefined,
                      }}
                    >
                      <td>{formatDateForDisplay(record.occurredAt.slice(0, 10))} {formatTimeForDisplay(record.occurredAt)}</td>
                      <td><strong>{record.actorUserName}</strong><br /><span>{record.actorUsername}</span></td>
                      <td>{record.module}</td>
                      <td>{record.actionLabel}</td>
                      <td>{record.targetLabel}</td>
                      <td>
                        <span className={
                          record.result === 'SUCCESS'
                            ? 'status-pill status-active'
                            : record.result === 'WARNING'
                              ? 'status-pill status-warning'
                              : 'status-pill status-inactive'
                        }>
                          {resultLabels[record.result]} • {severityLabels[record.severity]}
                        </span>
                      </td>
                      <td>{record.impactSummary || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="inner-panel">
            <div className="section-heading">
              <div><p className="kicker">Detalhe</p><h2>{selectedRecord?.actionLabel ?? 'Selecione um evento'}</h2></div>
            </div>

            {selectedRecord ? (
              <div className="selector-list company-management-list">
                <article className="selector-item">
                  <div className="selector-main company-card-static">
                    <strong>{selectedRecord.summary}</strong>
                    <span>{formatDateForDisplay(selectedRecord.occurredAt.slice(0, 10))} {formatTimeForDisplay(selectedRecord.occurredAt)}</span>
                    <span>Empresa ativa: {getCompanyName(selectedRecord.companyId)}</span>
                  </div>
                </article>
                <article className="selector-item">
                  <div className="selector-main company-card-static">
                    <strong>Ator</strong>
                    <span>{selectedRecord.actorUserName} ({selectedRecord.actorUsername})</span>
                    <span>Perfil: {selectedRecord.actorRole}</span>
                    <span>Origem: {selectedRecord.actorKind === 'SYSTEM_ADMIN' ? 'Master' : selectedRecord.actorKind === 'APP_USER' ? 'Usuario interno' : 'Sistema'}</span>
                  </div>
                </article>
                <article className="selector-item">
                  <div className="selector-main company-card-static">
                    <strong>Alvo</strong><span>{selectedRecord.targetType}</span><span>{selectedRecord.targetLabel}</span><span>ID: {selectedRecord.targetId}</span>
                  </div>
                </article>
                <article className="selector-item">
                  <div className="selector-main company-card-static">
                    <strong>Impacto</strong>
                    <span>{selectedRecord.impactSummary || 'Sem impacto derivado registrado.'}</span>
                    <span>Resultado: {resultLabels[selectedRecord.result]}</span>
                    <span>Severidade: {severityLabels[selectedRecord.severity]}</span>
                  </div>
                </article>
                {selectedRecord.relatedCompanyIds.length > 0 ? (
                  <article className="selector-item">
                    <div className="selector-main company-card-static">
                      <strong>Empresas relacionadas</strong>
                      <span>{selectedRecord.relatedCompanyIds.map((companyId) => getCompanyName(companyId)).join(', ')}</span>
                    </div>
                  </article>
                ) : null}
                <article className="selector-item">
                  <div className="selector-main company-card-static">
                    <strong>Contexto tecnico</strong>
                    <span><pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{JSON.stringify(selectedRecord.details, null, 2)}</pre></span>
                  </div>
                </article>
              </div>
            ) : (
              <div className="empty-state">
                <strong>Nenhum evento selecionado.</strong>
                <p>Escolha um registro da tabela para ver ator, impacto e contexto tecnico.</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="empty-state">
          <strong>Nenhum evento encontrado.</strong>
          <p>Ajuste os filtros ou aguarde novos registros da empresa ativa.</p>
        </div>
      )}
    </section>
  )
}
