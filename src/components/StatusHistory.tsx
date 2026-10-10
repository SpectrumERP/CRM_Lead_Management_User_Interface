import { useEffect, useState } from 'react'
import { Spinner } from '../ui'
import { toApiError } from '../api/errors'
import { PENDING_API_MODE, isPendingApiMock, usePendingData } from '../api/pendingApiStore'
import { fetchStatusHistory, mergeStatusHistory, type StatusHistoryEntry, type StatusRecordType } from '../api/statusChange'
import type { LeadCurrency, LeadStatusLog } from '../data/leads'
import { formatMoney } from '../data/leads'
import { formatDate, formatDateTime } from '../utils/dateFormat'
import { EmptyIcons, EmptyState } from './CRMStates'

export interface StatusHistoryProps {
  record: StatusRecordType
  recordNo: number
  /** Lead: the server status log (load-data `statusLogs`), shown for changes made outside this browser. */
  serverLogs?: readonly LeadStatusLog[]
  /** Order Value currency. */
  currency?: LeadCurrency
  /** Change to reload (server mode), e.g. after a status change. */
  refreshKey?: string | number
}

/** Every status change of the record, latest first; earlier entries are kept, never edited. */
export default function StatusHistory({ record, recordNo, serverLogs, currency, refreshKey }: StatusHistoryProps) {
  const pending = usePendingData()
  const [serverRows, setServerRows] = useState<StatusHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (PENDING_API_MODE !== 'server') return
    let cancelled = false
    setError(null)
    fetchStatusHistory(record, recordNo)
      .then((rows) => {
        if (!cancelled) setServerRows(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toApiError(err).message)
      })
    return () => {
      cancelled = true
    }
  }, [record, recordNo, refreshKey])

  const rows = isPendingApiMock() ? mergeStatusHistory(record, recordNo, pending.history, serverLogs) : serverRows

  if (error) {
    return (
      <p className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-xs text-accent" role="alert">
        Could not load the status history: {error}
      </p>
    )
  }
  if (!rows) {
    return (
      <div className="flex justify-center py-6">
        <Spinner label="Loading status history" />
      </div>
    )
  }
  if (!rows.length) {
    return (
      <EmptyState
        icon={EmptyIcons.timeline}
        title="No status changes yet"
        subtitle={`Each status change of this ${record === 'Lead' ? 'lead' : 'opportunity'} is listed here, latest first.`}
      />
    )
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold text-ink-muted">
        {rows.length} status change{rows.length === 1 ? '' : 's'} · latest first
      </p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-left text-xs">
          <thead className="border-b border-line bg-surface-muted text-[11px] font-semibold text-ink-muted">
            <tr>
              <th className="px-3 py-2">Changed On</th>
              <th className="px-3 py-2">Changed By</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Remark</th>
              {record === 'Opportunity' ? <th className="px-3 py-2">Order Value</th> : null}
              {record === 'Opportunity' ? <th className="px-3 py-2">Order Date</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.statusChangeHistoryNo}-${row.changedDate}`} className="border-b border-line-subtle last:border-b-0 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-ink-soft">{formatDateTime(row.changedDate)}</td>
                <td className="px-3 py-2 text-ink">
                  {row.changedBy.name || '—'}
                  {row.changedBy.loginNo ? <span className="ml-1 text-[10px] text-ink-faint">#{row.changedBy.loginNo}</span> : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {row.previousStatusName ? (
                    <>
                      <span className="text-ink-muted">{row.previousStatusName}</span>
                      <span className="mx-1.5 text-ink-faint" aria-label="to">→</span>
                    </>
                  ) : (
                    <span className="mr-1.5 text-[10px] text-ink-faint">Initial</span>
                  )}
                  <span className="font-semibold text-ink">{row.newStatusName}</span>
                </td>
                <td className="max-w-[18rem] whitespace-pre-wrap break-words px-3 py-2 text-ink-soft">{row.remark || '—'}</td>
                {record === 'Opportunity' ? (
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{row.orderValue ? formatMoney(row.orderValue, currency) : '—'}</td>
                ) : null}
                {record === 'Opportunity' ? (
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{row.orderDate ? formatDate(row.orderDate) : '—'}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
