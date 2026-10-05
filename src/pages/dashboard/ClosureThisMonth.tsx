import { useMemo, useState } from 'react'
import OverlayShell from '../../components/OverlayShell'
import type { Activity } from '../../data/activities'
import { formatMoney, formatMoneyTotals } from '../../data/leads'
import type { ClosureRow } from '../../data/dashboard'
import { formatDate } from '../../utils/dateFormat'
import { SortChevrons } from '../../ui'
import { DashboardTable, type DashboardColumn } from './DashboardTable'
import { DueDate, RecordLink, SectionEmpty } from './parts'

interface ClosureProps {
  rows: ClosureRow[]
  todayIso: string
  onOpenOpportunity: (id: string) => void
  onOpenActivity: (activity: Activity) => void
}

/** Earliest due first; undated activities last. */
function sortByDue(list: Activity[]) {
  return [...list].sort((a, b) => (a.scheduleDate || '9999').localeCompare(b.scheduleDate || '9999'))
}

/** "Overdue · 4 days" from ISO dates (YYYY-MM-DD). */
function overdueLabel(due: string, todayIso: string) {
  const days = Math.round((Date.parse(todayIso.slice(0, 10)) - Date.parse(due.slice(0, 10))) / 86_400_000)
  return days > 0 ? `Overdue · ${days} ${days === 1 ? 'day' : 'days'}` : 'Overdue'
}

export function ClosureThisMonthTable({ rows, todayIso, onOpenOpportunity, onOpenActivity }: ClosureProps) {
  const [pendingFor, setPendingFor] = useState<ClosureRow | null>(null)
  const [dueDir, setDueDir] = useState<'asc' | 'desc'>('asc')

  const columns = useMemo<DashboardColumn<ClosureRow>[]>(
    () => [
      {
        key: 'name',
        label: 'Opportunity Name',
        render: (r) => <RecordLink label={r.opportunity.name} onClick={() => onOpenOpportunity(r.opportunity.id)} />,
        sortValue: (r) => r.opportunity.name,
        searchText: (r) => r.opportunity.name,
      },
      {
        key: 'entity',
        label: 'Business Entity Name',
        render: (r) => r.opportunity.companyName || '—',
        sortValue: (r) => r.opportunity.companyName,
        searchText: (r) => r.opportunity.companyName,
      },
      {
        key: 'value',
        label: 'Opportunity Value',
        render: (r) => formatMoney(r.opportunity.dealValue, r.opportunity.valueCurrency),
        sortValue: (r) => r.opportunity.dealValue,
        align: 'right',
      },
      {
        key: 'stage',
        label: 'Stage',
        render: (r) => (
          <span>
            {r.opportunity.dealStage || '—'} <span className="text-[11px] text-ink-muted">({r.opportunity.weightPercent}%)</span>
          </span>
        ),
        sortValue: (r) => r.opportunity.weightPercent,
        searchText: (r) => r.opportunity.dealStage,
      },
      {
        key: 'weighted',
        label: 'Weighted Value',
        render: (r) => formatMoney(r.weighted, r.opportunity.valueCurrency),
        sortValue: (r) => r.weighted,
        align: 'right',
      },
      {
        key: 'closing',
        label: 'Expected Closure Date',
        render: (r) => formatDate(r.opportunity.closingDate),
        sortValue: (r) => r.opportunity.closingDate,
      },
      {
        key: 'last',
        label: 'Last Activity Name & Date',
        render: (r) =>
          r.last ? (
            <span className="block max-w-[16rem] truncate" title={r.last.subject || r.last.type}>
              {r.last.subject || r.last.type}, {formatDate(r.lastActivity)}
            </span>
          ) : (
            formatDate(r.lastActivity)
          ),
        sortValue: (r) => r.lastActivity,
        searchText: (r) => r.last?.subject,
      },
      {
        key: 'pending',
        label: 'Pending Activity',
        render: (r) => {
          const pending = sortByDue(r.pending)
          const next = pending[0]
          if (!next) return <span className="text-ink-faint">None</span>
          const count = pending.length
          const noun = count === 1 ? 'activity' : 'activities'
          const due = next.scheduleDate
          const tone = !due ? 'text-ink-muted' : due < todayIso ? 'text-accent' : due === todayIso ? 'text-warning' : 'text-ink-muted'
          const bg =
            !due ? 'border-line bg-surface hover:bg-surface-hover'
            : due < todayIso ? 'border-accent/30 bg-accent-soft hover:brightness-95'
            : due === todayIso ? 'border-warning-line bg-warning-soft hover:brightness-95'
            : 'border-primary/20 bg-primary-soft hover:brightness-95'
          const dueLabel = !due ? 'No due date' : due < todayIso ? overdueLabel(due, todayIso) : due === todayIso ? 'Due today' : `Due ${formatDate(due)}`
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPendingFor(r)
              }}
              title={`View ${count} pending ${noun}`}
              aria-label={`View ${count} pending ${noun} for ${r.opportunity.name}. Next: ${next.subject || next.type}, ${dueLabel}`}
              className={`block max-w-64 cursor-pointer rounded-md border px-3 py-1.5 text-left transition ${bg} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${tone}`}>{dueLabel}</span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              </span>
            </button>
          )
        },
        sortValue: (r) => sortByDue(r.pending)[0]?.scheduleDate ?? '9999',
      },
    ],
    [onOpenOpportunity, onOpenActivity, todayIso],
  )

  return (
    <>
      <DashboardTable
        label="Expected closure this month"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.opportunity.id}
        defaultSort={{ key: 'closing', dir: 'asc' }}
        onRowClick={(r) => onOpenOpportunity(r.opportunity.id)}
        rowLabel={(r) => `Open opportunity ${r.opportunity.name}`}
        empty={<SectionEmpty title="No opportunities expected to close this month" />}
      />
      {rows.length ? (
        <p className="mt-3 text-xs text-ink-muted">
          Total: <span className="font-bold text-ink">{formatMoneyTotals(rows.map((r) => ({ value: r.opportunity.dealValue, currency: r.opportunity.valueCurrency })))}</span>
          {' · '}Weighted: <span className="font-bold text-ink">{formatMoneyTotals(rows.map((r) => ({ value: r.weighted, currency: r.opportunity.valueCurrency })))}</span>
        </p>
      ) : null}
      {pendingFor ? (
        <OverlayShell
          title="Pending activities"
          subtitle={pendingFor.opportunity.name}
          widthClass="w-[32rem]"
          onClose={() => setPendingFor(null)}
        >
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
                {(dueDir === 'asc' ? sortByDue(pendingFor.pending) : sortByDue(pendingFor.pending).reverse()).map((a) => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    onClick={() => {
                      setPendingFor(null)
                      onOpenActivity(a)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setPendingFor(null)
                        onOpenActivity(a)
                      }
                    }}
                    aria-label={`Open activity ${a.subject || a.type}`}
                    className="cursor-pointer hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <td className="max-w-48 truncate px-3 py-2.5 font-semibold text-primary" title={a.subject || a.type}>
                      {a.subject || a.type}
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{a.type || '—'}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{a.assignedTo || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      <DueDate date={a.scheduleDate} todayIso={todayIso} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OverlayShell>
      ) : null}
    </>
  )
}
