import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { compareAlpha } from './options'
import { createPortal } from 'react-dom'
import { IconTooltip } from '../IconTooltip'
import { controlClass } from './controlClass'
import { useFixedMenu } from './useFixedMenu'

export interface SearchSelectProps<T> {
  id?: string
  options: readonly T[]
  value: T | null
  onChange: (value: T | null) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  filterItem?: (item: T, query: string) => boolean
  renderOption?: (item: T) => ReactNode
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  invalid?: boolean
  disabled?: boolean
  clearable?: boolean
  /** Keep options in the given order (skip A–Z sort by label). */
  preserveOrder?: boolean
}

/**
 * Searchable single-select. Pass any item shape via `getKey` / `getLabel`.
 * Wrap with `Field` (or use `SearchSelectField`) for label + error.
 */
export function SearchSelect<T>({
  id,
  options,
  value,
  onChange,
  getKey,
  getLabel,
  filterItem,
  renderOption,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No results',
  invalid,
  disabled,
  clearable = true,
  preserveOrder = false,
}: SearchSelectProps<T>) {
  const autoId = useId()
  const buttonId = id ?? autoId
  const listId = `${buttonId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focusIdx, setFocusIdx] = useState(0)
  const menuStyle = useFixedMenu(open, rootRef)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? options.filter((item) =>
          filterItem ? filterItem(item, query) : getLabel(item).toLowerCase().includes(q),
        )
      : [...options]
    if (preserveOrder) return list
    return list.sort((left, right) => compareAlpha(getLabel(left), getLabel(right)))
  }, [options, query, filterItem, getLabel, preserveOrder])

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (open) setFocusIdx(0)
  }, [open, query])

  function select(item: T | null) {
    onChange(item)
    setQuery('')
    setOpen(false)
  }

  function onButtonKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusIdx((idx) => (idx + 1) % Math.max(filtered.length, 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusIdx((idx) => (idx - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1))
    }
    if (event.key === 'Enter' && filtered[focusIdx]) {
      event.preventDefault()
      select(filtered[focusIdx])
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        className={`${controlClass({ invalid, className: 'text-left flex items-center justify-between gap-2' })}`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={onButtonKey}
      >
        <span className={value ? 'text-ink text-[13px] truncate' : 'text-ink-faint text-[13px] truncate'}>
          {value ? getLabel(value) : placeholder}
        </span>
        {value && clearable && !disabled ? (
          <IconTooltip label="Clear">
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              className="text-ink-faint text-base leading-none"
              onClick={(event) => {
                event.stopPropagation()
                select(null)
              }}
            >
              ×
            </span>
          </IconTooltip>
        ) : (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-ink-faint shrink-0" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {open
        ? createPortal(
            <div
              id={listId}
              ref={panelRef}
              role="listbox"
              className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
              style={{ ...menuStyle, boxShadow: 'var(--shadow-overlay)' }}
              onKeyDown={onListKey}
            >
              <div className="shrink-0 border-b border-line-subtle p-2">
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className={controlClass({ className: 'text-xs' })}
                  aria-label={searchPlaceholder}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-xs text-center py-4 text-ink-faint">{emptyText}</p>
                ) : (
                  filtered.map((item, idx) => (
                    <button
                      key={getKey(item)}
                      type="button"
                      role="option"
                      aria-selected={value ? getKey(value) === getKey(item) : false}
                      className={`w-full px-3 py-2 text-left ${idx === focusIdx ? 'bg-primary-soft' : 'bg-surface'}`}
                      onMouseEnter={() => setFocusIdx(idx)}
                      onClick={() => select(item)}
                    >
                      {renderOption ? renderOption(item) : <span className="text-xs font-semibold text-ink">{getLabel(item)}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
