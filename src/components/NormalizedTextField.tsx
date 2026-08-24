import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from 'react'
import { normalizeFreeText, normalizeRegistrationText } from '../utils/core'

type CommitMode = 'change' | 'debounce' | 'blur'

type SelectionRange = {
  start: number
  end: number
}

function getNormalizedSelection(
  rawValue: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  normalizeValue: (value: string) => string,
) {
  const start = selectionStart ?? rawValue.length
  const end = selectionEnd ?? start

  return {
    start: normalizeValue(rawValue.slice(0, start)).length,
    end: normalizeValue(rawValue.slice(0, end)).length,
  }
}

function useNormalizedDraftValue({
  value,
  onChange,
  commitMode,
  debounceMs,
  normalizeValue,
}: {
  value: string
  onChange: (value: string) => void
  commitMode: CommitMode
  debounceMs: number
  normalizeValue: (value: string) => string
}) {
  const normalizedValue = normalizeValue(value)
  const [draftValue, setDraftValue] = useState(normalizedValue)
  const draftValueRef = useRef(normalizedValue)
  const focusedRef = useRef(false)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (focusedRef.current && commitMode === 'blur') {
      return
    }

    const nextValue = normalizeValue(value)
    if (nextValue !== draftValueRef.current) {
      draftValueRef.current = nextValue
      setDraftValue(nextValue)
    }
  }, [commitMode, normalizeValue, value])

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
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

  function commitValue(nextValue: string) {
    clearPendingCommit()
    if (nextValue !== normalizeValue(value)) {
      onChange(nextValue)
    }
  }

  function updateDraft(nextValue: string) {
    draftValueRef.current = nextValue
    setDraftValue(nextValue)

    if (commitMode === 'change') {
      onChange(nextValue)
      return
    }

    if (commitMode === 'debounce') {
      clearPendingCommit()
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        onChange(draftValueRef.current)
      }, debounceMs)
    }
  }

  return {
    draftValue,
    draftValueRef,
    focusedRef,
    commitValue,
    updateDraft,
  }
}

type NormalizedTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  commitMode?: CommitMode
  debounceMs?: number
  normalize?: (value: string) => string
}

function NormalizedTextInputComponent({
  value,
  onChange,
  commitMode = 'change',
  debounceMs = 180,
  onBlur,
  onFocus,
  onKeyDown,
  normalize = normalizeRegistrationText,
  ...inputProps
}: NormalizedTextInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingSelectionRef = useRef<SelectionRange | null>(null)
  const { draftValue, draftValueRef, focusedRef, commitValue, updateDraft } = useNormalizedDraftValue({
    value,
    onChange,
    commitMode,
    debounceMs,
    normalizeValue: normalize,
  })

  useLayoutEffect(() => {
    const selection = pendingSelectionRef.current
    const input = inputRef.current
    if (!selection || !input || document.activeElement !== input) {
      return
    }

    pendingSelectionRef.current = null
    input.setSelectionRange(selection.start, selection.end)
  }, [draftValue])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = normalize(event.target.value)
    pendingSelectionRef.current = getNormalizedSelection(
      event.target.value,
      event.target.selectionStart,
      event.target.selectionEnd,
      normalize,
    )
    updateDraft(nextValue)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      commitValue(draftValueRef.current)
    }
    onKeyDown?.(event)
  }

  return (
    <input
      {...inputProps}
      ref={inputRef}
      value={draftValue}
      onChange={handleChange}
      onFocus={(event) => {
        focusedRef.current = true
        onFocus?.(event)
      }}
      onBlur={(event) => {
        focusedRef.current = false
        commitValue(draftValueRef.current)
        onBlur?.(event)
      }}
      onKeyDown={handleKeyDown}
    />
  )
}

type NormalizedTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  commitMode?: CommitMode
  debounceMs?: number
  normalize?: (value: string) => string
}

function NormalizedTextareaComponent({
  value,
  onChange,
  commitMode = 'blur',
  debounceMs = 180,
  onBlur,
  onFocus,
  normalize = normalizeFreeText,
  ...textareaProps
}: NormalizedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingSelectionRef = useRef<SelectionRange | null>(null)
  const { draftValue, draftValueRef, focusedRef, commitValue, updateDraft } = useNormalizedDraftValue({
    value,
    onChange,
    commitMode,
    debounceMs,
    normalizeValue: normalize,
  })

  useLayoutEffect(() => {
    const selection = pendingSelectionRef.current
    const textarea = textareaRef.current
    if (!selection || !textarea || document.activeElement !== textarea) {
      return
    }

    pendingSelectionRef.current = null
    textarea.setSelectionRange(selection.start, selection.end)
  }, [draftValue])

  return (
    <textarea
      {...textareaProps}
      ref={textareaRef}
      value={draftValue}
      onChange={(event) => {
        const nextValue = normalize(event.target.value)
        pendingSelectionRef.current = getNormalizedSelection(
          event.target.value,
          event.target.selectionStart,
          event.target.selectionEnd,
          normalize,
        )
        updateDraft(nextValue)
      }}
      onFocus={(event) => {
        focusedRef.current = true
        onFocus?.(event)
      }}
      onBlur={(event) => {
        focusedRef.current = false
        commitValue(draftValueRef.current)
        onBlur?.(event)
      }}
    />
  )
}

export const NormalizedTextInput = memo(NormalizedTextInputComponent)
export const NormalizedTextarea = memo(NormalizedTextareaComponent)
