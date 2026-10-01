import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconTooltip } from '../ui'

export interface GridColumn<K extends string = string> {
  key: K
  label: string
  /** Always shown (e.g. the record code and Actions); listed but not toggleable. */
  locked?: boolean
}

function readHidden(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

/**
 * Which grid columns are shown. Hidden keys are remembered per browser under `storageKey`
 * (a per-viewer preference, so local storage is enough). Locked columns are always visible.
 */
export function useColumnVisibility<C extends GridColumn>(storageKey: string, columns: readonly C[]) {
  type K = C['key']
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(storageKey))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...hidden]))
    } catch {
      // Storage blocked — the choice just won't survive a reload.
    }
  }, [storageKey, hidden])

  const lockedKeys = useMemo(() => new Set(columns.filter((c) => c.locked).map((c) => c.key as string)), [columns])

  const isVisible = useCallback((key: K) => lockedKeys.has(key) || !hidden.has(key), [hidden, lockedKeys])

  const toggle = useCallback(
    (key: K) => {
      if (lockedKeys.has(key)) return
      setHidden((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    [lockedKeys],
  )

  const showAll = useCallback(() => setHidden(new Set()), [])
  const visibleColumns = columns.filter((c) => isVisible(c.key))
  const hiddenCount = columns.length - visibleColumns.length

  return { isVisible, toggle, showAll, visibleColumns, hiddenCount }
}

export interface ColumnVisibilityMenuProps<K extends string> {
  columns: readonly GridColumn<K>[]
  isVisible: (key: K) => boolean
  onToggle: (key: K) => void
  onShowAll: () => void
  hiddenCount: number
}

/** "Columns" button (for the Actions header) with a checklist to hide / show grid columns. */
export function ColumnVisibilityMenu<K extends string>({ columns, isVisible, onToggle, onShowAll, hiddenCount }: ColumnVisibilityMenuProps<K>) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const menu = menuRef.current
    const margin = 8
    let left = trigger.right - menu.offsetWidth
    if (left < margin) left = margin
    if (left + menu.offsetWidth > window.innerWidth - margin) left = window.innerWidth - margin - menu.offsetWidth
    let top = trigger.bottom + 6
    if (top + menu.offsetHeight > window.innerHeight - margin) top = Math.max(margin, trigger.top - menu.offsetHeight - 6)
    menu.style.top = `${top}px`
    menu.style.left = `${left}px`
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onScroll(e: Event) {
      // Scrolling the list itself keeps it open; scrolling the page / grid closes it.
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onResize() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <>
      <IconTooltip label={hiddenCount ? `Show / hide columns (${hiddenCount} hidden)` : 'Show / hide columns'}>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Show or hide columns"
          aria-haspopup="true"
          aria-expanded={open}
          className={`btn-icon relative ${hiddenCount ? 'text-primary' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M9 4v16M9 4h6M9 20h6m0-16h4a1 1 0 011 1v14a1 1 0 01-1 1h-4m0-16v16" />
          </svg>
          {hiddenCount ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold leading-none text-surface">
              {hiddenCount}
            </span>
          ) : null}
        </button>
      </IconTooltip>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Show or hide columns"
            className="fixed z-50 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-overlay"
          >
            <div className="flex items-center justify-between border-b border-line-subtle px-3 py-2">
              <p className="text-xs font-bold text-ink">Columns</p>
              <button
                type="button"
                className="text-[11px] font-semibold text-primary hover:underline disabled:text-ink-faint disabled:no-underline"
                disabled={!hiddenCount}
                onClick={onShowAll}
              >
                Show all
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {columns.map((column) => {
                const checked = isVisible(column.key)
                return (
                  <li key={column.key}>
                    <label
                      className={`flex items-center gap-2.5 px-3 py-1.5 text-xs ${
                        column.locked ? 'cursor-not-allowed text-ink-faint' : 'cursor-pointer text-ink hover:bg-surface-hover'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={column.locked}
                        onChange={() => onToggle(column.key)}
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold">{column.label}</span>
                      {column.locked ? <span className="text-[10px]">Always</span> : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
