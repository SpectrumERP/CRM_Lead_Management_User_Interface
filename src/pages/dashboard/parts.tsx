import type { ReactNode } from 'react'
import { ErrorState, SkeletonTableRows } from '../../components/CRMStates'
import { Card } from '../../ui'
import type { AttentionReason } from '../../data/dashboard'
import { formatDate } from '../../utils/dateFormat'

interface SectionProps {
  id: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Rows shown by the loading skeleton. */
  skeletonRows?: number
  children: ReactNode
}

/** One dashboard area: its own loading skeleton and error + Retry, so other areas stay usable. */
export function Section({ id, title, subtitle, actions, loading, error, onRetry, skeletonRows = 4, children }: SectionProps) {
  return (
    <Card className="min-w-0 p-4 lg:p-5" aria-labelledby={id} aria-busy={loading || undefined}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={id} className="font-display text-sm font-bold text-ink">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {error ? (
        <ErrorState title={`Could not load ${title.toLowerCase()}`} message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="table-scroll">
          <table className="crm-table" aria-hidden="true">
            <tbody>
              <SkeletonTableRows rows={skeletonRows} cols={5} />
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  )
}

/** Friendly empty state inside a section. */
export function SectionEmpty({ title, subtitle, positive = false }: { title: string; subtitle?: string; positive?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <span
        className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full ${positive ? 'bg-success-soft text-success' : 'bg-surface-hover text-ink-muted'}`}
        aria-hidden="true"
      >
        {positive ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path strokeLinecap="round" d="M8 3v4M16 3v4M4 10h16" />
          </svg>
        )}
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {subtitle ? <p className="mt-0.5 max-w-xs text-xs text-ink-muted">{subtitle}</p> : null}
    </div>
  )
}

const REASON_CLASS: Record<AttentionReason, string> = {
  'Activity Overdue': 'border-accent/30 bg-accent-soft text-accent',
  'Not Started': 'border-warning-line bg-warning-soft text-warning',
  Stagnant: 'border-purple-line bg-purple-soft text-purple',
}
const OTHER_REASON_CLASS = 'border-line bg-surface-hover text-ink-soft'

/** Server reason text ("Activity Overdue", "NotStarted", "stagnant" …) → a known reason, else the text itself. */
export function normalizeReason(reason: string): AttentionReason | string {
  const key = reason.replace(/[\s_-]+/g, '').toLowerCase()
  if (key.includes('overdue')) return 'Activity Overdue'
  if (key.includes('notstarted') || key.includes('noactivity')) return 'Not Started'
  if (key.includes('stagnant')) return 'Stagnant'
  return reason
}

const isKnown = (reason: string): reason is AttentionReason => reason in REASON_CLASS

/** Wording from the workbook: leads say "Stagnant Lead", opportunities "Stagnant". */
export function reasonLabel(reason: string, record: 'lead' | 'opportunity') {
  return reason === 'Stagnant' && record === 'lead' ? 'Stagnant Lead' : reason
}

/** Same colours for a reason in the Lead and Opportunity sections. */
export function ReasonBadges({ reasons, record = 'opportunity' }: { reasons: readonly string[]; record?: 'lead' | 'opportunity' }) {
  if (reasons.length === 0) return <span className="text-ink-faint">—</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {reasons.map((r) => (
        <span key={r} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${isKnown(r) ? REASON_CLASS[r] : OTHER_REASON_CLASS}`}>
          {reasonLabel(r, record)}
        </span>
      ))}
    </span>
  )
}

/** Overdue first, then not started, then stagnant — the order rows are highlighted by. */
export const REASON_RANK: Record<AttentionReason, number> = { 'Activity Overdue': 0, 'Not Started': 1, Stagnant: 2 }

export function reasonSortValue(reasons: readonly string[]) {
  return reasons.length ? Math.min(...reasons.map((r) => (isKnown(r) ? REASON_RANK[r] : 3))) : 4
}

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>
}

/** Name that opens its record; stops the row click so it does not also fire. */
export function RecordLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="max-w-[16rem] truncate text-left font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      title={label}
    >
      {label}
    </button>
  )
}

/** Date of a pending activity, red when it is past (or when the server marks it overdue). */
export function DueDate({ date, todayIso, overdue: flagged }: { date?: string | null; todayIso: string; overdue?: boolean }) {
  if (!date) return <span className="text-ink-faint">—</span>
  const overdue = flagged ?? date.slice(0, 10) < todayIso
  return <span className={overdue ? 'font-semibold text-accent' : undefined}>{formatDate(date)}</span>
}

/** `Today`, `1 day`, `2 days`. */
export function days(n: number | null) {
  if (n === null) return '—'
  if (n === 0) return 'Today'
  return `${n} ${n === 1 ? 'day' : 'days'}`
}
