import type {
  ControlUnit,
  PackageForm,
  ProductRecord,
  TechnicalSheetKind,
  TechnicalSheetRecord,
} from '../types/domain'
import { formatControlUnitShort, parseDecimal } from '../utils/core'

export function isLegacyImportedProduct(product: ProductRecord | null) {
  return product?.id.startsWith('IMP-') ?? false
}

export function isCommercialTechnicalSheetKind(kind: TechnicalSheetKind) {
  return kind === 'VENDA' || kind === 'EXECUCAO'
}

export function isExecutionTechnicalSheetKind(kind: TechnicalSheetKind) {
  return kind === 'EXECUCAO'
}

export function getDefaultTechnicalSheetOutputUnit(kind: TechnicalSheetKind): ControlUnit {
  if (kind === 'EXECUCAO') {
    return 'UNIT'
  }

  if (kind === 'VENDA') {
    return 'UNIT'
  }

  return 'GRAM'
}

export function isCommercialTechnicalSheetProduct(product: ProductRecord, technicalSheets: TechnicalSheetRecord[]) {
  if (typeof product.technicalSheetId !== 'number') {
    return false
  }

  const linkedTechnicalSheet = technicalSheets.find((sheet) => sheet.id === product.technicalSheetId) ?? null
  return linkedTechnicalSheet ? isCommercialTechnicalSheetKind(linkedTechnicalSheet.kind) : false
}

export function isPrepTechnicalSheetProduct(product: ProductRecord, technicalSheets: TechnicalSheetRecord[]) {
  if (typeof product.technicalSheetId !== 'number') {
    return false
  }

  const linkedTechnicalSheet = technicalSheets.find((sheet) => sheet.id === product.technicalSheetId) ?? null
  return linkedTechnicalSheet?.kind === 'PREPARO'
}

export function getProductDisplayUnitLabel(product: ProductRecord, technicalSheets: TechnicalSheetRecord[]) {
  if (isCommercialTechnicalSheetProduct(product, technicalSheets)) {
    return 'UN'
  }

  return formatControlUnitShort(product.controlUnit)
}

export function syncTechnicalSheetIngredientReferences(
  sheets: TechnicalSheetRecord[],
  previousProductId: string,
  nextProductId: string,
  nextProductLabel: string,
) {
  return sheets.map((sheet) => ({
    ...sheet,
    ingredients: sheet.ingredients.map((ingredient) =>
      ingredient.productId === previousProductId
        ? { ...ingredient, productId: nextProductId, productLabel: nextProductLabel }
        : ingredient,
    ),
    garnishIngredients: sheet.garnishIngredients.map((ingredient) =>
      ingredient.productId === previousProductId
        ? { ...ingredient, productId: nextProductId, productLabel: nextProductLabel }
        : ingredient,
    ),
  }))
}

export function calculatePackagingWeight(
  packageForm: PackageForm,
  controlUnit: ControlUnit,
  densityFactor: number,
) {
  const packageQuantity = calculateNormalizedPackageQuantity(packageForm, controlUnit)
  const grossWeight = resolvePackageGrossWeight(packageForm, controlUnit)

  if (!packageQuantity || packageQuantity <= 0 || !grossWeight || grossWeight <= 0) {
    return null
  }

  let contentWeight = packageQuantity

  if (controlUnit === 'MILLILITER') {
    contentWeight = packageQuantity * densityFactor
  }

  return Math.max(grossWeight - contentWeight, 0)
}

export function resolvePackageGrossWeight(packageForm: PackageForm, controlUnit: ControlUnit) {
  const informedGrossWeight = parseDecimal(packageForm.grossWeightGrams)
  if (informedGrossWeight && informedGrossWeight > 0) {
    return informedGrossWeight
  }

  const normalizedQuantity = calculateNormalizedPackageQuantity(packageForm, controlUnit)
  return normalizedQuantity > 0 ? normalizedQuantity : null
}

export function resolveTechnicalSheetPackageGrossWeight(
  packageForm: PackageForm,
  controlUnit: ControlUnit,
  densityFactor: number,
) {
  const normalizedQuantity = calculateNormalizedPackageQuantity(packageForm, controlUnit)
  const packagingWeight = parseDecimal(packageForm.packagingWeightGrams) ?? 0

  if (normalizedQuantity <= 0) {
    return null
  }

  const contentWeight =
    controlUnit === 'MILLILITER' ? normalizedQuantity * densityFactor : normalizedQuantity

  return contentWeight + Math.max(packagingWeight, 0)
}

