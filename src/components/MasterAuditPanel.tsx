import { useEffect, useMemo, useRef, useState } from 'react'
import { NormalizedTextInput } from './NormalizedTextField'
import { renderGenericColumnHeader } from './tableColumnHeaders'
import type { AuditLogRecord, AuditPanelTab, AuditResult, AuditSeverity, ColumnSort } from '../types/domain'
import { formatDateForDisplay, formatDecimal, formatTimeForDisplay, normalizeFreeText } from '../utils/core'

type AuditColumnKey = 'date' | 'actor' | 'module' | 'action' | 'target' | 'result' | 'impact'
const columnOptions: Array<[AuditColumnKey, string]> = [
  ['date', 'Data'], ['actor', 'Usuario'], ['module', 'Modulo'], ['action', 'Acao'],
  ['target', 'Alvo'], ['result', 'Resultado'], ['impact', 'Impacto'],
]
const initialVisibility = Object.fromEntries(columnOptions.map(([key]) => [key, true])) as Record<AuditColumnKey, boolean>
const pageSize = 50

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
  columnFilters?: Partial<Record<AuditColumnKey, string[]>>
  columnSort?: ColumnSort<AuditColumnKey> | null
  columnVisibility?: Record<AuditColumnKey, boolean>
  page?: number
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

function getColumnValue(record: AuditLogRecord, key: AuditColumnKey): string {
  switch (key) {
    case 'date': return formatDateForDisplay(record.occurredAt.slice(0, 10))
    case 'actor': return record.actorUserName
    case 'module': return record.module
    case 'action': return record.actionLabel
    case 'target': return record.targetLabel
    case 'result': return `${resultLabels[record.result]} - ${severityLabels[record.severity]}`
    case 'impact': return record.impactSummary.trim() ? 'Com descricao' : 'Sem descricao'
  }
}

