export type SortDirection = 'asc' | 'desc'

export type GenericColumnSort<K extends string> = {
  key: K
  direction: SortDirection
}

export function normalizeFreeText(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .,;:!?()/%"'_\n-]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trimStart()

  return normalized.toUpperCase()
}

export function normalizeRegistrationText(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ./_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trimStart()

  return normalized.toUpperCase()
}

export function normalizeSuggestionSet(values: string[]) {
  return Array.from(
    new Map(
      values
        .map((value) => normalizeRegistrationText(value))
        .filter(Boolean)
        .map((value) => [value, value] as const),
    ).values(),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function compareSortValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: SortDirection,
) {
  if (left == null && right == null) {
    return 0
  }
  if (left == null) {
    return 1
  }
  if (right == null) {
    return -1
  }

  let comparison = 0
  if (typeof left === 'number' && typeof right === 'number' && Number.isFinite(left) && Number.isFinite(right)) {
    comparison = left - right
  } else {
    comparison = String(left).localeCompare(String(right), 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    })
  }

  return direction === 'asc' ? comparison : comparison * -1
}

export function sortRecordsByColumn<T, K extends string>(
  records: T[],
  columnSort: GenericColumnSort<K> | null,
  getSortValue: (record: T, key: K) => string | number | null | undefined,
) {
  if (!columnSort) {
    return records
  }

  return [...records].sort((left, right) =>
    compareSortValues(
      getSortValue(left, columnSort.key),
      getSortValue(right, columnSort.key),
      columnSort.direction,
    ),
  )
}

export function formatDateForDisplay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

export function formatTimeForDisplay(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getMinutesBetweenTimestamps(startedAt: string, closedAt: string) {
  if (!startedAt || !closedAt) {
    return 0
  }

  const start = Date.parse(startedAt)
  const end = Date.parse(closedAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }

  return Math.round((end - start) / 60000)
}

export function formatDurationMinutesLabel(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return '0 MIN'
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) {
    return `${minutes} MIN`
  }

  if (minutes <= 0) {
    return `${hours} H`
  }

  return `${hours} H ${minutes} MIN`
}

export function formatInventoryRecordCode(id: number) {
  return `INV-${String(id).padStart(4, '0')}`
}

export function formatInventoryCountSessionCode(id: number) {
  return `CON-${String(id).padStart(4, '0')}`
}

export function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) {
    return digits
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)

  if (digits.length <= 2) {
    return digits
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`
  }
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export type CoreControlUnit = 'MILLILITER' | 'GRAM' | 'UNIT' | 'COMBO'
export type CorePackageUnit = 'LITER' | 'MILLILITER' | 'KILOGRAM' | 'GRAM' | 'UNIT'

export function getTodayDateInputValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset()
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCurrencyLabel(value: number) {
  return `R$ ${formatMoney(value)}`
}

export function formatControlUnitShort(unit: CoreControlUnit) {
  if (unit === 'MILLILITER') return 'ML'
  if (unit === 'GRAM') return 'G'
  if (unit === 'UNIT') return 'UN'
  return 'COMBO'
}

export function parseDecimal(value: string) {
  const compact = value.replace(/\s/g, '')
  let normalized = compact

  if (compact.includes(',') && compact.includes('.')) {
    normalized = compact.replace(/\./g, '').replace(',', '.')
  } else if (compact.includes(',')) {
    normalized = compact.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
    normalized = compact.replace(/\./g, '')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const maxPersistedIntId = 2147483647

export function isSafePersistedIntId(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= maxPersistedIntId
}

export function getNextPersistedIntId(values: Array<number | null | undefined>) {
  const currentMax = values.reduce<number>(
    (highest, value) => (isSafePersistedIntId(value) && value > highest ? value : highest),
    0,
  )
  return currentMax + 1
}

export function formatDecimal(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function formatEditableDecimal(value: number) {
  return value.toLocaleString('pt-BR', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })
}

export function formatUnit(unit: CorePackageUnit) {
  switch (unit) {
    case 'LITER':
      return 'L'
    case 'MILLILITER':
      return 'ml'
    case 'KILOGRAM':
      return 'kg'
    case 'GRAM':
      return 'g'
    case 'UNIT':
      return 'un'
    default:
      return unit
  }
}

export function buildTechnicalSheetAutocompleteLabel(sheet: { name: string; productId: string }) {
  return sheet.productId ? `${sheet.name} · ${sheet.productId}` : sheet.name
}
