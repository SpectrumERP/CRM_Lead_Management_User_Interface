import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconTooltip } from '../ui'
import { paths, taskAppUrl } from '../app/paths'
import { prerenderApp } from '../app/prefetch'

/**
 * Spectrum ERP module launcher (the "waffle" next to the sidebar toggle) — Microsoft 365 style.
 * Add a future ERP module by adding one entry to MODULES; Task Management has the same list
 * (src/components/layout/ModuleLauncher.tsx there) — keep the two in step.
 */
interface ErpModule {
  id: string
  label: string
  description: string
  /** Tile colour (CRM palette). */
  color: string
  icon: ReactNode
  /** In-app route (this CRM) or a full URL / path of another app on this origin. */
  to: string
  /** Another app: open with a full page load (and prerender on hover). */
  external?: boolean
}

const glyph = {
  width: 22,
  height: 22,
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const MODULES: ErpModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Overview and KPIs',
    color: '#1E56A0',
    to: paths.dashboard,
    icon: (
      <svg {...glyph}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'crm',
    label: 'CRM',
    description: 'Leads, opportunities, contacts',
    color: '#0e7490',
    to: paths.leads,
    icon: (
      <svg {...glyph}>
        {/* Handshake — the CRM icon in the sidebar (lucide "handshake") */}
        <path d="m11 17 2 2a1 1 0 1 0 3-3" />
        <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
        <path d="m21 3 1 11h-2" />
        <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
        <path d="M3 4h8" />
      </svg>
    ),
  },
  {
    id: 'task',
    label: 'Task',
    description: 'Tasks, meetings, reports',
    color: '#7c3aed',
    to: taskAppUrl,
    external: true,
    icon: (
      <svg {...glyph}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    ),
  },
]

function WaffleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {[2, 8, 14].flatMap((y) => [2, 8, 14].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />))}
    </svg>
  )
}

export default function ModuleLauncher({ activeModule }: { activeModule: 'dashboard' | 'crm' }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MODULES
    return MODULES.filter((m) => `${m.label} ${m.description}`.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function openModule(m: ErpModule) {
    setOpen(false)
    setQuery('')
    if (m.external) {
      window.location.assign(m.to)
      return
    }
    navigate(m.to)
  }

  return (
    <div ref={rootRef} className="relative">
      <IconTooltip label="Spectrum ERP apps">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Spectrum ERP apps"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-primary transition-[background-color,border-color,transform] duration-200 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            open ? 'border-primary bg-primary-soft' : 'border-line-strong bg-primary-soft hover:border-primary'
          }`}
        >
          <WaffleIcon />
        </button>
      </IconTooltip>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Spectrum ERP apps"
          data-state="open"
          className="crm-menu-anim absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-overlay"
          style={{ transformOrigin: 'top left' }}
        >
          <div className="border-b border-line-subtle p-3">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
                width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find Spectrum ERP apps"
                aria-label="Find Spectrum ERP apps"
                className="w-full rounded-lg border border-line bg-surface-hover py-1.5 pl-8 pr-3 text-xs text-ink outline-none transition-colors focus:border-primary focus:bg-surface focus-visible:shadow-[var(--shadow-focus)]"
              />
            </div>
          </div>

          <div className="p-3">
            <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Apps</p>
            {shown.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-ink-muted">No apps match “{query.trim()}”.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-1">
                {shown.map((m) => {
                  const current = m.id === activeModule
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => openModule(m)}
                        onPointerEnter={m.external ? () => prerenderApp(m.to) : undefined}
                        onFocus={m.external ? () => prerenderApp(m.to) : undefined}
                        aria-current={current ? 'page' : undefined}
                        title={m.description}
                        className={`flex w-full flex-col items-center gap-2 rounded-lg px-2 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          current ? 'bg-primary-soft' : 'hover:bg-surface-hover'
                        }`}
                      >
                        <span
                          className="grid h-11 w-11 place-items-center rounded-xl text-white shadow-sm"
                          style={{ backgroundImage: `linear-gradient(135deg, ${m.color}, color-mix(in srgb, ${m.color} 70%, #0c1a3a))` }}
                        >
                          {m.icon}
                        </span>
                        <span className={`text-[12.5px] font-semibold ${current ? 'text-primary' : 'text-ink'}`}>{m.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