export function resolveSectorDeletion(
  sectors: string[],
  sectorToDelete: string,
  resolution: 'replace' | 'inactivate',
  replacementSector: string,
) {
  const remaining = sectors.filter((sector) => sector !== sectorToDelete)

  if (remaining.length > 0) {
    return remaining
  }

  if (resolution === 'replace' && replacementSector) {
    return [replacementSector]
  }

  return []
}

export function calculateProductUnitCost(
  product: ProductRecord,
  technicalSheets: TechnicalSheetRecord[] = [],
  products: ProductRecord[] = [],
) {
  if (typeof product.technicalSheetId === 'number') {
    const linkedTechnicalSheet = technicalSheets.find((sheet) => sheet.id === product.technicalSheetId) ?? null
    if (linkedTechnicalSheet) {
      const totalCost = calculateTechnicalSheetCost(linkedTechnicalSheet, technicalSheets, products)
      const totalYield = parseDecimal(linkedTechnicalSheet.outputQuantity) ?? 0
      return totalYield > 0 ? totalCost / totalYield : totalCost
    }
  }

  return calculatePackageOnlyProductUnitCost(product)
}

export function calculatePackageOnlyProductUnitCost(product: ProductRecord) {
  const activePackages = product.packages.filter((item) => item.isActive)
  if (activePackages.length === 0) {
    return 0
  }

  const weightedPackages = activePackages
    .map((item) => {
      const quantity = calculateNormalizedPackageQuantity(item, product.controlUnit)
      const price = parseDecimal(item.purchasePrice) ?? 0
      const unitCost = quantity > 0 ? price / quantity : 0
      return {
        unitCost,
        weight: quantity,
      }
    })
    .filter((item) => item.unitCost > 0 && item.weight > 0)

  if (weightedPackages.length === 0) {
    const simpleAverage =
      activePackages
        .map((item) => {
          const quantity = calculateNormalizedPackageQuantity(item, product.controlUnit)
          const price = parseDecimal(item.purchasePrice) ?? 0
          return quantity > 0 ? price / quantity : 0
        })
        .filter((item) => item > 0)
    return simpleAverage.length > 0
      ? simpleAverage.reduce((sum, item) => sum + item, 0) / simpleAverage.length
      : 0
  }

  const totalWeight = weightedPackages.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) {
    return 0
  }

  return weightedPackages.reduce((sum, item) => sum + item.unitCost * item.weight, 0) / totalWeight
}

export function getProductCostStatus(
  product: ProductRecord,
  technicalSheets: TechnicalSheetRecord[] = [],
  products: ProductRecord[] = [],
) {
  if (typeof product.technicalSheetId === 'number') {
    const linkedTechnicalSheet = technicalSheets.find((sheet) => sheet.id === product.technicalSheetId) ?? null
    if (linkedTechnicalSheet) {
      return calculateProductUnitCost(product, technicalSheets, products) > 0 ? 'OK' : 'Sem custo'
    }
  }

  const activePackages = product.packages.filter((item) => item.isActive)
  if (activePackages.length === 0) {
    return 'Sem embalagem'
  }

  const pricedPackages = activePackages.filter((item) => {
    const quantity = calculateNormalizedPackageQuantity(item, product.controlUnit)
    const price = parseDecimal(item.purchasePrice) ?? 0
    return quantity > 0 && price > 0
  })

  if (pricedPackages.length === 0) {
    return 'Sem custo'
  }

  return pricedPackages.length === activePackages.length ? 'OK' : 'Custo parcial'
}

export function calculateTechnicalSheetCost(
  sheet: TechnicalSheetRecord,
  technicalSheets: TechnicalSheetRecord[],
  products: ProductRecord[] = [],
  visited = new Set<number>(),
): number {
  if (visited.has(sheet.id)) {
    return 0
  }

  const nextVisited = new Set(visited)
  nextVisited.add(sheet.id)

  return [...sheet.ingredients, ...sheet.garnishIngredients]
    .filter((ingredient) => ingredient.isActive)
    .reduce((sum, ingredient) => {
      const quantity = parseDecimal(ingredient.quantity) ?? 0
      const linkedTechnicalSheet =
        technicalSheets.find((item) => item.productId === ingredient.productId) ?? null

      if (linkedTechnicalSheet) {
      const linkedCost: number = calculateTechnicalSheetCost(linkedTechnicalSheet, technicalSheets, products, nextVisited)
      const linkedYield = calculateTechnicalSheetEffectiveYield(linkedTechnicalSheet)
      const linkedUnitCost: number = linkedYield > 0 ? linkedCost / linkedYield : linkedCost
      return sum + linkedUnitCost * quantity
      }

      const linkedProduct = products.find((item) => item.id === ingredient.productId) ?? null
      const linkedProductUnitCost = linkedProduct ? calculatePackageOnlyProductUnitCost(linkedProduct) : 0
      return sum + linkedProductUnitCost * quantity
    }, 0)
}

