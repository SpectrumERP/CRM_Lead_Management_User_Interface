import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconTooltip } from '../IconTooltip'
import { controlClass } from './controlClass'
import { useFixedMenu } from './useFixedMenu'
import { initialFocusIndex, scrollSelectedIntoView } from './selectedOption'
import Pagination from '../../components/Pagination'

const TABLE_PAGE_SIZE = 10

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
  /** Server-side search: called with the typed text; `options` are then shown as given (no local filtering). */
  onQueryChange?: (query: string) => void
  /** Show a searching state instead of the empty text. */
  loading?: boolean
  /** Small note above the search box, e.g. a load error. */
  footer?: ReactNode
  /** Row at the bottom of the list, e.g. "+ Create Business Entity"; picking it closes the list first. */
  action?: { label: string; onSelect: () => void }
  /** Fires when the list opens / closes — lets callers load options only once the user opens the field. */
  onOpenChange?: (open: boolean) => void
  /** Accessible name when there is no visible label (e.g. a currency picker inside a combo). */
  'aria-label'?: string
  /** Type straight into the field (default); `false` keeps a separate search box at the top of the list. */
  inlineSearch?: boolean
  /** `row`: the list spans the whole form row the field sits in (all its grid columns), for wide lookups
      in narrow places such as side drawers. Default `field`: as wide as the field. */
  menuSpan?: 'field' | 'row'
  /** Optional wider menu for tables with several columns; capped to the viewport. */
  menuWidth?: number
  /** Grid-like table styling for lookup lists that need stronger row and column structure. */
  tableVariant?: 'default' | 'data-grid'
}

function SearchGlyph() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 text-ink-faint" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
    </svg>
  )
}