export function MasterAuditPanel({ records, companyNames, initialViewState, onViewStateChange }: MasterAuditPanelProps) {
  const [tab, setTab] = useState<AuditPanelTab>(initialViewState.tab)
  const [search, setSearch] = useState(initialViewState.search)
  const [severity, setSeverity] = useState<'ALL' | AuditSeverity>(initialViewState.severity)
  const [moduleFilter, setModuleFilter] = useState(initialViewState.moduleFilter)
  const [selectedId, setSelectedId] = useState<number | null>(initialViewState.selectedId)
  const [columnFilters, setColumnFilters] = useState<Partial<Record<AuditColumnKey, string[]>>>(initialViewState.columnFilters ?? {})
  const [columnSort, setColumnSort] = useState<ColumnSort<AuditColumnKey> | null>(initialViewState.columnSort ?? null)
  const [columnVisibility, setColumnVisibility] = useState<Record<AuditColumnKey, boolean>>(initialViewState.columnVisibility ?? initialVisibility)
  const [openColumnMenu, setOpenColumnMenu] = useState<AuditColumnKey | null>(null)
  const [page, setPage] = useState(initialViewState.page ?? 1)
  const latestViewStateRef = useRef(initialViewState)

  useEffect(() => {
    latestViewStateRef.current = { tab, search, severity, moduleFilter, selectedId, columnFilters, columnSort, columnVisibility, page }
  }, [tab, search, severity, moduleFilter, selectedId, columnFilters, columnSort, columnVisibility, page])

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

  const distinctColumnValues = useMemo(() => {
    const dateIsoByDisplay = new Map(records.map((record) => [getColumnValue(record, 'date'), record.occurredAt.slice(0, 10)]))
    return Object.fromEntries(columnOptions.map(([key]) => [key,
      Array.from(new Set(records.map((record) => getColumnValue(record, key))))
        .sort((left, right) => key === 'date'
          ? (dateIsoByDisplay.get(right) ?? '').localeCompare(dateIsoByDisplay.get(left) ?? '')
          : left.localeCompare(right, 'pt-BR', { numeric: true })),
    ])) as Record<AuditColumnKey, string[]>
  }, [records])
  const visibleRecords = useMemo(() => filteredRecords.filter((record) =>
    columnOptions.every(([key]) => {
      const selected = columnFilters[key]
      return !selected?.length || selected.includes(getColumnValue(record, key))
    }),
  ).sort((left, right) => {
    if (!columnSort) return 0
    const comparison = columnSort.key === 'date'
      ? left.occurredAt.localeCompare(right.occurredAt)
      : getColumnValue(left, columnSort.key).localeCompare(getColumnValue(right, columnSort.key), 'pt-BR', { numeric: true })
    return columnSort.direction === 'asc' ? comparison : -comparison
  }), [filteredRecords, columnFilters, columnSort])
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paginatedRecords = visibleRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const selectedRecord = selectedId === null
    ? null
    : paginatedRecords.find((record) => record.id === selectedId) ?? paginatedRecords[0] ?? null

  const hiddenColumns = columnOptions.filter(([key]) => !columnVisibility[key])
  const pagination = visibleRecords.length > pageSize ? (
    <nav className="pagination-row" aria-label="Paginas dos eventos">
      <span className="pagination-range">
        {formatDecimal((currentPage - 1) * pageSize + 1)}-{formatDecimal(Math.min(visibleRecords.length, currentPage * pageSize))} de {formatDecimal(visibleRecords.length)}
      </span>
      <div className="pagination-actions">
        <button type="button" className="ghost-button pagination-button" aria-label="Pagina anterior"
          disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>&lt;</button>
        <span aria-live="polite">{formatDecimal(currentPage)} / {formatDecimal(pageCount)}</span>
        <button type="button" className="ghost-button pagination-button" aria-label="Proxima pagina"
          disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>&gt;</button>
      </div>
    </nav>
  ) : null

  const header = (key: AuditColumnKey, label: string) => columnVisibility[key]
    ? renderGenericColumnHeader({
        key, label, openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues,
        setColumnFilters: (update) => { setColumnFilters(update); setPage(1) }, setColumnVisibility, columnSort,
        setColumnSort: (update) => { setColumnSort(update); setPage(1) },
        sortLabels: key === 'date' ? { asc: 'Antigos', desc: 'Recentes' } : { asc: 'A-Z', desc: 'Z-A' },
        stickyKey: 'date', stopMenuPropagation: true,
      })
    : null

  function getCompanyName(companyId: number) {
    return companyNames.get(companyId) ?? `EMPRESA ${companyId}`
  }

  return (
    <section className="panel master-audit-panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Auditoria</p>
          <h2>Eventos por empresa</h2>
        </div>
      </div>

      <div className="panel-tabs" role="tablist" aria-label="Painel master">
        <button type="button" className={tab === 'AUDITORIA' ? 'panel-tab active' : 'panel-tab'} onClick={() => { setTab('AUDITORIA'); setPage(1) }}>
          Auditoria
        </button>
        <button type="button" className={tab === 'ALERTAS' ? 'panel-tab active' : 'panel-tab'} onClick={() => { setTab('ALERTAS'); setPage(1) }}>
          Alertas
        </button>
        <button type="button" className={tab === 'IMPACTOS' ? 'panel-tab active' : 'panel-tab'} onClick={() => { setTab('IMPACTOS'); setPage(1) }}>
          Impactos
        </button>
      </div>

      <div className="report-search-row">
        <label className="field search-field report-search-field">
          <span>Buscar</span>
          <NormalizedTextInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1) }}
            commitMode="debounce"
            placeholder="Busque usuario, modulo, acao, alvo ou resumo"
          />
        </label>
        <label className="field report-selector-field">
          <span>Severidade</span>
          <select value={severity} onChange={(event) => { setSeverity(event.target.value as 'ALL' | AuditSeverity); setPage(1) }}>
            <option value="ALL">Todas</option>
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="CRITICAL">Critica</option>
          </select>
        </label>
        <label className="field report-selector-field">
          <span>Modulo</span>
          <select value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setPage(1) }}>
            <option value="ALL">Todos</option>
            {modules.map((moduleName) => <option key={moduleName} value={moduleName}>{moduleName}</option>)}
          </select>
        </label>
      </div>

      {hiddenColumns.length > 0 ? (
        <div className="hidden-columns">
          <strong>Colunas ocultas</strong>
          <div className="hidden-columns-list">
            {hiddenColumns.map(([key, label]) => (
              <button key={key} type="button" className="ghost-button hidden-column-chip"
                onClick={() => setColumnVisibility((current) => ({ ...current, [key]: true }))}>{label}</button>
            ))}
          </div>
        </div>
      ) : null}

      {records.length > 0 ? (
        <div className="selector-list company-management-list">
          <section className="inner-panel">
            {pagination}
            <div className="table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    {columnOptions.map(([key, label]) => header(key, label))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => setSelectedId(record.id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedRecord?.id === record.id ? 'rgba(22, 101, 52, 0.08)' : undefined,
                      }}
                    >
                      {columnVisibility.date ? <td>{formatDateForDisplay(record.occurredAt.slice(0, 10))} {formatTimeForDisplay(record.occurredAt)}</td> : null}
                      {columnVisibility.actor ? <td><strong>{record.actorUserName}</strong><br /><span>{record.actorUsername}</span></td> : null}
                      {columnVisibility.module ? <td>{record.module}</td> : null}
                      {columnVisibility.action ? <td>{record.actionLabel}</td> : null}
                      {columnVisibility.target ? <td><span className="master-audit-cell-clamp" title={record.targetLabel}>{record.targetLabel}</span></td> : null}
                      {columnVisibility.result ? <td>
                        <span className={
                          record.result === 'SUCCESS'
                            ? 'status-pill status-active'
                            : record.result === 'WARNING'
                              ? 'status-pill status-warning'
                              : 'status-pill status-inactive'
                        }>
                          {resultLabels[record.result]} • {severityLabels[record.severity]}
                        </span>
                      </td> : null}
                      {columnVisibility.impact ? <td><span className="master-audit-cell-clamp" title={record.impactSummary || '-'}>{record.impactSummary || '-'}</span></td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleRecords.length === 0 ? (
              <div className="empty-state"><strong>Nenhum evento encontrado.</strong><p>Ajuste os filtros para ver os registros.</p></div>
            ) : null}
            {pagination}
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
