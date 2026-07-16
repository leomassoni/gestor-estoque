import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  normalizeRegistrationText,
  normalizeSuggestionSet,
} from '../utils/core'

export function MultiSelectChips({
  selectedValues,
  suggestions,
  inputValue,
  onInputChange,
  onChange,
  placeholder,
  onHideSuggestion,
  allowCreate = true,
}: {
  selectedValues: string[]
  suggestions: string[]
  inputValue: string
  onInputChange: (value: string) => void
  onChange: (values: string[]) => void
  placeholder: string
  onHideSuggestion?: (value: string) => void
  allowCreate?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1)
  const closeTimeoutRef = useRef<number | null>(null)

  const filteredSuggestions = useMemo(() => {
    const normalizedInput = normalizeRegistrationText(inputValue).toLowerCase()
    return suggestions.filter((item) => {
      if (selectedValues.includes(item)) {
        return false
      }

      return normalizedInput === '' || normalizeRegistrationText(item).toLowerCase().includes(normalizedInput)
    })
  }, [inputValue, selectedValues, suggestions])

  const exactMatchExists = suggestions.some(
    (item) => normalizeRegistrationText(item).toLowerCase() === normalizeRegistrationText(inputValue).toLowerCase(),
  )
  const canCreateOption = allowCreate && !exactMatchExists && inputValue.trim() !== ''
  const optionCount = filteredSuggestions.length + (canCreateOption ? 1 : 0)
  const effectiveActiveOptionIndex =
    isOpen && activeOptionIndex >= 0 && activeOptionIndex < optionCount ? activeOptionIndex : -1

  function commitValue(rawValue: string) {
    const normalized = normalizeRegistrationText(rawValue.trim())
    if (!normalized) {
      return
    }

    const matchedSuggestion =
      suggestions.find(
        (item) => normalizeRegistrationText(item).toLowerCase() === normalized.toLowerCase(),
      ) ?? null
    const resolvedValue = matchedSuggestion ?? normalized

    if (!allowCreate && matchedSuggestion === null) {
      onInputChange('')
      setIsOpen(false)
      setActiveOptionIndex(-1)
      return
    }

    if (selectedValues.includes(resolvedValue)) {
      onInputChange('')
      setIsOpen(false)
      setActiveOptionIndex(-1)
      return
    }

    onChange([...selectedValues, resolvedValue])
    onInputChange('')
    setIsOpen(false)
    setActiveOptionIndex(-1)
  }

  function removeValue(value: string) {
    onChange(selectedValues.filter((item) => item !== value))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveOptionIndex((current) => {
        if (optionCount === 0) {
          return -1
        }
        return current < 0 ? 0 : (current + 1) % optionCount
      })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveOptionIndex((current) => {
        if (optionCount === 0) {
          return -1
        }
        return current < 0 ? optionCount - 1 : (current - 1 + optionCount) % optionCount
      })
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
      setActiveOptionIndex(-1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (effectiveActiveOptionIndex >= 0) {
        if (effectiveActiveOptionIndex < filteredSuggestions.length) {
          commitValue(filteredSuggestions[effectiveActiveOptionIndex])
          return
        }

        commitValue(inputValue)
        return
      }

      if (filteredSuggestions.length > 0 && inputValue.trim() !== '') {
        commitValue(filteredSuggestions[0])
        return
      }

      commitValue(inputValue)
    }

    if (event.key === 'Backspace' && inputValue === '' && selectedValues.length > 0) {
      event.preventDefault()
      removeValue(selectedValues[selectedValues.length - 1])
    }
  }

  return (
    <div className="multi-select">
      <div className="multi-select-shell" onClick={() => setIsOpen(true)}>
        {selectedValues.map((value) => (
          <span key={value} className="multi-select-chip">
            {value}
            <button
              type="button"
              className="multi-select-chip-remove"
              aria-label={`Remover setor ${value}`}
              onClick={(event) => {
                event.stopPropagation()
                removeValue(value)
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={inputValue}
          onChange={(event) => {
            onInputChange(event.target.value)
            setActiveOptionIndex(-1)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (closeTimeoutRef.current !== null) {
              window.clearTimeout(closeTimeoutRef.current)
            }
            setIsOpen(true)
          }}
          onBlur={() => {
            closeTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 120)
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedValues.length === 0 ? placeholder : ''}
          className="multi-select-input"
        />
      </div>

      {isOpen && optionCount > 0 ? (
        <div className="multi-select-menu" role="listbox">
          {filteredSuggestions.map((item, index) => (
            <div key={item} className="multi-select-option-row">
              <button
                type="button"
                className={effectiveActiveOptionIndex === index ? 'multi-select-option active' : 'multi-select-option'}
                role="option"
                aria-selected={effectiveActiveOptionIndex === index}
                onMouseEnter={() => setActiveOptionIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  commitValue(item)
                }}
              >
                {item}
              </button>
              {onHideSuggestion ? (
                <button
                  type="button"
                  className="multi-select-option-remove"
                  aria-label={`Ocultar setor ${item} das opcoes`}
                  title={`Ocultar setor ${item} das opcoes`}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onHideSuggestion(item)
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {canCreateOption ? (
            <button
              type="button"
              className={
                effectiveActiveOptionIndex === filteredSuggestions.length
                  ? 'multi-select-option multi-select-option-create active'
                  : 'multi-select-option multi-select-option-create'
              }
              role="option"
              aria-selected={effectiveActiveOptionIndex === filteredSuggestions.length}
              onMouseEnter={() => setActiveOptionIndex(filteredSuggestions.length)}
              onMouseDown={(event) => {
                event.preventDefault()
                commitValue(inputValue)
              }}
            >
              Criar setor "{normalizeRegistrationText(inputValue.trim())}"
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function SingleValueAutocomplete({
  value,
  suggestions,
  onChange,
  placeholder,
  onDeleteSuggestion,
  createLabel,
  allowCreate = true,
}: {
  value: string
  suggestions: string[]
  onChange: (value: string) => void
  placeholder?: string
  onDeleteSuggestion?: (value: string) => void
  createLabel?: string
  allowCreate?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1)
  const closeTimeoutRef = useRef<number | null>(null)
  const normalizedSuggestions = useMemo(() => normalizeSuggestionSet(suggestions), [suggestions])

  const filteredSuggestions = useMemo(() => {
    const normalizedInput = normalizeRegistrationText(value).toLowerCase()
    const hasExactMatch = normalizedSuggestions.some(
      (item) => normalizeRegistrationText(item).toLowerCase() === normalizedInput,
    )

    if (normalizedInput !== '' && hasExactMatch) {
      return normalizedSuggestions
    }

    return normalizedSuggestions.filter((item) => {
      return normalizedInput === '' || normalizeRegistrationText(item).toLowerCase().includes(normalizedInput)
    })
  }, [normalizedSuggestions, value])

  const exactMatchExists = normalizedSuggestions.some(
    (item) => normalizeRegistrationText(item).toLowerCase() === normalizeRegistrationText(value).toLowerCase(),
  )
  const canCreateOption = allowCreate && !exactMatchExists && value.trim() !== ''
  const optionCount = filteredSuggestions.length + (canCreateOption ? 1 : 0)
  const effectiveActiveOptionIndex =
    isOpen && activeOptionIndex >= 0 && activeOptionIndex < optionCount ? activeOptionIndex : -1

  function commitValue(rawValue: string) {
    const normalized = normalizeRegistrationText(rawValue.trim())
    if (!normalized) {
      onChange('')
      setIsOpen(false)
      return
    }

    const matchedSuggestion =
      normalizedSuggestions.find((item) => normalizeRegistrationText(item).toLowerCase() === normalized.toLowerCase()) ??
      null
    const resolvedValue = matchedSuggestion ?? normalized

    if (!allowCreate && matchedSuggestion === null) {
      setIsOpen(false)
      setActiveOptionIndex(-1)
      return
    }

    onChange(resolvedValue)
    setIsOpen(false)
    setActiveOptionIndex(-1)
  }

  return (
    <div className="single-autocomplete">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setActiveOptionIndex(-1)
          setIsOpen(true)
        }}
        onFocus={() => {
          if (closeTimeoutRef.current !== null) {
            window.clearTimeout(closeTimeoutRef.current)
          }
          setIsOpen(true)
        }}
        onBlur={() => {
          closeTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 120)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIsOpen(true)
            setActiveOptionIndex((current) => {
              if (optionCount === 0) {
                return -1
              }
              return current < 0 ? 0 : (current + 1) % optionCount
            })
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setIsOpen(true)
            setActiveOptionIndex((current) => {
              if (optionCount === 0) {
                return -1
              }
              return current < 0 ? optionCount - 1 : (current - 1 + optionCount) % optionCount
            })
            return
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            setIsOpen(false)
            setActiveOptionIndex(-1)
            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            if (effectiveActiveOptionIndex >= 0) {
              if (effectiveActiveOptionIndex < filteredSuggestions.length) {
                commitValue(filteredSuggestions[effectiveActiveOptionIndex])
                return
              }

              commitValue(value)
              return
            }

            if (allowCreate && !exactMatchExists && value.trim() !== '') {
              commitValue(value)
              return
            }
            if (filteredSuggestions.length > 0 && value.trim() !== '') {
              commitValue(filteredSuggestions[0])
              return
            }
            commitValue(value)
          }
        }}
        placeholder={placeholder}
      />

      {isOpen && optionCount > 0 ? (
        <div className="multi-select-menu single-autocomplete-menu" role="listbox">
          {filteredSuggestions.map((item, index) => (
            <div key={item} className="multi-select-option-row">
              <button
                type="button"
                className={effectiveActiveOptionIndex === index ? 'multi-select-option active' : 'multi-select-option'}
                role="option"
                aria-selected={effectiveActiveOptionIndex === index}
                onMouseEnter={() => setActiveOptionIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  commitValue(item)
                }}
              >
                {item}
              </button>
              {onDeleteSuggestion ? (
                <button
                  type="button"
                  className="multi-select-option-remove"
                  aria-label={`Excluir opcao ${item}`}
                  title={`Excluir opcao ${item}`}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onDeleteSuggestion(item)
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {canCreateOption ? (
            <button
              type="button"
              className={
                effectiveActiveOptionIndex === filteredSuggestions.length
                  ? 'multi-select-option multi-select-option-create active'
                  : 'multi-select-option multi-select-option-create'
              }
              role="option"
              aria-selected={effectiveActiveOptionIndex === filteredSuggestions.length}
              onMouseEnter={() => setActiveOptionIndex(filteredSuggestions.length)}
              onMouseDown={(event) => {
                event.preventDefault()
                commitValue(value)
              }}
            >
              {createLabel ?? 'Criar'} "{normalizeRegistrationText(value.trim())}"
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ColorSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const colorInputRef = useRef<HTMLInputElement | null>(null)
  const resolvedColor = value || '#0f4c81'

  return (
    <div className="color-selector" role="listbox" aria-label="Seletor de cor">
      <button
        type="button"
        className={!value ? 'color-swatch active' : 'color-swatch'}
        aria-label="Nenhuma cor"
        title="Nenhuma cor"
        aria-selected={!value}
        onClick={() => onChange('')}
      >
        <span className="color-swatch-none" aria-hidden="true">Ø</span>
      </button>
      <button
        type="button"
        className={value ? 'color-swatch color-swatch-filled active' : 'color-swatch color-swatch-filled'}
        aria-label="Escolher cor"
        title="Escolher cor"
        aria-selected={Boolean(value)}
        style={{ backgroundColor: resolvedColor }}
        onClick={() => colorInputRef.current?.click()}
      />
      <input
        ref={colorInputRef}
        type="color"
        className="color-selector-native"
        value={resolvedColor}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function ConfirmationModal({
  title,
  message,
  actionClass,
  actionLabel,
  onCancel,
  onConfirm,
  bringToFront = false,
}: {
  title: string
  message: string
  actionClass: string
  actionLabel: string
  onCancel: () => void
  onConfirm: () => void
  bringToFront?: boolean
}) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)
  const shouldFocusConfirm = !actionClass.split(/\s+/).includes('danger-button')

  useEffect(() => {
    if (shouldFocusConfirm) {
      confirmButtonRef.current?.focus()
      return
    }
    cancelButtonRef.current?.focus()
  }, [shouldFocusConfirm])

  return (
    <div
      className={bringToFront ? 'modal-backdrop modal-backdrop-front' : 'modal-backdrop'}
      role="presentation"
      onClick={onCancel}
    >
      <section
        className="modal-card modal-card-compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="kicker">Confirmacao</p>
            <h2 id="confirm-modal-title">{title}</h2>
          </div>
        </div>

        <p className="confirm-copy">{message}</p>

        <div className="modal-actions">
          <button ref={cancelButtonRef} className="ghost-button" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button ref={confirmButtonRef} className={actionClass} type="button" onClick={onConfirm}>
            {actionLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