/** Searchable table picker (Code / Name / Unit): search box on top, then the column headers and rows. */
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
  onQueryChange,
  loading = false,
  footer,
  action,
  onOpenChange,
  'aria-label': ariaLabel,
  inlineSearch = true,
  menuSpan = 'field',
  menuWidth,
  tableVariant = 'default',
}: TableSearchSelectProps<T>) {
  const autoId = useId()
  const buttonId = id ?? autoId
  const listId = `${buttonId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focusIdx, setFocusIdx] = useState(0)
  const [page, setPage] = useState(1)
  // Same width as the field (or its whole form row); the hook keeps it on screen.
  const menuStyle = useFixedMenu(open, rootRef, {
    maxHeight: 360,
    width: menuWidth ? () => menuWidth : undefined,
    span: menuSpan === 'row' ? () => rootRef.current?.closest<HTMLElement>('.grid') ?? null : undefined,
  })
  const template = columns.map((column) => column.width ?? 'minmax(0,1fr)').join(' ')

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q || onQueryChange) return [...options]
    return options.filter((item) =>
      filterItem ? filterItem(item, query) : getLabel(item).toLowerCase().includes(q.toLowerCase()),
    )
  }, [options, query, filterItem, getLabel, onQueryChange])
  const visibleOptions = tableVariant === 'data-grid'
    ? filtered.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE)
    : filtered

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
    if (open) {
      const selectedIndex = filtered.findIndex((item) => selectedKey !== null && getKey(item) === selectedKey)
      const nextPage = !query.trim() && selectedIndex >= 0 && tableVariant === 'data-grid'
        ? Math.floor(selectedIndex / TABLE_PAGE_SIZE) + 1
        : 1
      setPage(nextPage)
      setFocusIdx(initialFocusIndex(filtered, selectedKey, getKey, Boolean(query.trim())))
    }
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
  // Inline search: closing (outside click, Escape, Tab) drops the typed text so the field shows the value again.
  useEffect(() => {
    if (inlineSearch && !open && query) updateQuery('')
    // Only when the list closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inlineSearch, open])

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

  function onListKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusIdx((idx) => {
        const first = tableVariant === 'data-grid' ? (page - 1) * TABLE_PAGE_SIZE : 0
        const end = tableVariant === 'data-grid' ? Math.min(page * TABLE_PAGE_SIZE, filtered.length) : filtered.length
        return idx + 1 >= end ? first : Math.max(first, idx + 1)
      })
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusIdx((idx) => {
        const first = tableVariant === 'data-grid' ? (page - 1) * TABLE_PAGE_SIZE : 0
        const end = tableVariant === 'data-grid' ? Math.min(page * TABLE_PAGE_SIZE, filtered.length) : filtered.length
        return idx - 1 < first ? Math.max(first, end - 1) : idx - 1
      })
    }
    if (event.key === 'Enter' && filtered[focusIdx]) {
      event.preventDefault()
      select(filtered[focusIdx])
    }
  }

  const clearOrChevron =
    value && clearable && !disabled ? (
      <IconTooltip label="Clear">
        <span
          role="button"
          tabIndex={-1}
          aria-label="Clear"
          className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded text-base leading-none text-ink-faint hover:bg-surface-hover hover:text-ink"
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
    )

  return (
    <div className="relative" ref={rootRef}>
      {inlineSearch ? (
        <div
          className={controlClass({ invalid, className: 'flex items-center justify-between gap-2' })}
          onClick={() => !disabled && setOpen(true)}
        >
          <input
            id={buttonId}
            type="text"
            role="combobox"
            autoComplete="off"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-invalid={invalid || undefined}
            // Closed: the selected label; open: what is typed, with the selected label as the hint.
            value={open ? query : value ? getLabel(value) : ''}
            placeholder={value ? getLabel(value) : placeholder}
            className="min-w-0 flex-1 truncate bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
            onFocus={() => !disabled && setOpen(true)}
            onChange={(event) => {
              updateQuery(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                setOpen(false)
                return
              }
              if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
                event.preventDefault()
                setOpen(true)
                return
              }
              onListKey(event)
            }}
          />
          {clearOrChevron}
        </div>
      ) : (
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        className={controlClass({ invalid, className: 'text-left flex items-center justify-between gap-2' })}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={onButtonKey}
      >
        <span className={value ? 'truncate text-[13px] text-ink' : 'truncate text-[13px] text-ink-faint'}>
          {value ? getLabel(value) : placeholder}
        </span>
        {clearOrChevron}
      </button>
      )}
      {open
        ? createPortal(
            <div
              id={listId}
              ref={panelRef}
              role="listbox"
              className={`flex flex-col overflow-hidden border border-line bg-surface ${tableVariant === 'data-grid' ? 'rounded-md' : 'rounded-xl'}`}
              style={{
                ...menuStyle,
                boxShadow: 'var(--shadow-overlay)',
              }}
              onKeyDown={onListKey}
            >
              {/* Search first, above the column headers (only without inline search). */}
              {inlineSearch ? null : (
                <div className="shrink-0 border-b border-line-subtle p-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center">
                      <SearchGlyph />
                    </span>
                    {/* Inline padding: `.form-input` (unlayered CSS) would otherwise override a `pl-*` class. */}
                    <input
                      autoFocus
                      type="search"
                      value={query}
                      onChange={(event) => updateQuery(event.target.value)}
                      placeholder={searchPlaceholder}
                      className={controlClass({ className: 'text-xs' })}
                      style={{ paddingLeft: '2.25rem' }}
                      aria-label={searchPlaceholder}
                    />
                  </div>
                </div>
              )}
              <div
                className={`grid shrink-0 ${tableVariant === 'data-grid' ? '' : 'gap-x-3 border-b border-line-subtle px-3 py-2'}`}
                style={{ gridTemplateColumns: template }}
              >
                {columns.map((column) => (
                  <span
                    key={column.header}
                    className={`${tableVariant === 'data-grid' ? 'box-border border-r border-line border-t border-b border-line px-3 py-2.5 text-xs font-bold text-ink-soft last:border-r-0' : 'text-[11px] font-bold text-ink-muted'} ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                    style={tableVariant === 'data-grid' ? { background: 'var(--color-surface-hover)' } : undefined}
                  >
                    {column.header}
                  </span>
                ))}
              </div>
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
                {loading && filtered.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-faint" role="status">Searching…</p>
                ) : filtered.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-faint">{emptyText}</p>
                ) : (
                  visibleOptions.map((item, pageIdx) => {
                    const idx = tableVariant === 'data-grid' ? (page - 1) * TABLE_PAGE_SIZE + pageIdx : pageIdx
                    const selected = selectedKey !== null && getKey(item) === selectedKey
                    return (
                    <button
                      key={getKey(item)}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      // Selected: tinted, bold, with a primary bar; the row under the pointer / arrow keys: hover tint.
                      className={`grid w-full items-center text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${tableVariant === 'data-grid' ? '' : 'gap-x-3 px-3 py-2'} ${
                        selected
                          ? 'bg-primary-soft shadow-[inset_3px_0_0_var(--color-primary)]'
                          : idx === focusIdx
                            ? 'bg-surface-hover'
                            : 'bg-surface'
                      }`}
                      style={{ gridTemplateColumns: template }}
                      onMouseEnter={() => setFocusIdx(idx)}
                      onClick={() => select(item)}
                    >
                      {columns.map((column, columnIdx) => {
                        const text = column.getValue(item)
                        const cell = (
                          <span
                            className={`min-w-0 ${tableVariant === 'data-grid' ? 'text-[12.5px]' : 'text-xs'} ${selected ? 'font-semibold text-primary' : tableVariant === 'data-grid' && columnIdx === 0 ? 'font-semibold text-ink' : 'text-ink'} ${column.truncate ? 'truncate whitespace-nowrap' : 'whitespace-nowrap'} ${
                              column.align === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {text}
                          </span>
                        )
                        return (
                          <span key={column.header} className={`min-w-0 ${tableVariant === 'data-grid' ? 'box-border border-r border-b border-line px-3 py-[9px] last:border-r-0' : ''}`}>
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
                    )
                  })
                )}
              </div>
              {action ? (
                <button
                  type="button"
                  className="flex w-full shrink-0 items-center gap-2 border-t border-line-subtle px-3 py-2.5 text-left text-xs font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                  onClick={() => {
                    setOpen(false)
                    action.onSelect()
                  }}
                >
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {action.label}
                </button>
              ) : null}
              {footer ? (
                <div className="shrink-0 border-t border-line-subtle px-3 py-1.5 text-[11px] text-ink-faint">{footer}</div>
              ) : null}
              {tableVariant === 'data-grid' && filtered.length > 0 ? (
                <div className="shrink-0 border-t border-line px-3 py-2.5">
                  <Pagination
                    page={page}
                    pageSize={TABLE_PAGE_SIZE}
                    total={filtered.length}
                    onPageChange={(nextPage) => {
                      setPage(nextPage)
                      setFocusIdx((nextPage - 1) * TABLE_PAGE_SIZE)
                    }}
                  />
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
