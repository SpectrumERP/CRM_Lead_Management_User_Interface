import { useEffect, useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { BusinessCardData } from '../../api/businessCard'
import { Field, TextInput } from '../../ui'
import { useFixedMenu } from '../../ui/forms/useFixedMenu'
import { ICON, Icon } from '../../pages/businessEntities/ui'
import { entryLines, timeAgo, useClipboardEntries, type ClipboardEntry } from './clipboardStore'

const CLIPBOARD_COPY =
  'M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2 M16 4h2a2 2 0 012 2v4 M21 14H11 M15 10l-4 4 4 4'
const CLIPBOARD_PASTE =
  'M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2 M16 4h2a2 2 0 012 2v2 M11 14h10 M17 10l4 4-4 4'

const MENU_WIDTH = 256
const SUBMENU_WIDTH = 224

export interface ClipboardFieldProps {
  label: string
  /** Short name on the "Paste …" button, e.g. "Name" for "Contact Person Name". */
  pasteLabel: string
  /** Card value that "Paste …" puts in. */
  field: keyof BusinessCardData
  value: string
  onValueChange: (value: string) => void
  fieldClassName?: string
}

/** One scanned card in the history: click lines to build a value, or paste the card's own value for this field. */
function EntryView({ entry, field, pasteLabel, onSelect }: {
  entry: ClipboardEntry
  field: keyof BusinessCardData
  pasteLabel: string
  onSelect: (text: string | undefined, close: boolean) => void
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const lines = useMemo(() => entryLines(entry.formattedText), [entry.formattedText])

  function toggle(index: number) {
    const next = new Set(selected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelected(next)
    if (next.size > 0) onSelect([...next].sort((a, b) => a - b).map((i) => lines[i]).join(', '), false)
  }

  return (
    <div className="border-b border-line p-3 transition-colors last:border-b-0 hover:bg-surface-muted">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="max-w-[180px] truncate text-xs font-semibold text-ink">{entry.data.name || 'Unknown Name'}</span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] text-ink-faint">
          <Icon d={ICON.clock} size={12} />
          {timeAgo(entry.timestamp)}
        </span>
      </div>
      <div className="mb-2 w-full overflow-hidden rounded-lg border border-line bg-surface font-mono text-[11px]">
        {lines.map((line, index) => (
          <button
            key={index}
            type="button"
            onClick={() => toggle(index)}
            className={`block w-full cursor-pointer select-none whitespace-pre-wrap break-words border-b border-line px-2 py-1.5 text-left transition-colors last:border-b-0 focus:outline-none ${
              selected.has(index) ? 'bg-primary-soft font-medium text-primary' : 'text-ink hover:bg-surface-hover focus:bg-surface-hover'
            }`}
          >
            {line}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        {selected.size > 0 ? (
          <button
            type="button"
            className="inline-flex h-6 items-center rounded-md bg-primary-soft px-2 text-[11px] font-semibold text-primary hover:brightness-95"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(undefined, true)
            }}
          >
            Done
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-muted px-2 text-[11px] font-semibold text-ink hover:bg-surface-hover"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(entry.data[field] || entry.formattedText, true)
          }}
        >
          <Icon d={CLIPBOARD_PASTE} size={12} />
          Paste {pasteLabel}
        </button>
      </div>
    </div>
  )
}

/**
 * Text field with Task Management's business card clipboard: copy the value, pick from the history of
 * scanned cards (hover buttons), or right-click for Copy / Paste / Clipboard History.
 */
export default function ClipboardField({ label, pasteLabel, field, value, onValueChange, fieldClassName }: ClipboardFieldProps) {
  const id = useId()
  const entries = useClipboardEntries()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const panelStyle = useFixedMenu(open, rootRef, { width: () => 384, maxHeight: 448, align: 'end' })

  // Outside click or Escape closes the history and the context menu.
  useEffect(() => {
    if (!open && !menu) return
    function onDown(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || menuRef.current?.contains(target)) return
      if (open && rootRef.current?.contains(target)) return
      setOpen(false)
      setMenu(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      setMenu(null)
    }
    const closeMenu = () => setMenu(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    if (menu) window.addEventListener('scroll', closeMenu, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [open, menu])

  function copy() {
    if (value) void navigator.clipboard?.writeText(value)
    setMenu(null)
  }

  async function paste() {
    setMenu(null)
    try {
      onValueChange(await navigator.clipboard.readText())
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err)
    }
  }

  function openMenu(event: ReactMouseEvent) {
    event.preventDefault()
    setOpen(false)
    setMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - MENU_WIDTH - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 140)),
    })
  }

  const subOnLeft = menu ? menu.x + MENU_WIDTH + SUBMENU_WIDTH > window.innerWidth - 8 : false
  const menuItem = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-surface-hover'

  return (
    <Field label={label} htmlFor={id} className={fieldClassName}>
      <div id={`${id}-wrap`} ref={rootRef} className="group relative" onContextMenu={openMenu}>
        <TextInput id={id} value={value} onValueChange={onValueChange} className="!pr-16" />
        <div className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${open ? 'opacity-100' : 'opacity-0'}`}>
          <button
            type="button"
            onClick={copy}
            className="rounded p-1 text-ink-faint hover:bg-surface-hover hover:text-ink"
            title="Copy value"
            aria-label={`Copy ${pasteLabel}`}
          >
            <Icon d={CLIPBOARD_COPY} size={15} />
          </button>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="rounded p-1 text-ink-faint hover:bg-surface-hover hover:text-ink"
            title="Clipboard history"
            aria-label="Clipboard history"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Icon d={ICON.chevronDown} size={15} />
          </button>
        </div>
      </div>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Clipboard history"
              className="menu-select-panel flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
              style={panelStyle}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface-muted px-3 py-2">
                <span className="text-xs font-semibold text-ink">Clipboard History</span>
                <span className="text-xs text-ink-faint">{entries.length} entries</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {entries.length === 0 ? (
                  <div className="p-4 text-center text-xs text-ink-faint">No history available.</div>
                ) : (
                  entries.map((entry) => (
                    <EntryView
                      key={entry.id}
                      entry={entry}
                      field={field}
                      pasteLabel={pasteLabel}
                      onSelect={(text, close) => {
                        if (text) onValueChange(text)
                        if (close) setOpen(false)
                      }}
                    />
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      {menu
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="menu-select-panel fixed z-[80] rounded-xl border border-line bg-surface p-1"
              style={{ left: menu.x, top: menu.y, width: MENU_WIDTH }}
            >
              <button type="button" role="menuitem" className={menuItem} onClick={copy}>
                <Icon d={CLIPBOARD_COPY} size={16} /> Copy
              </button>
              <button type="button" role="menuitem" className={menuItem} onClick={() => void paste()}>
                <Icon d={CLIPBOARD_PASTE} size={16} /> Paste
              </button>
              <div className="my-1 h-px bg-line" />
              <div className="group/sub relative">
                <button type="button" role="menuitem" aria-haspopup="menu" className={menuItem}>
                  <Icon d={ICON.clock} size={16} /> Clipboard History
                  <Icon d={ICON.chevronRight} size={14} className="ml-auto text-ink-faint" />
                </button>
                <div
                  role="menu"
                  className={`menu-select-panel absolute top-0 hidden max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 group-hover/sub:block group-focus-within/sub:block ${subOnLeft ? 'right-full mr-1' : 'left-full ml-1'}`}
                  style={{ width: SUBMENU_WIDTH }}
                >
                  {entries.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-ink-faint">No entries</div>
                  ) : (
                    entries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="menuitem"
                        className={menuItem}
                        onClick={() => {
                          const text = entry.data[field] || entry.data.name || entry.formattedText.substring(0, 50)
                          if (text) onValueChange(text)
                          setMenu(null)
                        }}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-xs font-semibold">{entry.data.name || 'Entry'}</span>
                          <span className="truncate text-[10px] text-ink-faint">{entry.data.company || 'Unknown'}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </Field>
  )
}
