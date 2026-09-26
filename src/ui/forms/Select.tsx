import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { controlClass } from './controlClass'
import { sortByLabel, type FormOption } from './options'
import { useFixedMenu } from './useFixedMenu'

export interface SelectProps {
  id?: string
  name?: string
  options: readonly (string | FormOption)[]
  value?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  className?: string
  size?: 'md' | 'compact'
  /** Keep options in the given order (skip A–Z sort). */
  preserveOrder?: boolean
  /** Extra classes on the root `.menu-select` wrapper (e.g. width overrides). */
  rootClassName?: string
  onValueChange?: (value: string) => void
  'aria-label'?: string
}

function toItem(option: string | FormOption): FormOption {
  return typeof option === 'string' ? { value: option, label: option } : option
}

export function Select({
  id,
  name,
  options,
  value = '',
  placeholder,
  invalid,
  disabled,
  className = '',
  size = 'md',
  preserveOrder = false,
  rootClassName = '',
  onValueChange,
  'aria-label': ariaLabel,
}: SelectProps) {
  const autoId = useId()
  const buttonId = id ?? autoId
  const listId = `${buttonId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const items = useMemo(() => {
    const mapped = options.map(toItem)
    return preserveOrder ? mapped : sortByLabel(mapped)
  }, [options, preserveOrder])
  const selected = items.find((item) => item.value === value)
  const label = selected?.label ?? placeholder ?? ''
  const empty = !selected || selected.value === ''
  const [focusIdx, setFocusIdx] = useState(() => Math.max(0, items.findIndex((item) => item.value === value)))
  const menuStyle = useFixedMenu(open, rootRef)

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!open) return
    const idx = Math.max(0, items.findIndex((item) => item.value === value))
    setFocusIdx(idx)
    const frame = window.requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-option-index="${idx}"]`)?.scrollIntoView({ block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
    // Snap once when the menu opens — avoid re-scroll on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function pick(item: FormOption) {
    if (item.disabled) return
    onValueChange?.(item.value)
    setOpen(false)
  }

  function moveFocus(next: number) {
    const count = items.length
    if (!count) return
    let idx = ((next % count) + count) % count
    for (let i = 0; i < count; i += 1) {
      if (!items[idx]?.disabled) {
        setFocusIdx(idx)
        const el = listRef.current?.querySelector<HTMLElement>(`[data-option-index="${idx}"]`)
        el?.scrollIntoView({ block: 'nearest' })
        return
      }
      idx = (idx + 1) % count
    }
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
      moveFocus(focusIdx + 1)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(focusIdx - 1)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      moveFocus(0)
    }
    if (event.key === 'End') {
      event.preventDefault()
      moveFocus(items.length - 1)
    }
    if (event.key === 'Enter' && items[focusIdx]) {
      event.preventDefault()
      pick(items[focusIdx])
    }
  }

  return (
    <div
      className={`menu-select relative ${size === 'compact' ? 'menu-select-compact' : ''} ${rootClassName}`.trim()}
      ref={rootRef}
    >      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        data-active={empty ? undefined : 'true'}
        className={controlClass({
          invalid,
          className: `menu-select-trigger text-left flex items-center justify-between gap-2 ${className}`.trim(),
        })}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={onButtonKey}
      >
        <span className={`min-w-0 truncate ${empty ? 'text-ink-muted font-medium' : 'text-ink font-semibold'}`}>
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
              tabIndex={-1}
              aria-labelledby={buttonId}
              className="menu-select-panel flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
              style={menuStyle}
              onKeyDown={onListKey}
            >
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {items.map((item, idx) => {
                  const active = item.value === value
                  const focused = idx === focusIdx
                  return (
                    <button
                      key={`${item.value}-${idx}`}
                      type="button"
                      role="option"
                      data-option-index={idx}
                      aria-selected={active}
                      disabled={item.disabled}
                      className={`menu-select-option flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                        focused ? 'is-focused' : ''
                      } ${active ? 'is-selected' : ''}`}
                      onMouseEnter={() => setFocusIdx(idx)}
                      onClick={() => pick(item)}
                    >
                      <span className="min-w-0 truncate text-xs font-semibold">{item.label}</span>
                      {active ? (
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} className="shrink-0" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
