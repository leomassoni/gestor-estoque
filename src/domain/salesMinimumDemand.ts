import {
  calculateExecutionTechnicalSheetFinalYield,
  calculateTechnicalSheetIngredientBaseQuantity,
  getStockCenterBaseQuantity,
  getTechnicalSheetBaseYield,
} from './technicalSheets'
import type { ProductRecord, TechnicalSheetRecord } from '../types/domain'

export type SalesMinimumSourceRow = {
  consumedAt: string
  matchedTechnicalSheetId: number | null
  quantity: number
  status: 'MATCHED' | 'UNMATCHED' | 'ERROR'
}

export type SalesMinimumDemandRow = {
  consumedAt: string
  ingredientProductId: string
  quantityConsumed: number
}

export function buildCurrentSalesMinimumDemandRows(
  rows: SalesMinimumSourceRow[],
  sheets: TechnicalSheetRecord[],
  products: ProductRecord[],
): SalesMinimumDemandRow[] {
  const sheetById = new Map(sheets.map((sheet) => [sheet.id, sheet]))
  return rows.flatMap((row) => {
    if (row.status !== 'MATCHED' || row.quantity <= 0) return []
    const sheet = row.matchedTechnicalSheetId === null ? null : sheetById.get(row.matchedTechnicalSheetId)
    if (!sheet || !['PRODUTO_INTERNO', 'EXECUCAO', 'VENDA'].includes(sheet.kind)) return []
    if (sheet.kind === 'PRODUTO_INTERNO') {
      return [{
        consumedAt: row.consumedAt,
        ingredientProductId: sheet.productId,
        quantityConsumed: getStockCenterBaseQuantity(sheet) * row.quantity,
      }]
    }

    const baseYield = getTechnicalSheetBaseYield(sheet)
    const executionYield = sheet.kind === 'EXECUCAO'
      ? calculateExecutionTechnicalSheetFinalYield(sheet, products)
      : 0
    const recipeBaseYield = executionYield > 0 ? executionYield : baseYield
    const multiplier = (baseYield * row.quantity) / recipeBaseYield
    return [...sheet.ingredients, ...sheet.garnishIngredients]
      .filter((ingredient) => ingredient.isActive && ingredient.productId.trim() !== '')
      .map((ingredient) => ({
        consumedAt: row.consumedAt,
        ingredientProductId: ingredient.productId,
        quantityConsumed: calculateTechnicalSheetIngredientBaseQuantity(ingredient) * multiplier,
      }))
  })
}
