import { useEffect, useMemo } from 'react'
import type { DashboardExpectedClosure } from '../../api/dashboard'
import { leadNoFromId, noteDateToIso, refreshServerLead } from '../../api/leadSync'
import { refreshServerOpportunity, serverOpportunityId } from '../../api/opportunitySync'
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
 * opportunity — its own notes plus those of the lead it was converted from. Loads each opportunity and
 * its lead once (load-data) so their notes reach the store; a `latestNote` from the dashboard API counts too.
 */
export function useClosureRemarks(rows: readonly DashboardExpectedClosure[]): Map<number, ClosureRemark> {
  const opportunities = useCrmSelector((state) => state.opportunities)
  const notes = useCrmSelector((state) => state.notes)

  const rowKey = rows.map((r) => r.opportunityNo).join(',')
  useEffect(() => {
    let cancelled = false
    // Opportunities converted from the same lead load that lead once.
    const leadsAsked = new Set<number>()
    for (const no of rowKey ? rowKey.split(',').map(Number) : []) {
      refreshServerOpportunity(no)
        .then((opportunity) => {
          const leadNo = opportunity.leadId ? leadNoFromId(opportunity.leadId) : null
          if (cancelled || !leadNo || leadsAsked.has(leadNo)) return
          leadsAsked.add(leadNo)
          return refreshServerLead(leadNo)
        })
        // A remark is extra information: a record that fails to load just shows none.
        .catch(() => undefined)
    }
    return () => { cancelled = true }
  }, [rowKey])

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
