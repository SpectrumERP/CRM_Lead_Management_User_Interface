import { useMemo } from 'react'
import type { DashboardExpectedClosure } from '../../api/dashboard'
import { noteDateToIso } from '../../api/leadSync'
import { serverOpportunityId } from '../../api/opportunitySync'
import { useCrmSelector } from '../../contexts/CrmStoreContext'

export interface ClosureRemark {
  text: string
  /** ISO date-time. */
  date: string
  by: string
  /** Server note number — breaks ties between notes on the same date (the later-saved one wins). */
  seq: number
}

/**
 * Remark column of "Expected closure this month": the newest internal note (by note date) of each
 * opportunity — the dashboard API's `latestNote`, plus any notes already in the store. Nothing is loaded on
 * page load: load-data runs only when an activity is opened, and its notes then count here too.
 */
export function useClosureRemarks(rows: readonly DashboardExpectedClosure[]): Map<number, ClosureRemark> {
  const opportunities = useCrmSelector((state) => state.opportunities)
  const notes = useCrmSelector((state) => state.notes)

  return useMemo(() => {
    const result = new Map<number, ClosureRemark>()
    for (const row of rows) {
      const id = serverOpportunityId(row.opportunityNo)
      const leadId = opportunities.find((o) => o.id === id)?.leadId
      const candidates: ClosureRemark[] = notes
        .filter((n) => n.relatedLeadId === id || (leadId && n.relatedLeadId === leadId))
        .filter((n) => n.text.trim())
        .map((n) => ({
          text: n.text.trim(),
          date: n.date.trim() ? noteDateToIso(n.date) : '',
          by: n.by,
          seq: Number(/^SO?N-(\d+)$/.exec(n.id)?.[1] ?? 0),
        }))
      const api = row.latestNote
      if (api?.notesDiscussion?.trim()) {
        candidates.push({ text: api.notesDiscussion.trim(), date: api.notesDate ?? '', by: api.originatedBy ?? '', seq: api.notesDetailNo ?? 0 })
      }
      const latest = candidates.sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq)[0]
      if (latest) result.set(row.opportunityNo, latest)
    }
    return result
  }, [rows, opportunities, notes])
}
