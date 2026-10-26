import type { TechnicalSheetRecord } from '../types/domain'
import { normalizeRegistrationText } from '../utils/core'

type IdentifierSheet = Pick<TechnicalSheetRecord,
  'id' | 'productId' | 'companyId' | 'ownerCompanyId' | 'companyProductId' |
  'companyProductIdsByCompanyId' | 'companyProductIdAliasesByCompanyId'>

type MatchKind = 'COMPANY' | 'INTERNAL_PRODUCT' | 'INTERNAL_RECORD'

export type SalesImportIdentifierMatch<T> = {
  sheet: T | null
  ambiguous: boolean
  matchedBy: MatchKind | null
}

// Callers supply the sheets already filtered for visibility and the current flow.
export function resolveSalesImportIdentifier<T extends IdentifierSheet>(
  sheets: readonly T[],
  companyId: number | null | undefined,
  value: string,
): SalesImportIdentifierMatch<T> {
  const identifier = normalizeRegistrationText(value).trim()
  const empty: SalesImportIdentifierMatch<T> = { sheet: null, ambiguous: false, matchedBy: null }
  if (!identifier) return empty

  function resolve(matches: T[], matchedBy: MatchKind): SalesImportIdentifierMatch<T> {
    const distinct = [...new Map(matches.map((sheet) => [sheet.id, sheet])).values()]
    return { sheet: distinct.length === 1 ? distinct[0] : null, ambiguous: distinct.length > 1, matchedBy }
  }

  const companyMatches = companyId === null || companyId === undefined ? [] : sheets.filter((sheet) => {
    const primary = sheet.companyProductIdsByCompanyId?.[String(companyId)] ||
      (companyId === (sheet.ownerCompanyId ?? sheet.companyId) ? sheet.companyProductId : '')
    const aliases = sheet.companyProductIdAliasesByCompanyId?.[String(companyId)] ?? []
    return [primary, ...aliases].some((code) => normalizeRegistrationText(code ?? '').trim() === identifier)
  })
  if (companyMatches.length) return resolve(companyMatches, 'COMPANY')

  const productMatches = sheets.filter((sheet) => normalizeRegistrationText(sheet.productId).trim() === identifier)
  if (productMatches.length) return resolve(productMatches, 'INTERNAL_PRODUCT')

  const recordMatches = sheets.filter((sheet) => String(sheet.id) === identifier)
  return recordMatches.length ? resolve(recordMatches, 'INTERNAL_RECORD') : empty
}
