import type { Dispatch, SetStateAction } from 'react'
import { NormalizedTextInput } from './NormalizedTextField'
import { renderTechnicalSheetColumnHeader } from './tableColumnHeaders'
import type {
  ColumnSort,
  TechnicalSheetColumnKey,
  TechnicalSheetRecord,
} from '../types/domain'

type TechnicalSheetIngredientSearchMode = 'direct' | 'expanded'

type TechnicalSheetListPanelProps = {
  canDeleteTechnicalSheets: boolean
  columnFilters: Partial<Record<TechnicalSheetColumnKey, string[]>>
  columnOptions: Array<[TechnicalSheetColumnKey, string]>
  columnSort: ColumnSort<TechnicalSheetColumnKey> | null
  distinctColumnValues: Record<TechnicalSheetColumnKey, string[]>
  draggedColumn: TechnicalSheetColumnKey | null
  dropTargetColumn: TechnicalSheetColumnKey | null
  hasIngredientSearch: boolean
  hiddenColumns: Array<[TechnicalSheetColumnKey, string]>
  ingredientListId: string
  ingredientMatchPaths: Map<number, string>
  ingredientSearch: string
  ingredientSearchMode: TechnicalSheetIngredientSearchMode
  ingredientSearchSuggestions: string[]
  ingredientSearchSummary: string | null
  openColumnMenu: TechnicalSheetColumnKey | null
  orderedVisibleColumns: TechnicalSheetColumnKey[]
  sheetListId: string
  sheetSearch: string
  sheetSuggestions: string[]
  visibleSheets: TechnicalSheetRecord[]
  formatYieldLabel: (sheet: TechnicalSheetRecord) => string
  getTechnicalSheetColumnValue: (sheet: TechnicalSheetRecord, key: TechnicalSheetColumnKey) => string
  onCopyTechnicalSheet: (technicalSheetId: number) => void
  onDeleteTechnicalSheet: (technicalSheetId: number) => void
  onDisableTechnicalSheet: (technicalSheetId: number) => void
  onEditTechnicalSheet: (technicalSheetId: number) => void
  onEnableTechnicalSheet: (technicalSheetId: number) => void
  onExport: () => void
  onIngredientSearchChange: (value: string) => void
  onIngredientSearchModeChange: (mode: TechnicalSheetIngredientSearchMode) => void
  onNewTechnicalSheet: () => void
  onSheetSearchChange: (value: string) => void
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<TechnicalSheetColumnKey, string[]>>>>
  setColumnOrder: Dispatch<SetStateAction<TechnicalSheetColumnKey[]>>
  setColumnSort: Dispatch<SetStateAction<ColumnSort<TechnicalSheetColumnKey> | null>>
  setColumnVisibility: Dispatch<SetStateAction<Record<TechnicalSheetColumnKey, boolean>>>
  setDraggedColumn: Dispatch<SetStateAction<TechnicalSheetColumnKey | null>>
  setDropTargetColumn: Dispatch<SetStateAction<TechnicalSheetColumnKey | null>>
  setOpenColumnMenu: Dispatch<SetStateAction<TechnicalSheetColumnKey | null>>
}

