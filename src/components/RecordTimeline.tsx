import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ChoiceGroup, Select, Spinner } from "../ui"
import { fetchTimelinePage, type TimelineRecord } from "../api/timeline"
import { toApiError } from "../api/errors"
import { PersonContactCard } from "./PersonContactCard"
import { EmptyState, EmptyIcons } from "./CRMStates"
import type { Contact } from "../data/contacts"
import type { LeadTimelineEntry } from "../data/leads"
import { formatDate, formatTime, joinDateTime } from "../utils/dateFormat"

/**
 * Record timeline (lead and opportunity views): the server's load-data `timeline`, shown as received
 * or newest first. The lead view also feeds it entries built in the app for leads without one.
 */

/** One rendered timeline row. */
export interface TimelineRow {
  date: string
  time: string
  event: string
  detail: string
  by: string
  icon: string
}

export function timelineIconMeta(type: string) {
  const d: Record<string, { tone: string; d: ReactNode }> = {
    stage: {
      tone: "bg-primary-soft text-primary",
      d: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      ),
    },
    call: {
      tone: "bg-success-soft text-success-strong",
      d: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      ),
    },
    email: {
      tone: "bg-surface-hover text-ink-soft",
      d: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      ),
    },
    meeting: {
      tone: "bg-purple-soft text-purple",
      d: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      ),
    },
    link: {
      tone: "bg-warning-soft text-warning",
      d: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      ),
    },
    create: {
      tone: "bg-success-soft text-success",
      d: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      ),
    },
    note: {
      tone: "bg-warning-soft text-warning",
      d: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      ),
    },
  }
  return d[type] ?? d.create
}

export type TimelineOrder = "received" | "newest"

/** Timeline icon for a server `timelineType` (LeadCreated, LeadStatus, LeadStage, Activity, Internal Notes…). */
export function timelineIconFor(type: string): string {
  const t = type.toLowerCase().replace(/[\s_-]+/g, "")
  if (t.includes("created")) return "create"
  if (t.includes("stage") || t.includes("status")) return "stage"
  if (t.includes("note")) return "note"
  if (t.includes("meeting")) return "meeting"
  if (t.includes("email") || t.includes("mail")) return "email"
  if (t.includes("opportun") || t.includes("convert")) return "link"
  if (t.includes("activit") || t.includes("call") || t.includes("task")) return "call"
  return "create"
}

/** Server timeline entry → the row shape the timeline list renders. */
export function serverTimelineEntry(entry: LeadTimelineEntry): TimelineRow {
  const at = entry.at ? new Date(entry.at) : null
  const valid = Boolean(at && !Number.isNaN(at.getTime()))
  return {
    date: valid ? formatDate(entry.at) : "—",
    time: valid ? formatTime(entry.at) : "",
    event: entry.title,
    detail: entry.description,
    by: entry.by,
    icon: timelineIconFor(entry.type),
  }
}