export function calculateTechnicalSheetAlcoholPercentage(
  sheet: TechnicalSheetRecord,
  technicalSheets: TechnicalSheetRecord[],
  products: ProductRecord[] = [],
  visited = new Set<number>(),
): number {
  if (visited.has(sheet.id)) {
    return 0
  }

  const totalMixtureVolume = calculateTechnicalSheetAlcoholReferenceYield(sheet)
  if (totalMixtureVolume <= 0) {
    return 0
  }

  const nextVisited = new Set(visited)
  nextVisited.add(sheet.id)
  const referenceYield = calculateTechnicalSheetIngredientYieldSum(sheet, {
    includeGarnishes: sheet.kind !== 'EXECUCAO',
  })
  const finalYieldScaleFactor = referenceYield > 0 ? totalMixtureVolume / referenceYield : 1

  const alcoholSourceIngredients =
    sheet.kind === 'EXECUCAO' ? sheet.ingredients : [...sheet.ingredients, ...sheet.garnishIngredients]

  const totalAlcoholLoad = alcoholSourceIngredients
    .filter((ingredient) => ingredient.isActive)
    .reduce((sum, ingredient) => {
      const yieldQuantity = parseDecimal(ingredient.yieldQuantity) ?? 0
      if (yieldQuantity <= 0) {
        return sum
      }

      const linkedTechnicalSheet = technicalSheets.find((item) => item.productId === ingredient.productId) ?? null
      if (linkedTechnicalSheet) {
        return (
          sum +
          yieldQuantity *
            finalYieldScaleFactor *
            (calculateTechnicalSheetAlcoholPercentage(linkedTechnicalSheet, technicalSheets, products, nextVisited) / 100)
        )
      }

      const linkedProduct = products.find((item) => item.id === ingredient.productId) ?? null
      const alcoholPercentage = parseDecimal(linkedProduct?.alcoholPercentage ?? '') ?? 0
      const pureAlcoholVolume = yieldQuantity * finalYieldScaleFactor * (alcoholPercentage / 100)
      return sum + pureAlcoholVolume
    }, 0)

  return (totalAlcoholLoad / totalMixtureVolume) * 100
}

export function calculateTechnicalSheetIngredientYieldSum(
  sheet: TechnicalSheetRecord,
  options: {
    includeGarnishes?: boolean
  } = {},
) {
  const { includeGarnishes = true } = options
  const sourceIngredients = includeGarnishes ? [...sheet.ingredients, ...sheet.garnishIngredients] : sheet.ingredients
  const ingredientYield = sourceIngredients
    .filter((ingredient) => ingredient.isActive)
    .reduce((sum, ingredient) => sum + (parseDecimal(ingredient.yieldQuantity) ?? 0), 0)

  return ingredientYield
}

export function calculateTechnicalSheetEffectiveYield(sheet: TechnicalSheetRecord) {
  const includeGarnishesInYield = sheet.kind !== 'EXECUCAO'

  if (sheet.kind === 'EXECUCAO') {
    const savedYield = parseDecimal(sheet.outputQuantity) ?? 0
    if (savedYield > 0) {
      return savedYield
    }

    const ingredientYield = calculateTechnicalSheetIngredientYieldSum(sheet, {
      includeGarnishes: includeGarnishesInYield,
    })

    return ingredientYield
  }

  if (sheet.kind === 'PREPARO') {
    const savedYield = parseDecimal(sheet.outputQuantity) ?? 0
    if (savedYield > 0) {
      return savedYield
    }
  }

  if (sheet.kind === 'VENDA') {
    if (sheet.outputUnit === 'COMBO') {
      const comboUnits = (includeGarnishesInYield ? [...sheet.ingredients, ...sheet.garnishIngredients] : sheet.ingredients)
        .filter((ingredient) => ingredient.isActive)
        .reduce((sum, ingredient) => sum + (parseDecimal(ingredient.yieldQuantity) ?? parseDecimal(ingredient.quantity) ?? 0), 0)

      if (comboUnits > 0) {
        return comboUnits
      }
    }

    const ingredientYield = calculateTechnicalSheetIngredientYieldSum(sheet, {
      includeGarnishes: includeGarnishesInYield,
    })
    if (ingredientYield > 0) {
      return ingredientYield
    }

    return parseDecimal(sheet.outputQuantity) ?? 0
  }

  const ingredientYield = calculateTechnicalSheetIngredientYieldSum(sheet, {
    includeGarnishes: includeGarnishesInYield,
  })

  if (ingredientYield > 0) {
    return ingredientYield
  }

  return parseDecimal(sheet.outputQuantity) ?? 0
}

