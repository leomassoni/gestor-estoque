import type {
  TechnicalSheetDescriptionNode,
  TechnicalSheetGeneratedDescription,
  TechnicalSheetIngredient,
  TechnicalSheetRecord,
} from '../types/domain'
import { normalizeRegistrationText } from '../utils/core'

function mergeTechnicalSheetDescriptionNodes(nodes: TechnicalSheetDescriptionNode[]) {
  const mergedNodes = new Map<string, TechnicalSheetDescriptionNode>()

  nodes.forEach((node) => {
    const normalizedLabel = normalizeRegistrationText(node.label)
    if (!normalizedLabel) {
      return
    }

    const key = normalizedLabel.toLocaleLowerCase('pt-BR')
    const existingNode = mergedNodes.get(key)

    if (!existingNode) {
      mergedNodes.set(key, {
        label: normalizedLabel,
        preparationId: node.preparationId,
        children: mergeTechnicalSheetDescriptionNodes(node.children),
      })
      return
    }

    if (existingNode.preparationId === null && node.preparationId !== null) {
      existingNode.preparationId = node.preparationId
    }
    existingNode.children = mergeTechnicalSheetDescriptionNodes([...existingNode.children, ...node.children])
  })

  return Array.from(mergedNodes.values())
}

function formatNaturalLanguageList(values: string[]) {
  if (values.length === 0) {
    return ''
  }

  const listFormatConstructor = (globalThis as { Intl?: { ListFormat?: new (
    locales?: string | string[],
    options?: { style?: 'long' | 'short' | 'narrow'; type?: 'conjunction' | 'disjunction' | 'unit' },
  ) => { format: (items: string[]) => string } } }).Intl?.ListFormat

  if (typeof listFormatConstructor === 'function') {
    return new listFormatConstructor('pt-BR', { style: 'long', type: 'conjunction' }).format(values)
  }

  if (values.length === 1) {
    return values[0]
  }

  if (values.length === 2) {
    return `${values[0]} e ${values[1]}`
  }

  return `${values.slice(0, -1).join(', ')} e ${values[values.length - 1]}`
}

function buildTechnicalSheetDescriptionNarrative(
  nodes: TechnicalSheetDescriptionNode[],
  describedPreparationIds: Set<number>,
  depth = 0,
): string[] {
  return nodes.flatMap((node) => {
    if (node.children.length === 0) {
      return []
    }

    if (node.preparationId !== null) {
      if (describedPreparationIds.has(node.preparationId)) {
        return []
      }
      describedPreparationIds.add(node.preparationId)
    }

    const childLabels = node.children.map((child) => child.label)
    const sentence =
      depth === 0
        ? `- ${node.label} leva ${formatNaturalLanguageList(childLabels)}.`
        : `- ${node.label} combina ${formatNaturalLanguageList(childLabels)}.`

    return [
      sentence,
      ...node.children.flatMap((child) => buildTechnicalSheetDescriptionNarrative([child], describedPreparationIds, depth + 1)),
    ]
  })
}

function buildTechnicalSheetDescriptionNode(
  ingredient: TechnicalSheetIngredient,
  technicalSheets: TechnicalSheetRecord[],
  visitedPreparationIds: Set<number>,
): TechnicalSheetDescriptionNode | null {
  const normalizedLabel = normalizeRegistrationText(ingredient.productLabel)
  if (!normalizedLabel) {
    return null
  }

  const nestedSheet =
    technicalSheets.find(
      (candidate) => candidate.productId === ingredient.productId && candidate.kind === 'PREPARO' && candidate.isActive,
    ) ?? null

  if (!nestedSheet || visitedPreparationIds.has(nestedSheet.id)) {
    return {
      label: normalizedLabel,
      preparationId: null,
      children: [],
    }
  }

  const shouldDescribeNestedComposition = nestedSheet.productionCenters.length > 0

  if (!shouldDescribeNestedComposition) {
    return {
      label: normalizedLabel,
      preparationId: nestedSheet.id,
      children: [],
    }
  }

  const nextVisitedPreparationIds = new Set(visitedPreparationIds)
  nextVisitedPreparationIds.add(nestedSheet.id)

  const nestedChildren = mergeTechnicalSheetDescriptionNodes(
    nestedSheet.ingredients
      .filter((nestedIngredient) => nestedIngredient.isActive)
      .map((nestedIngredient) =>
        buildTechnicalSheetDescriptionNode(nestedIngredient, technicalSheets, nextVisitedPreparationIds),
      )
      .filter((value): value is TechnicalSheetDescriptionNode => Boolean(value)),
  )

  return {
    label: normalizedLabel,
    preparationId: nestedSheet.id,
    children: nestedChildren,
  }
}

export function buildTechnicalSheetGeneratedDescription(
  sheet: TechnicalSheetRecord,
  technicalSheets: TechnicalSheetRecord[],
): TechnicalSheetGeneratedDescription {
  const mainIngredients = mergeTechnicalSheetDescriptionNodes(
    sheet.ingredients
      .filter((ingredient) => ingredient.isActive)
      .map((ingredient) => buildTechnicalSheetDescriptionNode(ingredient, technicalSheets, new Set<number>()))
      .filter((value): value is TechnicalSheetDescriptionNode => Boolean(value)),
  )

  const finalization = mergeTechnicalSheetDescriptionNodes(
    sheet.garnishIngredients
      .filter((ingredient) => ingredient.isActive)
      .map((ingredient) => buildTechnicalSheetDescriptionNode(ingredient, technicalSheets, new Set<number>()))
      .filter((value): value is TechnicalSheetDescriptionNode => Boolean(value)),
  )

  const mainLabels = mainIngredients.map((node) => node.label)
  const finalizationLabels = finalization.map((node) => node.label)
  const describedPreparationIds = new Set<number>()
  const summaryParts: string[] = []
  if (mainLabels.length > 0) {
    summaryParts.push(`Leva ${formatNaturalLanguageList(mainLabels)}.`)
  }
  const mainNarrative = buildTechnicalSheetDescriptionNarrative(mainIngredients, describedPreparationIds)
  if (mainNarrative.length > 0) {
    summaryParts.push(mainNarrative.join('\n\n'))
  }
  if (finalizationLabels.length > 0) {
    summaryParts.push(`Finalizacao com ${formatNaturalLanguageList(finalizationLabels)}.`)
  }
  const finalizationNarrative = buildTechnicalSheetDescriptionNarrative(finalization, describedPreparationIds)
  if (finalizationNarrative.length > 0) {
    summaryParts.push(finalizationNarrative.join('\n\n'))
  }

  return {
    summary:
      summaryParts.length > 0
        ? summaryParts.join('\n\n')
        : 'A descricao automatica sera exibida quando a composicao da ficha estiver preenchida com insumos ativos.',
    mainIngredients,
    finalization,
    hasContent: mainIngredients.length > 0 || finalization.length > 0,
  }
}

