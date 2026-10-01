import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { compareAlpha } from './options'
import { createPortal } from 'react-dom'
import { IconTooltip } from '../IconTooltip'
import { controlClass } from './controlClass'
import { useFixedMenu } from './useFixedMenu'
import { initialFocusIndex, scrollSelectedIntoView } from './selectedOption'

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
  /** Server-side search: called with the typed text; `options` are then shown as given (no local filtering). */
  onQueryChange?: (query: string) => void
  /** Show a searching state instead of the empty text. */
  loading?: boolean
  /** Small note under the list, e.g. "Showing 50 of 1,240 — keep typing to narrow". */
  footer?: ReactNode
  /** Fires when the list opens / closes — lets callers load options only once the user opens the field. */
  onOpenChange?: (open: boolean) => void
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
  onQueryChange,
  loading = false,
  footer,
  onOpenChange,
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
    const list = q && !onQueryChange
      ? options.filter((item) =>
          filterItem ? filterItem(item, query) : getLabel(item).toLowerCase().includes(q),
        )
      : [...options]
    if (preserveOrder) return list
    return list.sort((left, right) => compareAlpha(getLabel(left), getLabel(right)))
  }, [options, query, filterItem, getLabel, preserveOrder, onQueryChange])

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selectedKey = value ? getKey(value) : null
  const listRef = useRef<HTMLDivElement>(null)
  // Open on the selected option (not the first row); a search starts from the first match.
  useEffect(() => {
    if (open) setFocusIdx(initialFocusIndex(filtered, selectedKey, getKey, Boolean(query.trim())))
    // Only when the list opens or the search changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query])
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => scrollSelectedIntoView(listRef.current))
    return () => cancelAnimationFrame(frame)
  }, [open])

  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange
  useEffect(() => {
    onOpenChangeRef.current?.(open)
  }, [open])

  function updateQuery(next: string) {
    setQuery(next)
    onQueryChange?.(next)
  }

  function select(item: T | null) {
    onChange(item)
    updateQuery('')
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
                  onChange={(event) => updateQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className={controlClass({ className: 'text-xs' })}
                  aria-label={searchPlaceholder}
                />
              </div>
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
                {loading && filtered.length === 0 ? (
                  <p className="text-xs text-center py-4 text-ink-faint" role="status">Searching…</p>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-center py-4 text-ink-faint">{emptyText}</p>
                ) : (
                  filtered.map((item, idx) => {
                    const selected = selectedKey !== null && getKey(item) === selectedKey
                    return (
                    <button
                      key={getKey(item)}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      // Selected: tinted with a primary bar; the row under the pointer / arrow keys: hover tint.
                      className={`w-full px-3 py-2 text-left ${
                        selected
                          ? 'bg-primary-soft shadow-[inset_3px_0_0_var(--color-primary)]'
                          : idx === focusIdx
                            ? 'bg-surface-hover'
                            : 'bg-surface'
                      }`}
                      onMouseEnter={() => setFocusIdx(idx)}
                      onClick={() => select(item)}
                    >
                      {renderOption ? renderOption(item) : <span className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-ink'}`}>{getLabel(item)}</span>}
                    </button>
                    )
                  })
                )}
              </div>
              {footer ? (
                <div className="shrink-0 border-t border-line-subtle px-3 py-1.5 text-[11px] text-ink-faint">{footer}</div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
