import { useCallback, useMemo, useState } from 'react'
import {
  toMoney,
  type DashboardExpectedClosure,
  type DashboardExpectedClosuresTotals,
  type DashboardOpenActivity,
} from '../../api/dashboard'
import OverlayShell from '../../components/OverlayShell'
import { formatMoney, formatMoneyTotals } from '../../data/leads'
import { SortChevrons } from '../../ui'
import { formatDate } from '../../utils/dateFormat'
import { DashboardTable, type DashboardColumn } from './DashboardTable'
import { DueDate, RecordLink, SectionEmpty } from './parts'
import { useClosureRemarks } from './useClosureRemarks'

/** A pending activity with its expected-closures row's `lastActivity` object attached. */
export type ClosurePendingActivity = DashboardOpenActivity & { lastActivity?: DashboardExpectedClosure['lastActivity'] }

interface ClosureProps {
  rows: readonly DashboardExpectedClosure[]
  totals: DashboardExpectedClosuresTotals | null
  /** The dashboard's open-activities feed; each row's pending activities are picked from it. */
  activities: readonly DashboardOpenActivity[]
  todayIso: string
  onOpenOpportunity: (opportunityNo: number) => void
  /**
   * Open one pending activity to add its remark / change its status. The save sends the activity's
   * own `activityDetailNo`, or its `lastActivity`'s when opened from the last-activity card.
   */
  onOpenActivity: (activity: ClosurePendingActivity) => void
}

/** Earliest due first; undated activities last. */
function sortByDue(list: readonly DashboardOpenActivity[]) {
  return [...list].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
}

const activityLabel = (a: DashboardOpenActivity) => a.subject || a.activityType?.activityTypeName || `Activity ${a.activityDetailNo}`

const currencyOf = (r: DashboardExpectedClosure) => r.currency?.currencyCode || undefined
const nameOf = (r: DashboardExpectedClosure) => r.opportunityName || r.code || `Opportunity ${r.opportunityNo}`

