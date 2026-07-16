import type {
  PreparationModeMetricPart,
  RecipePanelIngredientMetrics,
} from '../types/domain'
import { formatDecimal } from './core'

export function isPreparationModeBoundary(character: string | undefined) {
  return !character || !/[A-Z0-9]/.test(character)
}

export function normalizePreparationModeIngredientNames(ingredientNames: string[]) {
  return Array.from(new Set(ingredientNames.map((name) => name.trim()).filter(Boolean))).sort(
    (left, right) => right.length - left.length || left.localeCompare(right),
  )
}

export function normalizePreparationModeEditingValue(value: string) {
  return value
}

export function normalizePreparationModeComparableValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
}

export function getPreparationModeNameMatchIndex(name: string, query: string) {
  if (!query) {
    return -1
  }

  if (name.startsWith(query)) {
    return 0
  }

  const paddedName = ` ${name}`
  const paddedQuery = ` ${query}`
  const matchIndex = paddedName.indexOf(paddedQuery)
  return matchIndex === -1 ? -1 : matchIndex - 1
}

export function getPreparationModeAutocomplete(
  value: string,
  caretIndex: number,
  ingredientNames: string[],
) {
  const textBeforeCaret = value.slice(0, caretIndex)
  const segmentStart = Math.max(
    textBeforeCaret.lastIndexOf('\n'),
    textBeforeCaret.lastIndexOf('.'),
    textBeforeCaret.lastIndexOf(','),
    textBeforeCaret.lastIndexOf(';'),
    textBeforeCaret.lastIndexOf(':'),
    textBeforeCaret.lastIndexOf('!'),
    textBeforeCaret.lastIndexOf('?'),
    textBeforeCaret.lastIndexOf('('),
    textBeforeCaret.lastIndexOf(')'),
  ) + 1
  const segment = textBeforeCaret.slice(segmentStart)
  const trimmedSegment = segment.trimStart()
  const leadingWhitespaceLength = segment.length - trimmedSegment.length
  const trimmedSegmentStart = segmentStart + leadingWhitespaceLength
  const queryCandidates = Array.from(
    new Set(
      trimmedSegment
        .split(/\s+/)
        .map((_, index, words) => words.slice(index).join(' ').trim())
        .filter(Boolean),
    ),
  )

  if (queryCandidates.length === 0) {
    return null
  }

  for (const query of queryCandidates) {
    const normalizedQuery = normalizePreparationModeComparableValue(query)
    if (!normalizedQuery) {
      continue
    }

    const suggestions = ingredientNames
      .map((name) => {
        const normalizedName = normalizePreparationModeComparableValue(name)
        return {
          name,
          normalizedName,
          matchIndex: getPreparationModeNameMatchIndex(normalizedName, normalizedQuery),
        }
      })
      .filter(({ normalizedName, matchIndex }) => matchIndex !== -1 && normalizedName !== normalizedQuery)
      .sort(
        (left, right) =>
          left.matchIndex - right.matchIndex ||
          left.normalizedName.length - right.normalizedName.length ||
          left.name.localeCompare(right.name),
      )
      .slice(0, 5)
      .map(({ name }) => name)

    if (suggestions.length === 0) {
      continue
    }

    const queryStartInTrimmedSegment = trimmedSegment.lastIndexOf(query)
    return {
      start: trimmedSegmentStart + queryStartInTrimmedSegment,
      suggestions,
    }
  }

  return null
}

export function buildPreparationModeHighlightParts(value: string, ingredientNames: string[]) {
  if (!value) {
    return [{ text: '', isMatch: false }]
  }

  const matches: Array<{ start: number; end: number }> = []
  let cursor = 0

  while (cursor < value.length) {
    const matchedName = ingredientNames.find((name) => {
      const candidate = value.slice(cursor, cursor + name.length)
      if (normalizePreparationModeComparableValue(candidate) !== normalizePreparationModeComparableValue(name)) {
        return false
      }

      const characterBefore = cursor > 0 ? value[cursor - 1] : undefined
      const characterAfter = value[cursor + name.length]
      return isPreparationModeBoundary(characterBefore) && isPreparationModeBoundary(characterAfter)
    })

    if (matchedName) {
      matches.push({ start: cursor, end: cursor + matchedName.length })
      cursor += matchedName.length
      continue
    }

    cursor += 1
  }

  if (matches.length === 0) {
    return [{ text: value, isMatch: false }]
  }

  const parts: Array<{ text: string; isMatch: boolean }> = []
  let lastIndex = 0

  matches.forEach((match) => {
    if (match.start > lastIndex) {
      parts.push({ text: value.slice(lastIndex, match.start), isMatch: false })
    }
    parts.push({ text: value.slice(match.start, match.end), isMatch: true })
    lastIndex = match.end
  })

  if (lastIndex < value.length) {
    parts.push({ text: value.slice(lastIndex), isMatch: false })
  }

  return parts
}

export function buildPreparationModeMetricParts(value: string, ingredients: RecipePanelIngredientMetrics[]): PreparationModeMetricPart[] {
  if (!value) {
    return [{ type: 'text', text: '' }]
  }

  const sortedIngredients = [...ingredients]
    .filter((ingredient) => ingredient.label.trim() !== '')
    .sort((left, right) => right.label.length - left.label.length || left.label.localeCompare(right.label))

  const parts: PreparationModeMetricPart[] = []
  let cursor = 0
  let lastIndex = 0

  while (cursor < value.length) {
    const matchedIngredient = sortedIngredients.find((ingredient) => {
      const candidate = value.slice(cursor, cursor + ingredient.label.length)
      if (
        normalizePreparationModeComparableValue(candidate) !==
        normalizePreparationModeComparableValue(ingredient.label)
      ) {
        return false
      }

      const characterBefore = cursor > 0 ? value[cursor - 1] : undefined
      const characterAfter = value[cursor + ingredient.label.length]
      return isPreparationModeBoundary(characterBefore) && isPreparationModeBoundary(characterAfter)
    })

    if (!matchedIngredient) {
      cursor += 1
      continue
    }

    if (cursor > lastIndex) {
      parts.push({ type: 'text', text: value.slice(lastIndex, cursor) })
    }

    parts.push({
      type: 'ingredient',
      text: value.slice(cursor, cursor + matchedIngredient.label.length),
      quantityLabel: formatPreparationModeIngredientQuantity(matchedIngredient),
    })
    cursor += matchedIngredient.label.length
    lastIndex = cursor
  }

  if (lastIndex < value.length) {
    parts.push({ type: 'text', text: value.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: value }]
}

export function formatPreparationModeIngredientQuantity(ingredient: RecipePanelIngredientMetrics) {
  const inputLabel = `${formatDecimal(ingredient.scaledInputQuantity)} ${ingredient.unitLabel}`
  if (ingredient.scaledManipulatedQuantity <= 0) {
    return inputLabel
  }

  return `${inputLabel} (${formatDecimal(ingredient.scaledManipulatedQuantity)} ${ingredient.unitLabel} manip.)`
}

export function getRecipeIngredientOperationalQuantity(ingredient: RecipePanelIngredientMetrics) {
  return ingredient.scaledManipulatedQuantity > 0
    ? ingredient.scaledManipulatedQuantity
    : ingredient.scaledInputQuantity
}

export function formatRecipeIngredientOperationalQuantity(ingredient: RecipePanelIngredientMetrics) {
  const suffix = ingredient.scaledManipulatedQuantity > 0 ? ' manip.' : ''
  return `${formatDecimal(getRecipeIngredientOperationalQuantity(ingredient))} ${ingredient.unitLabel}${suffix}`
}
