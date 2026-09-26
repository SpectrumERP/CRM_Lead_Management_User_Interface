import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { sortAlpha } from './options'
import { createPortal } from 'react-dom'
import { Checkbox } from './Checkbox'
import { controlClass } from './controlClass'
import { useFixedMenu } from './useFixedMenu'

export interface MultiSelectProps {
  options: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  size?: 'md' | 'compact'
  'aria-label'?: string
}

/** Compact multi-select listbox. Used for column filters (e.g. Deal Stage). */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'All',
  disabled,
  className = '',
  size = 'md',
  'aria-label': ariaLabel,
}: MultiSelectProps) {
  const autoId = useId()
  const listId = `${autoId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const menuStyle = useFixedMenu(open, rootRef)
  const sortedOptions = useMemo(() => sortAlpha(options), [options])
  const selected = new Set(value)
  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value.length} selected`

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function toggle(option: string) {
    if (selected.has(option)) onChange(value.filter((item) => item !== option))
    else onChange([...value, option])
  }

  return (
    <div className={`menu-select relative ${size === 'compact' ? 'menu-select-compact' : ''}`} ref={rootRef}>
      <button
        id={autoId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        data-active={value.length ? 'true' : undefined}
        className={controlClass({
          className: `menu-select-trigger text-left flex items-center justify-between gap-2 ${className}`.trim(),
        })}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <span className={`min-w-0 truncate ${value.length ? 'text-ink font-semibold' : 'text-ink-muted font-medium'}`}>
          {label}
        </span>
        <svg
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          className={`shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div
              id={listId}
              ref={listRef}
              role="listbox"
              aria-multiselectable="true"
              className="menu-select-panel flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
              style={menuStyle}
            >
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
                {sortedOptions.map((option) => (
                  <Checkbox
                    key={option}
                    label={option}
                    checked={selected.has(option)}
                    onCheckedChange={() => toggle(option)}
                  />
                ))}
              </div>
              {value.length > 0 ? (
                <div className="shrink-0 border-t border-line-subtle px-3 py-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    onClick={() => onChange([])}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
