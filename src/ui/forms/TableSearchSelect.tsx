import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { IconTooltip } from '../IconTooltip'
import { controlClass } from './controlClass'
import { useFixedMenu } from './useFixedMenu'

export interface TableSearchColumn<T> {
  header: string
  getValue: (item: T) => string
  width?: string
  truncate?: boolean
  align?: 'left' | 'right'
}

export interface TableSearchSelectProps<T> {
  id?: string
  options: readonly T[]
  value: T | null
  onChange: (value: T | null) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  columns: readonly TableSearchColumn<T>[]
  filterItem?: (item: T, query: string) => boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  invalid?: boolean
  disabled?: boolean
  clearable?: boolean
}

function SearchGlyph() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 text-ink-faint" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
    </svg>
  )
}

/** Searchable table picker (Code / Name / Unit). Search sits at the bottom, matching ERP lookup. */
export function TableSearchSelect<T>({
  id,
  options,
  value,
  onChange,
  getKey,
  getLabel,
  columns,
  filterItem,
  placeholder = 'Select…',
  searchPlaceholder = 'Advance Search',
  emptyText = 'No results',
  invalid,
  disabled,
  clearable = true,
}: TableSearchSelectProps<T>) {
  const autoId = useId()
  const buttonId = id ?? autoId
  const listId = `${buttonId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focusIdx, setFocusIdx] = useState(0)
  const menuStyle = useFixedMenu(open, rootRef)
  const template = columns.map((column) => column.width ?? 'minmax(0,1fr)').join(' ')

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return [...options]
    return options.filter((item) =>
      filterItem ? filterItem(item, query) : getLabel(item).toLowerCase().includes(q.toLowerCase()),
    )
  }, [options, query, filterItem, getLabel])

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
        className={controlClass({ invalid, className: 'text-left flex items-center justify-between gap-2' })}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={onButtonKey}
      >
        <span className={value ? 'truncate text-[13px] text-ink' : 'truncate text-[13px] text-ink-faint'}>
          {value ? getLabel(value) : placeholder}
        </span>
        {value && clearable && !disabled ? (
          <IconTooltip label="Clear">
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              className="text-base leading-none text-ink-faint"
              onClick={(event) => {
                event.stopPropagation()
                select(null)
              }}
            >
              ×
            </span>
          </IconTooltip>
        ) : (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 text-ink-faint" aria-hidden="true">
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
              style={{
                ...menuStyle,
                width: 'min(52rem, calc(100vw - 16px))',
                maxHeight: 360,
                boxShadow: 'var(--shadow-overlay)',
              }}
              onKeyDown={onListKey}
            >
              <div
                className="grid shrink-0 border-b border-line-subtle px-3 py-2"
                style={{ gridTemplateColumns: template }}
              >
                {columns.map((column) => (
                  <span
                    key={column.header}
                    className={`text-[11px] font-bold text-ink-muted ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {column.header}
                  </span>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-faint">{emptyText}</p>
                ) : (
                  filtered.map((item, idx) => (
                    <button
                      key={getKey(item)}
                      type="button"
                      role="option"
                      aria-selected={value ? getKey(value) === getKey(item) : false}
                      className={`grid w-full items-center px-3 py-2 text-left transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                        idx === focusIdx ? 'bg-primary-soft' : 'bg-surface'
                      }`}
                      style={{ gridTemplateColumns: template }}
                      onMouseEnter={() => setFocusIdx(idx)}
                      onClick={() => select(item)}
                    >
                      {columns.map((column) => {
                        const text = column.getValue(item)
                        const cell = (
                          <span
                            className={`min-w-0 text-xs text-ink ${column.truncate ? 'truncate whitespace-nowrap' : 'whitespace-nowrap'} ${
                              column.align === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {text}
                          </span>
                        )
                        return (
                          <span key={column.header} className="min-w-0">
                            {column.truncate ? (
                              <IconTooltip label={text} overflowOnly className="w-full">
                                {cell}
                              </IconTooltip>
                            ) : (
                              cell
                            )}
                          </span>
                        )
                      })}
                    </button>
                  ))
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 border-t border-line-subtle px-3 py-2">
                <SearchGlyph />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={searchPlaceholder}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