export function TimelineTab({
  timeline,
  contacts = [],
  order,
  onOrderChange,
  emptySubtitle = "Timeline entries will appear as this lead progresses through stages.",
}: {
  timeline: readonly TimelineRow[]
  contacts?: Contact[]
  order: TimelineOrder
  onOrderChange: (order: TimelineOrder) => void
  emptySubtitle?: string
}) {
  const orderGroupId = useId()
  if (timeline.length === 0) {
    return (
      <EmptyState
        icon={EmptyIcons.timeline}
        title="No timeline activity yet"
        subtitle={emptySubtitle}
      />
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-muted">
          {timeline.length} entr{timeline.length === 1 ? "y" : "ies"}
        </p>
        {/* <ChoiceGroup
          name={`timeline-order-${orderGroupId}`}
          layout="wrap"
          value={order}
          onChange={(value) => onOrderChange(value)}
          options={[
            { value: "received", label: "As received" },
            { value: "newest", label: "Newest first" },
          ]}
        /> */}
      </div>
      <TimelineRows timeline={timeline} contacts={contacts} />
    </div>
  )
}

/** The timeline list itself (shared by the in-app and the paged server timeline). */
export function TimelineRows({ timeline, contacts = [] }: { timeline: readonly TimelineRow[]; contacts?: Contact[] }) {
  return (
    <ol className="m-0 list-none overflow-hidden rounded-xl border border-line bg-surface p-0">
        {timeline.map((t, i) => {
        const ic = timelineIconMeta(t.icon)
        const last = i === timeline.length - 1
        const when = joinDateTime(t.date, t.time)
          return (
          <li
            key={`${t.event}-${t.date}-${i}`}
            className={`flex gap-2.5 px-3 py-2 ${last ? "" : "border-b border-line-subtle"}`}
          >
            <div className="flex w-6 shrink-0 flex-col items-center self-stretch pt-0.5">
              <span
                className={`relative z-[1] flex h-6 w-6 items-center justify-center rounded-full ${ic.tone}`}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  {ic.d}
                </svg>
              </span>
              {last ? null : (
                <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
              )}
              </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 truncate text-[12px] font-semibold text-ink">{t.event} ( <span className="ml-auto shrink-0 text-[11px] text-ink">{when}</span> )</p>
                </div>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-ink-soft">{t.detail}</p>
              <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-ink-faint">
                <span className="shrink-0">By</span>
                <PersonContactCard name={t.by} contacts={contacts} />
              </div>
            </div>
          </li>
        )
        })}
    </ol>
  )
}

/** Readable name for a timeline type: the first entry's title, else the type split into words. */
function typeLabel(entry: LeadTimelineEntry): string {
  return entry.title || entry.type.replace(/([a-z])([A-Z])/g, "$1 $2") || `Type ${entry.typeNo}`
}

const CREATED = /created/i
const STATUS = /status/i
const STAGE = /stage/i
/** The first status / stage entries within this long of "… Created" were written by the create itself. */
const CREATE_WINDOW_MS = 5 * 60_000

/** Type and title together, so `LeadStatus`, "Lead Status", `OpportunityStageChanged`… all match. */
function entryText(e: LeadTimelineEntry) {
  return `${e.type} ${e.title}`
}

/**
 * Creating a lead / opportunity shows one entry (Lead Created / Opportunity Created). The initial status
 * and stage the server writes with the create are hidden — only the first entry of each kind, and only
 * when it sits at (or within a few minutes of) the create. Every later status / stage change stays.
 */
export function withoutCreateEntries(entries: readonly LeadTimelineEntry[]): LeadTimelineEntry[] {
  const createdAt = entries
    .filter((e) => CREATED.test(entryText(e)))
    .map((e) => Date.parse(e.at))
    .filter(Number.isFinite)
  if (!createdAt.length) return [...entries]
  const created = Math.min(...createdAt)

  const hidden = new Set<LeadTimelineEntry>()
  for (const kind of [STATUS, STAGE]) {
    const firstOfKind = entries
      .filter((e) => kind.test(entryText(e)) && !CREATED.test(entryText(e)))
      .map((e) => ({ e, at: Date.parse(e.at) }))
      .filter(({ at }) => Number.isFinite(at))
      .sort((x, y) => x.at - y.at)[0]
    if (firstOfKind && Math.abs(firstOfKind.at - created) <= CREATE_WINDOW_MS) hidden.add(firstOfKind.e)
  }
  return entries.filter((e) => !hidden.has(e))
}

/**
 * The same entry twice (every field equal: type, title, text, time, user) shows once — the server can
 * send a row twice, and pages can overlap when entries are added between page loads.
 */
export function withoutDuplicates(entries: readonly LeadTimelineEntry[]): LeadTimelineEntry[] {
  const seen = new Set<string>()
  return entries.filter((e) => {
    const key = [e.type, e.typeNo ?? '', e.title, e.description, e.at, e.by].join('\u0001')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Server timeline (GET …/timeline/{id}), paged: the first 20 entries, then the next page each time
 * the list is scrolled to its end, until the last page. Types seen so far can be filtered on
 * (`TimelineTypeNo`). Change `refreshKey` to reload from the first page (e.g. after a new activity).
 */
export function PagedTimeline({
  record,
  recordNo,
  refreshKey,
  emptySubtitle,
}: {
  record: TimelineRecord
  recordNo: number
  refreshKey?: string | number
  emptySubtitle?: string
}) {
  const [typeNo, setTypeNo] = useState<number | undefined>(undefined)
  const [entries, setEntries] = useState<LeadTimelineEntry[]>([])
  const [pageNo, setPageNo] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Types seen in any loaded page, kept while a type filter is on (so the filter can be changed back).
  const [types, setTypes] = useState<Map<number, string>>(() => new Map())
  const requestRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(
    async (page: number, reset: boolean) => {
      const request = ++requestRef.current
      setLoading(true)
      setError(null)
      try {
        const result = await fetchTimelinePage(record, recordNo, { pageNo: page, timelineTypeNo: typeNo })
        if (request !== requestRef.current) return
        setEntries((prev) => (reset ? result.entries : [...prev, ...result.entries]))
        setPageNo(page)
        setTotalPages(result.totalPages)
        setTotalRecords(result.totalRecords)
        setTypes((prev) => {
          const next = new Map(prev)
          for (const e of result.entries) if (e.typeNo !== undefined && !next.has(e.typeNo)) next.set(e.typeNo, typeLabel(e))
          return next.size === prev.size ? prev : next
        })
      } catch (err) {
        if (request === requestRef.current) setError(toApiError(err).message)
      } finally {
        if (request === requestRef.current) setLoading(false)
      }
    },
    [record, recordNo, typeNo],
  )

  // First page whenever the record, the filter or the refresh key changes — once per change: React's
  // StrictMode (dev) runs effects twice, which sent the same page-1 request twice.
  const firstPageKey = useRef("")
  useEffect(() => {
    const key = `${record}:${recordNo}:${typeNo ?? ""}:${refreshKey ?? ""}`
    if (firstPageKey.current === key) return
    firstPageKey.current = key
    setEntries([])
    setPageNo(0)
    setTotalPages(1)
    void load(1, true)
  }, [load, record, recordNo, typeNo, refreshKey])

  // A new record starts with no known types.
  useEffect(() => {
    setTypes(new Map())
    setTypeNo(undefined)
  }, [record, recordNo])

  const hasMore = pageNo > 0 && pageNo < totalPages

  // Scrolled to the end (sentinel in view) → next page. It stays in view on a short list, so pages
  // keep loading until the list fills the screen or the last page is in.
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading || error) return
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((item) => item.isIntersecting)) void load(pageNo + 1, false)
      },
      { rootMargin: "200px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, error, load, pageNo])

  const unique = withoutDuplicates(entries)
  const shown = withoutCreateEntries(unique)
  const hidden = unique.length - shown.length
  const rows = shown.map(serverTimelineEntry)
  const typeOptions = [
    { value: "", label: "All types" },
    ...[...types.entries()].sort((a, b) => a[0] - b[0]).map(([no, label]) => ({ value: String(no), label })),
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-muted">
          {pageNo === 0 && loading
            ? "Loading timeline…"
            : `${shown.length}${totalRecords - hidden > shown.length ? ` of ${totalRecords - hidden}` : ""} entr${(totalRecords - hidden || shown.length) === 1 ? "y" : "ies"}`}
        </p>
        {types.size > 1 || typeNo !== undefined ? (
          <div className="w-48">
            <Select
              size="compact"
              preserveOrder
              aria-label="Timeline type"
              options={typeOptions}
              value={typeNo === undefined ? "" : String(typeNo)}
              onValueChange={(value) => setTypeNo(value ? Number(value) : undefined)}
            />
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <TimelineRows timeline={rows} />
      ) : !loading && !error ? (
        <EmptyState
          icon={EmptyIcons.timeline}
          title={typeNo === undefined ? "No timeline activity yet" : "No entries of this type"}
          subtitle={emptySubtitle ?? "Timeline entries will appear as this record progresses."}
        />
      ) : null}

      {error ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-xs text-accent" role="alert">
          <span>Could not load the timeline: {error}</span>
          <button type="button" className="font-bold underline" onClick={() => void load(pageNo + 1, pageNo === 0)}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-3">
          <Spinner label="Loading timeline" />
        </div>
      ) : null}

      {/* Scroll sentinel: reaching it loads the next page. */}
      {hasMore ? <div ref={sentinelRef} className="h-px" aria-hidden="true" /> : null}
      {!hasMore && pageNo > 1 && !loading ? (
        <p className="py-2 text-center text-[11px] text-ink-faint">All {unique.length} entries loaded</p>
      ) : null}
    </div>
  )
}