/** Pending activity count, red with the overdue count when any are past due. Click to view them. */
function PendingCell({ row, onClick }: { row: DashboardExpectedClosure; onClick: () => void }) {
  const count = row.pendingActivityCount
  if (!count) return <span className="text-ink-faint">None</span>
  const overdue = row.overdueActivityCount
  const noun = count === 1 ? 'activity' : 'activities'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        overdue ? 'border-accent/30 bg-accent-soft text-accent' : 'border-primary/20 bg-primary-soft text-primary'
      }`}
      title={`View ${count} pending ${noun}${overdue ? `, ${overdue} overdue` : ''}`}
      aria-label={`View ${count} pending ${noun}${overdue ? `, ${overdue} overdue` : ''} for ${nameOf(row)}`}
    >
      {overdue ? `${overdue} overdue` : 'Pending'}
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{count}</span>
    </button>
  )
}

/** The row's `lastActivity` from expected-closures — the number every save from this drawer uses. */
function LastActivityCard({ last, onOpen }: { last: DashboardExpectedClosure['lastActivity']; onOpen: () => void }) {
  if (!last?.activityDetailNo) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface px-3 py-2.5 text-xs text-ink-muted">
        Expected closures sent no last activity.
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`Open last activity ${last.subject || last.activityDetailNo}`}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Last activity · No. {last.activityDetailNo}</span>
        <span className="block truncate text-sm font-semibold text-primary" title={last.subject ?? undefined}>
          {last.subject || '—'}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs text-ink-muted">
        <span className="block">{last.activityTypeName || '—'}</span>
        <span className="block">{formatDate(last.activityDate)}</span>
      </span>
    </button>
  )
}

export function ClosureThisMonthTable({ rows, totals, activities, todayIso, onOpenOpportunity, onOpenActivity }: ClosureProps) {
  const remarks = useClosureRemarks(rows)
  const [pendingFor, setPendingFor] = useState<{ row: DashboardExpectedClosure; list: DashboardOpenActivity[] } | null>(null)
  const [dueDir, setDueDir] = useState<'asc' | 'desc'>('asc')

  const pendingByOpportunity = useMemo(() => {
    const map = new Map<number, DashboardOpenActivity[]>()
    for (const a of activities) {
      if (a.opportunityNo == null) continue
      const list = map.get(a.opportunityNo)
      if (list) list.push(a)
      else map.set(a.opportunityNo, [a])
    }
    return map
  }, [activities])

  /** Pending activities open as a list in a drawer; a row there opens that activity's form. */
  const showPending = useCallback(
    (row: DashboardExpectedClosure) => {
      const list = sortByDue(pendingByOpportunity.get(row.opportunityNo) ?? [])
      console.table(row.opportunityNo)
      if (!list.length) onOpenOpportunity(row.opportunityNo)
      else setPendingFor({ row, list })
    },
    [pendingByOpportunity, onOpenOpportunity],
  )
  /**
   * Pass the clicked activity on. From the last-activity card it carries the expected-closures
   * `lastActivity` (whose number the save sends); from the list it saves with its own `activityDetailNo`.
   */
  const openWithLast = useCallback(
    (row: DashboardExpectedClosure, clicked: DashboardOpenActivity, useLast = false) => {
      // Always the expected-closures row's `opportunityNo` — the one the save sends.
      const base: ClosurePendingActivity = { ...clicked, opportunityNo: row.opportunityNo }
      const activity: ClosurePendingActivity = useLast ? { ...base, lastActivity: row.lastActivity } : base
      // TEMP debug: the object passed on click.
      console.log('[expected-closures] click → activity with lastActivity', activity)
      setPendingFor(null)
      onOpenActivity(activity)
    },
    [onOpenActivity],
  )
  const columns = useMemo<DashboardColumn<DashboardExpectedClosure>[]>(
    () => [
      {
        key: 'name',
        label: 'Opportunity Name',
        render: (r) => <RecordLink label={nameOf(r)} onClick={() => onOpenOpportunity(r.opportunityNo)} />,
        sortValue: nameOf,
        searchText: (r) => `${nameOf(r)} ${r.code ?? ''}`,
      },
      {
        key: 'entity',
        label: 'Business Entity Name',
        render: (r) => r.businessEntity?.businessEntityName || '—',
        sortValue: (r) => r.businessEntity?.businessEntityName,
        searchText: (r) => r.businessEntity?.businessEntityName,
      },
      {
        key: 'value',
        label: 'Opportunity Value',
        render: (r) => (r.opportunityValue == null ? '—' : formatMoney(r.opportunityValue, currencyOf(r))),
        sortValue: (r) => r.opportunityValue,
        align: 'right',
      },
      {
        key: 'stage',
        label: 'Stage',
        render: (r) => (
          <span>
            {r.opportunityStage?.opportunityStageName || '—'}
            {r.opportunityStage?.weightage != null ? (
              <span className="text-[11px] text-ink-muted"> ({r.opportunityStage.weightage}%)</span>
            ) : null}
          </span>
        ),
        sortValue: (r) => r.opportunityStage?.weightage,
        searchText: (r) => r.opportunityStage?.opportunityStageName,
      },
      {
        key: 'weighted',
        label: 'Weighted Value',
        render: (r) => formatMoney(r.weightedValue, currencyOf(r)),
        sortValue: (r) => r.weightedValue,
        align: 'right',
      },
      {
        key: 'closing',
        label: 'Expected Closure Date',
        render: (r) => formatDate(r.expectedClosureDate),
        sortValue: (r) => r.expectedClosureDate,
      },
      {
        key: 'last',
        label: 'Last Activity Name & Date',
        render: (r) => {
          const last = r.lastActivity
          const label = last?.subject || last?.activityTypeName
          if (!last) return <span className="text-ink-faint">—</span>
          return (
            <span className="block max-w-[16rem] truncate" title={label ?? undefined}>
              {label ? `${label}, ` : ''}
              {formatDate(last.activityDate)}
            </span>
          )
        },
        sortValue: (r) => r.lastActivity?.activityDate,
        searchText: (r) => r.lastActivity?.subject,
      },
      {
        key: 'remark',
        label: 'Remark',
        // The newest internal note (by date) of the opportunity and the lead it came from.
        render: (r) => {
          const note = remarks.get(r.opportunityNo)
          if (!note) return <span className="text-ink-faint">—</span>
          return (
            <span className="block max-w-[18rem]" title={note.text}>
              <span className="line-clamp-2">{note.text}</span>
              <span className="block text-[11px] text-ink-muted">
                {formatDate(note.date)}
                {note.by ? ` · ${note.by}` : ''}
              </span>
            </span>
          )
        },
        sortValue: (r) => remarks.get(r.opportunityNo)?.date,
        searchText: (r) => remarks.get(r.opportunityNo)?.text,
      },
      {
        key: 'pending',
        label: 'Pending Activity',
        render: (r) => <PendingCell row={r} onClick={() => showPending(r)} />,
        sortValue: (r) => r.overdueActivityCount * 1000 + r.pendingActivityCount,
        align: 'right',
      },
    ],
    [onOpenOpportunity, remarks, showPending],
  )

  // Server totals; summed from the rows when the server sends none.
  const total = totals?.opportunityValue?.length
    ? toMoney(totals.opportunityValue)
    : rows.map((r) => ({ value: r.opportunityValue ?? 0, currency: currencyOf(r) }))
  const weighted = totals?.weightedValue?.length
    ? toMoney(totals.weightedValue)
    : rows.map((r) => ({ value: r.weightedValue, currency: currencyOf(r) }))

  return (
    <>
      <DashboardTable
        label="Expected closure this month"
        rows={rows}
        columns={columns}
        rowKey={(r) => String(r.opportunityNo)}
        defaultSort={{ key: 'closing', dir: 'asc' }}
        onRowClick={(r) => onOpenOpportunity(r.opportunityNo)}
        rowLabel={(r) => `Open opportunity ${nameOf(r)}`}
        empty={<SectionEmpty title="No opportunities expected to close this month" />}
      />
      {rows.length ? (
        <p className="mt-3 text-xs text-ink-muted">
          Total: <span className="font-bold text-ink">{formatMoneyTotals(total)}</span>
          {' · '}Weighted: <span className="font-bold text-ink">{formatMoneyTotals(weighted)}</span>
        </p>
      ) : null}
      {pendingFor ? (
        <OverlayShell
          title="Pending activities"
          subtitle={nameOf(pendingFor.row)}
          widthClass="w-[32rem]"
          onClose={() => setPendingFor(null)}
        >
          <LastActivityCard
            last={pendingFor.row.lastActivity}
            onOpen={() => openWithLast(pendingFor.row, pendingFor.list[0], true)}
          />
          <p className="mt-4 mb-2 text-xs font-semibold text-ink-muted">Pending activities</p>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-hover text-xs font-semibold text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Activity</th>
                  <th scope="col" className="px-3 py-2">Type</th>
                  <th scope="col" className="px-3 py-2">Assigned To</th>
                  <th scope="col" className="px-3 py-2" aria-sort={dueDir === 'asc' ? 'ascending' : 'descending'}>
                    <button
                      type="button"
                      onClick={() => setDueDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      Due Date <SortChevrons active dir={dueDir} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(dueDir === 'asc' ? pendingFor.list : [...pendingFor.list].reverse()).map((a) => {
                  const open = () => openWithLast(pendingFor.row, a)
                  return (
                    <tr
                      key={a.activityDetailNo}
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          open()
                        }
                      }}
                      aria-label={`Open activity ${activityLabel(a)}`}
                      className="cursor-pointer hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                    >
                      <td className="max-w-48 truncate px-3 py-2.5 font-semibold text-primary" title={activityLabel(a)}>
                        {activityLabel(a)}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">{a.activityType?.activityTypeName || '—'}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{a.assignTo?.printingName || a.assignTo?.loginId || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                        <DueDate date={a.dueDate} todayIso={todayIso} overdue={a.isOverdue} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </OverlayShell>
      ) : null}
    </>
  )
}
