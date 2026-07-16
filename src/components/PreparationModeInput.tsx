import { Suspense, lazy, useId, useMemo, useState } from 'react'
import type { PreparationModeInputProps } from '../types/domain'

import {
  buildPreparationModeHighlightParts,
  getPreparationModeAutocomplete,
  normalizePreparationModeEditingValue,
  normalizePreparationModeIngredientNames,
} from '../utils/preparationMode'

const LazyCodeEditor = lazy(() => import('./LazyCodeEditor'))

export function PreparationModeInput({
  value,
  onChange,
  placeholder,
  ingredientNames,
}: PreparationModeInputProps) {
  const textareaId = useId()
  const [caretIndex, setCaretIndex] = useState(value.length)
  const normalizedIngredientNames = useMemo(
    () => normalizePreparationModeIngredientNames(ingredientNames),
    [ingredientNames],
  )
  const autocomplete = useMemo(
    () => getPreparationModeAutocomplete(value, caretIndex, normalizedIngredientNames),
    [caretIndex, normalizedIngredientNames, value],
  )

  function applySuggestion(suggestion: string) {
    if (!autocomplete) {
      return
    }

    const nextValue = `${value.slice(0, autocomplete.start)}${suggestion}${value.slice(caretIndex)}`
    const nextCaretIndex = autocomplete.start + suggestion.length
    onChange(nextValue)
    setCaretIndex(nextCaretIndex)

    requestAnimationFrame(() => {
      const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null
      if (!textarea) {
        return
      }

      textarea.focus()
      textarea.setSelectionRange(nextCaretIndex, nextCaretIndex)
    })
  }

  return (
    <div className="recipe-textarea-field">
      <Suspense
        fallback={
          <textarea
            id={textareaId}
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value
              const nextCaretIndex = event.target.selectionStart ?? caretIndex
              const normalizedValue = normalizePreparationModeEditingValue(nextValue)
              onChange(normalizedValue)
              setCaretIndex(nextCaretIndex)
            }}
            placeholder={placeholder}
            className="recipe-code-editor-textarea"
            style={{
              minHeight: 140,
              borderRadius: 14,
              border: '1px solid rgba(20, 33, 61, 0.14)',
              background: 'rgba(255, 255, 255, 0.96)',
              fontFamily: 'inherit',
              fontSize: '1rem',
              lineHeight: 1.5,
              padding: 12,
              width: '100%',
            }}
          />
        }
      >
        <LazyCodeEditor
          value={value}
          onValueChange={(nextValue) => {
            const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null
            const nextCaretIndex = textarea?.selectionStart ?? caretIndex
            const normalizedValue = normalizePreparationModeEditingValue(nextValue)
            onChange(normalizedValue)
            setCaretIndex(nextCaretIndex)

            if (normalizedValue !== nextValue) {
              requestAnimationFrame(() => {
                const nextTextarea = document.getElementById(textareaId) as HTMLTextAreaElement | null
                if (!nextTextarea) {
                  return
                }

                nextTextarea.setSelectionRange(nextCaretIndex, nextCaretIndex)
              })
            }
          }}
          highlight={(code) => (
            <>
              {code ? (
                <>
                  {buildPreparationModeHighlightParts(code, normalizedIngredientNames).map((part, index) =>
                    part.isMatch ? (
                      <span key={`${part.text}-${index}`} className="recipe-highlight-token">
                        {part.text}
                      </span>
                    ) : (
                      <span key={`${part.text}-${index}`}>{part.text}</span>
                    ),
                  )}
                  {code.endsWith('\n') ? <span className="recipe-textarea-trailing-space"> </span> : null}
                </>
              ) : (
                <span className="recipe-textarea-placeholder">{placeholder}</span>
              )}
            </>
          )}
          padding={12}
          textareaClassName="recipe-code-editor-textarea"
          preClassName="recipe-code-editor-highlight"
          style={{
            minHeight: 140,
            borderRadius: 14,
            border: '1px solid rgba(20, 33, 61, 0.14)',
            background: 'rgba(255, 255, 255, 0.96)',
            fontFamily: 'inherit',
            fontSize: '1rem',
            lineHeight: 1.5,
          }}
          textareaId={textareaId}
          placeholder={placeholder}
          onClick={(event) => setCaretIndex((event.currentTarget as HTMLTextAreaElement).selectionStart ?? 0)}
          onFocus={(event) => setCaretIndex((event.currentTarget as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyUp={(event) => setCaretIndex((event.currentTarget as HTMLTextAreaElement).selectionStart ?? 0)}
        />
      </Suspense>
      {autocomplete ? (
        <div className="recipe-autocomplete" role="listbox" aria-label="Sugestoes de insumos">
          {autocomplete.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="recipe-autocomplete-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applySuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
