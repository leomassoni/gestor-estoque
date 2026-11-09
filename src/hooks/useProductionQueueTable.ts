import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { ColumnSort, ProductionColumnKey, ProductionRequestRow } from '../types/domain'
import { tableColumnFilterNoneValue } from '../components/tableColumnHeaders'

export const productionColumnOptions: Array<[ProductionColumnKey, string]> = [
  ['sheet', 'Pre-preparo'],
  ['priority', 'Prioridade'],
  ['current', 'Estoque atual'],
  ['useMinimum', 'Minimo de uso'],
  ['realMinimum', 'Demanda operacional'],
  ['suggestion', 'Sugestao'],
  ['source', 'Origem'],
  ['requestedAt', 'Entrada'],
  ['status', 'Status'],
]

const initialVisibility = Object.fromEntries(productionColumnOptions.map(([key]) => [key, true])) as Record<ProductionColumnKey, boolean>
const pageSize = 20

export function getProductionColumnValue(row: ProductionRequestRow, key: ProductionColumnKey): string {
  switch (key) {
    case 'sheet': return row.sheetName
    case 'priority': return String(row.priority)
    case 'current': return row.currentQuantityLabel
    case 'useMinimum': return row.useMinimumLabel
    case 'realMinimum': return row.realMinimumLabel
    case 'suggestion': return row.suggestedProductionLabel
    case 'source': return row.sourceLabel
    case 'requestedAt': return row.requestedAtLabel
    case 'status': return row.statusLabel
  }
}

function numericValue(row: ProductionRequestRow, key: ProductionColumnKey): number | null {
  switch (key) {
    case 'priority': return row.priority
    case 'current': return row.currentQuantity
    case 'useMinimum': return row.useMinimumQuantity
    case 'realMinimum': return row.realMinimumQuantity
    case 'suggestion': return row.suggestedProductionQuantity
    default: return null
  }
}

function dateSortValue(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
  return match ? `${match[3]}-${match[2]}-${match[1]}T${match[4] ?? '00'}:${match[5] ?? '00'}` : value
}

export function filterAndSortProductionRows(
  rows: readonly ProductionRequestRow[],
  filters: Partial<Record<ProductionColumnKey, string[]>>,
  sort: ColumnSort<ProductionColumnKey> | null,
): ProductionRequestRow[] {
  const filtered = rows.filter(row => Object.entries(filters).every(([key, selected]) => {
    if (!selected?.length) return true
    return selected.includes(getProductionColumnValue(row, key as ProductionColumnKey))
  }))
  return [...filtered].sort((left, right) => {
    if (sort) {
      const numericLeft = numericValue(left, sort.key)
      const numericRight = numericValue(right, sort.key)
      const comparison = numericLeft !== null && numericRight !== null
        ? numericLeft - numericRight
        : (sort.key === 'requestedAt' ? dateSortValue(getProductionColumnValue(left, sort.key)) : getProductionColumnValue(left, sort.key))
          .localeCompare(sort.key === 'requestedAt' ? dateSortValue(getProductionColumnValue(right, sort.key)) : getProductionColumnValue(right, sort.key), 'pt-BR', { numeric: true })
      if (comparison !== 0) return sort.direction === 'asc' ? comparison : -comparison
    }
    return left.priority - right.priority || left.sheetName.localeCompare(right.sheetName, 'pt-BR')
  })
}

export function useProductionQueueTable(rows: readonly ProductionRequestRow[], centerId: string, search: string) {
  type Filters = Partial<Record<ProductionColumnKey, string[]>>
  type Sort = ColumnSort<ProductionColumnKey> | null
  type ScopedState = { centerId: string; filters: Filters; sort: Sort; openMenu: ProductionColumnKey | null }
  const defaultScope = (): ScopedState => ({ centerId, filters: {}, sort: null, openMenu: null })
  const [scopedState, setScopedState] = useState<ScopedState>(defaultScope)
  const [visibility, setVisibility] = useState<Record<ProductionColumnKey, boolean>>(initialVisibility)
  const context = `${centerId}\u0000${search}`
  const [pageState, setPageState] = useState({ context, page: 1 })
  const { filters, sort, openMenu } = scopedState.centerId === centerId ? scopedState : defaultScope()
  const page = pageState.context === context ? pageState.page : 1
  const setPage = (next: number) => setPageState({ context, page: next })
  const setFilters: Dispatch<SetStateAction<Filters>> = update => {
    setScopedState(current => {
      const previous = current.centerId === centerId ? current : defaultScope()
      return { ...previous, filters: typeof update === 'function' ? update(previous.filters) : update }
    })
    setPage(1)
  }
  const setSort: Dispatch<SetStateAction<Sort>> = update => {
    setScopedState(current => {
      const previous = current.centerId === centerId ? current : defaultScope()
      return { ...previous, sort: typeof update === 'function' ? update(previous.sort) : update }
    })
    setPage(1)
  }
  const setOpenMenu: Dispatch<SetStateAction<ProductionColumnKey | null>> = update => {
    setScopedState(current => {
      const previous = current.centerId === centerId ? current : defaultScope()
      return { ...previous, openMenu: typeof update === 'function' ? update(previous.openMenu) : update }
    })
  }

  const distinctValues = useMemo(() => Object.fromEntries(productionColumnOptions.map(([key]) => [key,
    Array.from(new Set(rows.map(row => getProductionColumnValue(row, key))))
      .sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true })),
  ])) as Record<ProductionColumnKey, string[]>, [rows])
  const visibleRows = useMemo(() => filterAndSortProductionRows(rows, filters, sort), [rows, filters, sort])
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paginatedRows = useMemo(() => visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, visibleRows])
  const prioritySummary = useMemo(() => Array.from(visibleRows.reduce((summary, row) => {
    summary.set(row.priority, (summary.get(row.priority) ?? 0) + 1)
    return summary
  }, new Map<number, number>())).sort((left, right) => left[0] - right[0]), [visibleRows])
  const hiddenColumns = productionColumnOptions.filter(([key]) => !visibility[key])

  return { filters, setFilters, sort, setSort, visibility, setVisibility, openMenu, setOpenMenu,
    distinctValues, visibleRows, paginatedRows, prioritySummary, hiddenColumns,
    pageCount, currentPage, setPage, pageSize, noneValue: tableColumnFilterNoneValue }
}
