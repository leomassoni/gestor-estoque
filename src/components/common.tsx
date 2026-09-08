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
  const debounceRef = useRef<number | null>(null)
  const focusedRef = useRef(false)
  const [draftInputValue, setDraftInputValue] = useState(inputValue)
  const draftInputValueRef = useRef(inputValue)
  const lastCommittedInputValueRef = useRef(inputValue)

  useEffect(() => {
    if (
      focusedRef.current &&
      inputValue === lastCommittedInputValueRef.current &&
      inputValue !== draftInputValueRef.current
    ) {
      return
    }

    if (inputValue !== draftInputValueRef.current) {
      draftInputValueRef.current = inputValue
      lastCommittedInputValueRef.current = inputValue
      setDraftInputValue(inputValue)
    }
  }, [inputValue])

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
      }
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    },
    [],
  )

  function clearPendingInputCommit() {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  function commitInputValue(nextValue: string) {
    clearPendingInputCommit()
    lastCommittedInputValueRef.current = nextValue
    if (nextValue !== inputValue) {
      onInputChange(nextValue)
    }
  }

  function updateDraftInput(nextValue: string) {
    draftInputValueRef.current = nextValue
    setDraftInputValue(nextValue)
    clearPendingInputCommit()
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      lastCommittedInputValueRef.current = draftInputValueRef.current
      onInputChange(draftInputValueRef.current)
    }, 160)
  }

  const filteredSuggestions = useMemo(() => {
    const normalizedInput = normalizeRegistrationText(draftInputValue).toLowerCase()
    return suggestions.filter((item) => {
      if (selectedValues.includes(item)) {
        return false
      }

      return normalizedInput === '' || normalizeRegistrationText(item).toLowerCase().includes(normalizedInput)
    })
  }, [draftInputValue, selectedValues, suggestions])

  const exactMatchExists = suggestions.some(
    (item) => normalizeRegistrationText(item).toLowerCase() === normalizeRegistrationText(draftInputValue).toLowerCase(),
  )
  const canCreateOption = allowCreate && !exactMatchExists && draftInputValue.trim() !== ''
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
      draftInputValueRef.current = ''
      setDraftInputValue('')
      commitInputValue('')
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
    draftInputValueRef.current = ''
    setDraftInputValue('')
    commitInputValue('')
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

        commitValue(draftInputValue)
        return
      }

      if (filteredSuggestions.length > 0 && draftInputValue.trim() !== '') {
        commitValue(filteredSuggestions[0])
        return
      }

      commitValue(draftInputValue)
    }

    if (event.key === 'Backspace' && draftInputValue === '' && selectedValues.length > 0) {
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
          value={draftInputValue}
          onChange={(event) => {
            updateDraftInput(event.target.value)
            setActiveOptionIndex(-1)
            setIsOpen(true)
          }}
          onFocus={() => {
            focusedRef.current = true
            if (closeTimeoutRef.current !== null) {
              window.clearTimeout(closeTimeoutRef.current)
            }
            setIsOpen(true)
          }}
          onBlur={() => {
            focusedRef.current = false
            commitInputValue(draftInputValueRef.current)
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
                commitValue(draftInputValue)
              }}
            >
              Criar setor "{normalizeRegistrationText(draftInputValue.trim())}"
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
  const debounceRef = useRef<number | null>(null)
  const focusedRef = useRef(false)
  const [draftValue, setDraftValue] = useState(value)
  const draftValueRef = useRef(value)
  const lastCommittedValueRef = useRef(value)
  const normalizedSuggestions = useMemo(() => normalizeSuggestionSet(suggestions), [suggestions])

  useEffect(() => {
    if (
      focusedRef.current &&
      value === lastCommittedValueRef.current &&
      value !== draftValueRef.current
    ) {
      return
    }

    if (value !== draftValueRef.current) {
      draftValueRef.current = value
      lastCommittedValueRef.current = value
      setDraftValue(value)
    }
  }, [value])

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
      }
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    },
    [],
  )

  function clearPendingCommit() {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  function commitChange(nextValue: string) {
    clearPendingCommit()
    lastCommittedValueRef.current = nextValue
    if (nextValue !== value) {
      onChange(nextValue)
    }
  }

  function updateDraft(nextValue: string) {
    draftValueRef.current = nextValue
    setDraftValue(nextValue)
    clearPendingCommit()
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      lastCommittedValueRef.current = draftValueRef.current
      onChange(draftValueRef.current)
    }, 160)
  }

  const filteredSuggestions = useMemo(() => {
    const normalizedInput = normalizeRegistrationText(draftValue).toLowerCase()
    const hasExactMatch = normalizedSuggestions.some(
      (item) => normalizeRegistrationText(item).toLowerCase() === normalizedInput,
    )

    if (normalizedInput !== '' && hasExactMatch) {
      return normalizedSuggestions
    }

    return normalizedSuggestions.filter((item) => {
      return normalizedInput === '' || normalizeRegistrationText(item).toLowerCase().includes(normalizedInput)
    })
  }, [draftValue, normalizedSuggestions])

  const exactMatchExists = normalizedSuggestions.some(
    (item) => normalizeRegistrationText(item).toLowerCase() === normalizeRegistrationText(draftValue).toLowerCase(),
  )
  const canCreateOption = allowCreate && !exactMatchExists && draftValue.trim() !== ''
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
      draftValueRef.current = value
      setDraftValue(value)
      setIsOpen(false)
      setActiveOptionIndex(-1)
      return
    }

    draftValueRef.current = resolvedValue
    setDraftValue(resolvedValue)
    commitChange(resolvedValue)
    setIsOpen(false)
    setActiveOptionIndex(-1)
  }

  return (
    <div className="single-autocomplete">
      <input
        value={draftValue}
        onChange={(event) => {
          updateDraft(event.target.value)
          setActiveOptionIndex(-1)
          setIsOpen(true)
        }}
        onFocus={() => {
          focusedRef.current = true
          if (closeTimeoutRef.current !== null) {
            window.clearTimeout(closeTimeoutRef.current)
          }
          setIsOpen(true)
        }}
        onBlur={() => {
          focusedRef.current = false
          commitChange(draftValueRef.current)
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

              commitValue(draftValue)
              return
            }

            if (allowCreate && !exactMatchExists && draftValue.trim() !== '') {
              commitValue(draftValue)
              return
            }
            if (filteredSuggestions.length > 0 && draftValue.trim() !== '') {
              commitValue(filteredSuggestions[0])
              return
            }
            commitValue(draftValue)
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
                commitValue(draftValue)
              }}
            >
              {createLabel ?? 'Criar'} "{normalizeRegistrationText(draftValue.trim())}"
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