export function getTechnicalSheetBaseYield(sheet: TechnicalSheetRecord) {
  const parsed = calculateTechnicalSheetEffectiveYield(sheet)
  return parsed > 0 ? parsed : 1
}

export function getStockCenterBaseQuantity(sheet: TechnicalSheetRecord) {
  if (sheet.outputUnit === 'UNIT') {
    return 1
  }

  const portionBase = parseDecimal(sheet.portionSize) ?? 0
  return portionBase > 0 ? portionBase : getTechnicalSheetBaseYield(sheet)
}

export function getInventoryClosedItemReferenceQuantity(sheet: TechnicalSheetRecord, hasRecipientOptions: boolean) {
  if (hasRecipientOptions) {
    return getStockCenterBaseQuantity(sheet)
  }

  const portionBase = parseDecimal(sheet.portionSize) ?? 0
  return portionBase > 0 ? portionBase : getStockCenterBaseQuantity(sheet)
}

export function getInventoryClosedItemReferenceUnit(sheet: TechnicalSheetRecord, hasRecipientOptions: boolean): ControlUnit {
  if (hasRecipientOptions) {
    return sheet.kind === 'VENDA' ? 'UNIT' : sheet.outputUnit
  }

  return sheet.kind === 'VENDA' ? 'UNIT' : sheet.outputUnit
}

export function calculateTechnicalSheetAlcoholReferenceYield(sheet: TechnicalSheetRecord) {
  return calculateTechnicalSheetEffectiveYield(sheet)
}

export function inferTechnicalSheetMixtureControlUnit(
  sheet: TechnicalSheetRecord,
  technicalSheets: TechnicalSheetRecord[],
  products: ProductRecord[],
): ControlUnit | null {
  const units = [...sheet.ingredients, ...sheet.garnishIngredients]
    .filter((ingredient) => ingredient.isActive && ingredient.productId.trim() !== '')
    .map((ingredient) => {
      const linkedProduct = products.find((item) => item.id === ingredient.productId) ?? null
      if (linkedProduct) {
        return linkedProduct.controlUnit
      }

      const linkedTechnicalSheet =
        technicalSheets.find((item) => item.productId === ingredient.productId) ?? null
      return linkedTechnicalSheet?.outputUnit ?? null
    })
    .filter((unit): unit is ControlUnit => unit === 'MILLILITER' || unit === 'GRAM')

  const uniqueUnits = Array.from(new Set(units))
  if (uniqueUnits.length === 1) {
    return uniqueUnits[0]
  }

  return null
}

export function getTechnicalSheetYieldUnitLabel(
  sheet: TechnicalSheetRecord,
  technicalSheets: TechnicalSheetRecord[],
  products: ProductRecord[],
) {
  if (sheet.kind === 'VENDA') {
    if (sheet.outputUnit === 'COMBO') {
      return 'UN'
    }

    if (sheet.outputUnit === 'UNIT') {
      const inferredUnit = inferTechnicalSheetMixtureControlUnit(sheet, technicalSheets, products)
      if (inferredUnit) {
        return formatControlUnitShort(inferredUnit)
      }

      return 'ML/G'
    }
  }

  if (sheet.kind === 'EXECUCAO') {
    const inferredUnit = inferTechnicalSheetMixtureControlUnit(sheet, technicalSheets, products)
    if (inferredUnit) {
      return formatControlUnitShort(inferredUnit)
    }

    return 'ML/G'
  }

  return formatControlUnitShort(sheet.outputUnit)
}

export function calculateNormalizedPackageQuantity(packageForm: PackageForm, controlUnit: ControlUnit) {
  const quantity = parseDecimal(packageForm.packageQuantity) ?? 0
  if (quantity <= 0) {
    return 0
  }

  if (controlUnit === 'UNIT' || controlUnit === 'COMBO') {
    return quantity
  }

  if (controlUnit === 'MILLILITER') {
    return packageForm.packageUnit === 'LITER' ? quantity * 1000 : quantity
  }

  return packageForm.packageUnit === 'KILOGRAM' ? quantity * 1000 : quantity
}
