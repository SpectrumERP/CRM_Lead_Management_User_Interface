import { PAGE_COPY } from '../constants/messages'
import { Skeleton } from '../ui'

// ── Simulated load hook ──────────────────────────────────────────────────────
export function useSimulatedLoad(_delayMs = 650) {
  return false
}

// ── Skeleton table rows ───────────────────────────────────────────────────────
const WIDTHS = [42, 68, 55, 72, 38, 50, 62, 44, 58, 48, 65, 36, 53, 70, 46]

export function SkeletonTableRows({
  cols,
  rows = 6,
}: {
  cols: number
  rows?: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} style={{ pointerEvents: "none" }}>
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} style={{ padding: "12px" }}>
              <Skeleton
                className=""
                style={{
                  height: 10,
                  width: `${WIDTHS[(ri * 7 + ci) % WIDTHS.length]}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Skeleton stat cards ───────────────────────────────────────────────────────
export function SkeletonStatCards({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-line bg-surface p-4"
        >
          <Skeleton
            className=""
            style={{ height: 9, width: "52%", marginBottom: 10 }}
          />
          <Skeleton
            className=""
            style={{ height: 26, width: "35%", marginBottom: 8 }}
          />
          <Skeleton className="" style={{ height: 9, width: "45%" }} />
        </div>
      ))}
    </>
  )
}

// ── Skeleton pipeline rows ────────────────────────────────────────────────────
export function SkeletonPipelineRows({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton
            className="flex-shrink-0"
            style={{ height: 10, width: 130 }}
          />
          <Skeleton
            className="flex-1"
            style={{ height: 24, borderRadius: 8 }}
          />
          <Skeleton
            className="flex-shrink-0"
            style={{ height: 10, width: 70 }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Skeleton activity list ────────────────────────────────────────────────────
export function SkeletonActivityList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-2.5">
          <Skeleton
            className="flex-shrink-0"
            style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 4 }}
          />
          <div className="space-y-1.5 flex-1">
            <Skeleton
              className=""
              style={{ height: 10, width: `${60 + ((i * 13) % 30)}%` }}
            />
            <Skeleton className="" style={{ height: 9, width: "50%" }} />
            <Skeleton className="" style={{ height: 9, width: "40%" }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Skeleton kanban card ──────────────────────────────────────────────────────
export function SkeletonKanbanCard() {
  return (
    <div
      className="rounded-xl border border-line bg-surface p-3"
    >
      <div className="flex items-start justify-between mb-2.5">
        <Skeleton className="" style={{ height: 11, width: "60%" }} />
        <Skeleton
          className=""
          style={{ height: 16, width: 44, borderRadius: 99 }}
        />
      </div>
      <Skeleton
        className=""
        style={{ height: 9, width: "45%", marginBottom: 6 }}
      />
      <Skeleton
        className=""
        style={{ height: 9, width: "70%", marginBottom: 10 }}
      />
      <div className="flex justify-between">
        <Skeleton className="" style={{ height: 11, width: "40%" }} />
        <Skeleton className="" style={{ height: 9, width: "20%" }} />
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div
        className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center flex-shrink-0"
        style={{ background: "#eef3fc" }}
      >
        {icon}
      </div>
      <p
        className="text-sm font-bold mb-0.5"
        style={{ color: "#0c1a3a", fontFamily: "DM Sans, sans-serif" }}
      >
        {title}
      </p>
      {subtitle && (
        <p
          className="text-xs mt-1 mb-4 leading-relaxed"
          style={{ color: "#94a3b8", maxWidth: 280 }}
        >
          {subtitle}
        </p>
      )}
      {action && !subtitle && <div className="mb-4" />}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
          style={{
            background: "#2955a3",
            boxShadow: "0 2px 6px rgba(41,85,163,0.25)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1e3f87")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#2955a3")}
        >
          <svg
            width="11"
            height="11"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          {action.label}
        </button>
      )}
    </div>
  )
}

// ── No Results State ──────────────────────────────────────────────────────────
export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className="w-11 h-11 rounded-xl mb-3 flex items-center justify-center flex-shrink-0"
        style={{ background: "#f0f4fb" }}
      >
        <svg
          width="18"
          height="18"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#94a3b8"
          strokeWidth={1.5}
        >
          <circle cx="11" cy="11" r="8" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h6" />
        </svg>
      </div>
      <p className="text-sm font-semibold mb-0.5" style={{ color: "#0c1a3a" }}>
        No matching records found
      </p>
      <p className="text-xs mb-4" style={{ color: "#94a3b8" }}>
        Try adjusting your search or clearing the filters
      </p>
      <button
        onClick={onClear}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        style={{
          color: "#c41e1e",
          background: "#fff5f5",
          border: "1px solid #fdd",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe4e4")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff5f5")}
      >
        Clear Filters
      </button>
    </div>
  )
}

// ── Error State ───────────────────────────────────────────────────────────────
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
}: {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div
        className="mb-4 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, #fff5f5 0%, #ffe8e8 100%)',
          border: '1px solid #f5c8c8',
          boxShadow: '0 6px 16px rgba(196, 30, 30, 0.08)',
        }}
        aria-hidden
      >
        <svg
          width="22"
          height="22"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#c41e1e"
          strokeWidth={1.6}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      </div>
      <p className="mb-1 text-base font-bold text-ink">{title ?? PAGE_COPY.errorState.title}</p>
      <p className="mb-5 max-w-[18rem] text-xs leading-relaxed text-ink-muted">
        {message ?? PAGE_COPY.errorState.fallback}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors"
          style={{
            background: '#2955a3',
            boxShadow: '0 2px 6px rgba(41, 85, 163, 0.25)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1e3f87'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#2955a3'
          }}
        >
          <svg
            width="12"
            height="12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

// ── Icon presets for EmptyState ───────────────────────────────────────────────
export const EmptyIcons = {
  leads: (
    <svg
      width="22"
      height="22"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#2955a3"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  entities: (
    <svg
      width="22"
      height="22"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#2955a3"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M9 21V7l6-4v18M9 11H3v10M15 21V11h6v10"
      />
    </svg>
  ),
  contacts: (
    <svg
      width="22"
      height="22"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#2955a3"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  activities: (
    <svg
      width="22"
      height="22"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#2955a3"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  ),
  meetings: (
    <svg
      width="22"
      height="22"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#2955a3"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  timeline: (
    <svg
      width="22"
      height="22"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#2955a3"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  documents: (
    <svg
      width="22"
      height="22"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#2955a3"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  notes: (
    <svg
      width="22"
      height="22"
      fill="none"
      viewBox="0 0 24 24"
      stroke="#2955a3"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  ),
}

export function SkeletonOverviewCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-line bg-surface"
        >
          <div
            className="border-b border-line-subtle px-5 py-3.5"
          >
            <Skeleton className="" style={{ height: 12, width: "42%" }} />
          </div>
          <div className="p-5 space-y-3">
            <Skeleton className="" style={{ height: 10, width: "55%" }} />
            <Skeleton className="" style={{ height: 10, width: "72%" }} />
            <Skeleton className="" style={{ height: 10, width: "48%" }} />
            <Skeleton className="" style={{ height: 10, width: "64%" }} />
          </div>
        </div>
      ))}
    </div>
  )
}