export function TechnicalSheetListPanel({
  canDeleteTechnicalSheets,
  columnFilters,
  columnOptions,
  columnSort,
  distinctColumnValues,
  draggedColumn,
  dropTargetColumn,
  hasIngredientSearch,
  hiddenColumns,
  ingredientListId,
  ingredientMatchPaths,
  ingredientSearch,
  ingredientSearchMode,
  ingredientSearchSuggestions,
  ingredientSearchSummary,
  openColumnMenu,
  orderedVisibleColumns,
  sheetListId,
  sheetSearch,
  sheetSuggestions,
  visibleSheets,
  formatYieldLabel,
  getTechnicalSheetColumnValue,
  onCopyTechnicalSheet,
  onDeleteTechnicalSheet,
  onDisableTechnicalSheet,
  onEditTechnicalSheet,
  onEnableTechnicalSheet,
  onExport,
  onIngredientSearchChange,
  onIngredientSearchModeChange,
  onNewTechnicalSheet,
  onSheetSearchChange,
  setColumnFilters,
  setColumnOrder,
  setColumnSort,
  setColumnVisibility,
  setDraggedColumn,
  setDropTargetColumn,
  setOpenColumnMenu,
}: TechnicalSheetListPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Fichas Tecnicas</p>
          <h2>Fichas cadastradas</h2>
        </div>
        <div className="toolbar-actions">
          <button className="ghost-button" type="button" onClick={onExport}>
            Exportar
          </button>
          <button className="primary-button" type="button" onClick={onNewTechnicalSheet}>
            Nova ficha
          </button>
        </div>
      </div>

      <div className="list-toolbar technical-sheet-list-toolbar">
        <label className="field search-field">
          <span>Pesquisar ficha tecnica</span>
          <NormalizedTextInput
            list={sheetListId}
            value={sheetSearch}
            onChange={onSheetSearchChange}
            commitMode="debounce"
            placeholder="Busque por nome, ID interno ou ID da empresa"
          />
          <datalist id={sheetListId}>
            {sheetSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="field search-field">
          <span>Buscar por insumo</span>
          <NormalizedTextInput
            list={ingredientListId}
            value={ingredientSearch}
            onChange={onIngredientSearchChange}
            commitMode="debounce"
            placeholder="Busque um ingrediente ou pre-preparo usado"
          />
          <datalist id={ingredientListId}>
            {ingredientSearchSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="field technical-sheet-ingredient-search-mode">
          <span>Alcance do insumo</span>
          <select value={ingredientSearchMode} onChange={(event) => onIngredientSearchModeChange(event.target.value as TechnicalSheetIngredientSearchMode)}>
            <option value="expanded">Inclui subfichas</option>
            <option value="direct">Somente direto</option>
          </select>
        </label>
      </div>
      {ingredientSearchSummary ? (
        <div className="list-summary-row">
          <span>{ingredientSearchSummary}</span>
        </div>
      ) : null}

      {hiddenColumns.length > 0 ? (
        <div className="hidden-columns">
          <strong>Colunas ocultas</strong>
          <div className="hidden-columns-list">
            {hiddenColumns.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="ghost-button hidden-column-chip"
                onClick={() =>
                  setColumnVisibility((current) => ({
                    ...current,
                    [key]: true,
                  }))
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="product-table">
          <thead>
            <tr>
              {orderedVisibleColumns.map((key) =>
                renderTechnicalSheetColumnHeader(
                  key,
                  columnOptions.find(([optionKey]) => optionKey === key)?.[1] ?? key,
                  openColumnMenu,
                  setOpenColumnMenu,
                  columnFilters,
                  distinctColumnValues,
                  setColumnFilters,
                  setColumnVisibility,
                  columnSort,
                  setColumnSort,
                  {
                    draggable: key !== 'product',
                    isDragging: draggedColumn === key,
                    isDropTarget: dropTargetColumn === key,
                    onDragStart: () => {
                      if (key !== 'product') {
                        setDraggedColumn(key)
                        setDropTargetColumn(null)
                      }
                    },
                    onDragEnd: () => {
                      setDraggedColumn(null)
                      setDropTargetColumn(null)
                    },
                    onDragOver: (event) => {
                      if (key !== 'product' && draggedColumn && draggedColumn !== key) {
                        event.preventDefault()
                        setDropTargetColumn(key)
                      }
                    },
                    onDragLeave: () => {
                      if (dropTargetColumn === key) {
                        setDropTargetColumn(null)
                      }
                    },
                    onDrop: (event) => {
                      event.preventDefault()
                      if (!draggedColumn || draggedColumn === key || key === 'product') {
                        setDraggedColumn(null)
                        setDropTargetColumn(null)
                        return
                      }

                      setColumnOrder((current) => {
                        const next = current.filter((columnKey) => columnKey !== draggedColumn)
                        const targetIndex = next.indexOf(key)
                        if (targetIndex < 0) {
                          return current
                        }
                        next.splice(targetIndex, 0, draggedColumn)
                        return next
                      })
                      setDraggedColumn(null)
                      setDropTargetColumn(null)
                    },
                  },
                ),
              )}
              <th className="sticky-actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {visibleSheets.length > 0 ? (
              visibleSheets.map((sheet) => (
                <tr key={sheet.id}>
                  {orderedVisibleColumns.map((key) => {
                    if (key === 'product') {
                      const ingredientMatchPath = ingredientMatchPaths.get(sheet.id) ?? ''
                      return (
                        <td key={`${sheet.id}-${key}`} className="sticky-product-cell">
                          <strong>{sheet.name}</strong>
                          {hasIngredientSearch && ingredientMatchPath ? (
                            <span className="technical-sheet-ingredient-match">
                              Insumo: {ingredientMatchPath}
                            </span>
                          ) : null}
                        </td>
                      )
                    }
                    if (key === 'status') {
                      return (
                        <td key={`${sheet.id}-${key}`}>
                          <span className={sheet.isActive ? 'package-chip package-chip-success' : 'package-chip package-chip-warning'}>
                            {sheet.isActive ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                      )
                    }
                    if (key === 'yield') {
                      return <td key={`${sheet.id}-${key}`}>{formatYieldLabel(sheet)}</td>
                    }
                    if (key === 'ingredients') {
                      return <td key={`${sheet.id}-${key}`}>{String(sheet.ingredients.filter((ingredient) => ingredient.isActive).length)}</td>
                    }

                    return (
                      <td key={`${sheet.id}-${key}`}>
                        {getTechnicalSheetColumnValue(sheet, key) || '-'}
                      </td>
                    )
                  })}
                  <td className="sticky-actions-cell">
                    <div className="table-actions">
                      <button className="icon-button icon-edit" type="button" aria-label="Editar ficha tecnica" onClick={() => onEditTechnicalSheet(sheet.id)}>
                        <span aria-hidden="true">✎</span>
                      </button>
                      <button className="icon-button" type="button" aria-label="Copiar ficha tecnica" title="Copiar ficha tecnica" onClick={() => onCopyTechnicalSheet(sheet.id)}>
                        <span aria-hidden="true">⧉</span>
                      </button>
                      <button
                        className="icon-button icon-disable"
                        type="button"
                        aria-label={sheet.isActive ? 'Inativar ficha tecnica' : 'Ativar ficha tecnica'}
                        onClick={() => (sheet.isActive ? onDisableTechnicalSheet(sheet.id) : onEnableTechnicalSheet(sheet.id))}
                      >
                        <span aria-hidden="true">{sheet.isActive ? '◐' : '◑'}</span>
                      </button>
                      {canDeleteTechnicalSheets ? (
                        <button className="icon-button icon-delete" type="button" aria-label="Excluir ficha tecnica" onClick={() => onDeleteTechnicalSheet(sheet.id)}>
                          <span aria-hidden="true">🗑</span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={orderedVisibleColumns.length + 1}>
                  Nenhuma ficha tecnica encontrada com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
