export function planProductionRequisitionShortages<TSheet, TLine>(params: {
  sheets: TSheet[]
  availableByKey: Map<string, number>
  reservedByKey?: Map<string, number>
  priority: (sheet: TSheet) => number
  stockKey: (sheet: TSheet) => string
  directRequiredQuantity: (sheet: TSheet) => number
  expandShortage: (sheet: TSheet, shortage: number, availableByKey: Map<string, number>) => TLine[]
}): TLine[] {
  const availableByKey = new Map(params.availableByKey)
  params.reservedByKey?.forEach((quantity, key) => {
    availableByKey.set(key, Math.max((availableByKey.get(key) ?? 0) - quantity, 0))
  })
  return [...params.sheets]
    .sort((left, right) => params.priority(right) - params.priority(left))
    .flatMap((sheet) => {
      const required = Math.max(params.directRequiredQuantity(sheet), 0)
      if (required <= 0) return []
      const key = params.stockKey(sheet)
      const available = Math.max(availableByKey.get(key) ?? 0, 0)
      availableByKey.set(key, Math.max(available - required, 0))
      const shortage = Math.max(required - available, 0)
      return shortage > 0 ? params.expandShortage(sheet, shortage, availableByKey) : []
    })
}
