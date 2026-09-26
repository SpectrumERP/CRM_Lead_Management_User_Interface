import { useEffect, useRef, useState } from 'react'
import { useQuickCreate, type QuickCreateKind } from '../contexts/QuickCreateContext'
import { IconTooltip } from '../ui'

const ITEMS: { kind: QuickCreateKind; label: string; hint: string; tone: string }[] = [
  { kind: 'lead', label: 'New Lead', hint: 'Add a pipeline record', tone: 'text-accent bg-accent-soft' },
  { kind: 'opportunity', label: 'Create Opportunity', hint: 'Add a sales deal', tone: 'text-primary bg-primary-soft' },
  { kind: 'entity', label: 'New Business Entity', hint: 'Company or prospect', tone: 'text-success-strong bg-success-soft' },
  { kind: 'contact', label: 'New Contact', hint: 'Person at an entity', tone: 'text-purple bg-purple-soft' },
  { kind: 'activity', label: 'New Activity', hint: 'Call, task or follow-up', tone: 'text-teal bg-teal-soft' },
  { kind: 'meeting', label: 'New Meeting', hint: 'Schedule a discussion', tone: 'text-success bg-success-soft' },
  { kind: 'note', label: 'New Note', hint: 'Capture internal context', tone: 'text-warning bg-warning-soft' },
  { kind: 'document', label: 'Upload Document', hint: 'Attach a file', tone: 'text-ink-soft bg-surface-hover' },
]

export default function QuickCreateMenu() {
  const { open } = useQuickCreate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  function closeMenu() {
    if (!menuOpen) return
    if (rootRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus()
    }
    setMenuOpen(false)
  }

  function openMenu() {
    setMenuOpen(true)
    setFocusIdx(0)
  }

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeMenu()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (menuOpen) itemRefs.current[focusIdx]?.focus()
  }, [menuOpen, focusIdx])

  function choose(kind: QuickCreateKind) {
    closeMenu()
    open(kind)
  }

  return (
    <div className="relative" ref={rootRef}>
      <IconTooltip label={menuOpen ? 'Close menu' : 'Quick create'}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Close quick create' : 'Quick create'}
        onClick={() => { if (menuOpen) closeMenu(); else openMenu() }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            openMenu()
          }
        }}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-[background-color,border-color,color,transform] duration-200 ease-out lg:h-8 lg:w-8 hover:border-primary active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          menuOpen
            ? 'border-primary bg-primary text-surface hover:border-primary-hover hover:bg-primary-hover'
            : 'border-line-strong bg-primary-soft text-primary'
        }`}
      >
        <svg
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
          className={`transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            menuOpen ? 'rotate-45' : 'rotate-0'
          }`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      </IconTooltip>
      <div
        role="menu"
        aria-label="Quick create"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        className={`absolute right-0 top-full z-50 mt-2 w-[min(16.25rem,calc(100vw-1rem))] origin-top-right overflow-hidden rounded-xl border border-line bg-surface shadow-overlay transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          menuOpen
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1.5 scale-95 opacity-0'
        }`}
      >
          <div className="border-b border-surface-hover px-3 py-2">
            <p className="ui-title text-xs">Quick Create</p>
            <p className="ui-subtitle text-xs">Stay on this page</p>
          </div>
          {ITEMS.map((item, idx) => (
            <button
              key={item.kind}
              ref={(el) => { itemRefs.current[idx] = el }}
              type="button"
              role="menuitem"
              tabIndex={menuOpen && focusIdx === idx ? 0 : -1}
              onClick={() => choose(item.kind)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx((idx + 1) % ITEMS.length) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx((idx - 1 + ITEMS.length) % ITEMS.length) }
                if (e.key === 'Home') { e.preventDefault(); setFocusIdx(0) }
                if (e.key === 'End') { e.preventDefault(); setFocusIdx(ITEMS.length - 1) }
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(item.kind) }
              }}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                focusIdx === idx ? 'bg-primary-soft' : 'bg-surface hover:bg-surface-hover'
              }`}
              onMouseEnter={() => setFocusIdx(idx)}
            >
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${item.tone}`}>+</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink">{item.label}</span>
                <span className="block text-xs text-ink-faint">{item.hint}</span>
              </span>
            </button>
          ))}
      </div>
    </div>
  )
}
