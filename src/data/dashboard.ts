/**
 * Sales dashboard rules (pipelines, attention reasons, closures this month, last six months).
 * Pure functions over store records — the page only renders what these return.
 *
 * Interim data notes (until the server has dashboard endpoints):
 *   - "Days in current stage" counts from the record's last modification: the server does not send
 *     when the stage changed. Any edit restarts the count.
 *   - Won / Lost months use the record's last modification date (no won / lost date on the server).
 */
import type { Activity } from './activities'
import type { Lead, LeadCurrency } from './leads'
import type { Opportunity } from './opportunities'
import { parseDate, toIsoDate } from '../utils/dateFormat'

/** Days a record may stay in one stage before it is "Stagnant". */
export const STAGNANT_THRESHOLD_DAYS = 15

/** Rows per page in the dashboard tables. */
export const DASHBOARD_PAGE_SIZE = 10

/** Rows-per-page choices (10 or more). */
export const DASHBOARD_PAGE_SIZES = [10, 25, 50] as const

export type AttentionReason = 'Not Started' | 'Activity Overdue' | 'Stagnant'

export interface Money {
  value: number
  currency?: LeadCurrency
}

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

/** Status "Open" (any case) — On Hold, Cold, Cancelled, Converted, Won and Lost are not open. */
export function isOpenStatus(status: string | null | undefined) {
  return norm(status) === 'open'
}

export function isPendingActivity(activity: Pick<Activity, 'status'>) {
  return activity.status === 'Pending'
}

/** Whole days from `from` to `to` (local calendar days); null when `from` cannot be read. */
export function daysBetween(from: string | null | undefined, to: Date): number | null {
  const start = parseDate(from)
  if (!start) return null
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/** First and last day of `today`'s month as `YYYY-MM-DD`. */
export function currentMonthRange(today: Date): { from: string; to: string } {
  return {
    from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  }
}

// ─── Pipelines ────────────────────────────────────────────────────────────────

export interface StageMaster {
  name: string
  sequence: number
  /** Opportunity stages: win probability in percent. */
  weight?: number
  /** Stage colour from the server master (`#RRGGBB`). */
  color?: string
}

/** Master stages in sequence, then any stage a record has that the master does not list. */
function orderedStages(masters: readonly StageMaster[], used: readonly string[]): StageMaster[] {
  const sorted = [...masters].sort((a, b) => a.sequence - b.sequence)
  const known = new Set(sorted.map((s) => norm(s.name)))
  const extra = [...new Set(used.filter((name) => name && !known.has(norm(name))))]
  return [...sorted, ...extra.map((name, i) => ({ name, sequence: sorted.length + i + 1 }))]
}

export interface LeadPipelineRow {
  stage: string
  color?: string
  count: number
}

/** Open leads per stage, in master order; stages with no leads stay in the list. */
export function leadPipeline(leads: readonly Lead[], stages: readonly StageMaster[]): LeadPipelineRow[] {
  const open = leads.filter((l) => isOpenStatus(l.leadStatus))
  return orderedStages(stages, open.map((l) => l.leadStage)).map((s) => ({
    stage: s.name,
    color: s.color,
    count: open.filter((l) => norm(l.leadStage) === norm(s.name)).length,
  }))
}

export interface OpportunityPipelineRow {
  stage: string
  color?: string
  weight: number
  count: number
  values: Money[]
  weighted: Money[]
}

export function weightedValue(value: number, weightPercent: number) {
  return Math.round((value * weightPercent) / 100)
}

/** Open opportunities per stage, in master order, with value and weighted value (per currency). */
export function opportunityPipeline(
  items: readonly Opportunity[],
  stages: readonly StageMaster[],
): OpportunityPipelineRow[] {
  const open = items.filter((o) => isOpenStatus(o.status))
  return orderedStages(stages, open.map((o) => o.dealStage)).map((s) => {
    const inStage = open.filter((o) => norm(o.dealStage) === norm(s.name))
    const weight = s.weight ?? inStage[0]?.weightPercent ?? 0
    return {
      stage: s.name,
      color: s.color,
      weight,
      count: inStage.length,
      values: inStage.map((o) => ({ value: o.dealValue, currency: o.valueCurrency })),
      weighted: inStage.map((o) => ({ value: weightedValue(o.dealValue, weight), currency: o.valueCurrency })),
    }
  })
}

// ─── Activities of a record ───────────────────────────────────────────────────

export interface ActivitySummary {
  total: number
  pending: Activity[]
  /** Earliest pending activity (the next action). */
  next?: Activity
  /** Latest activity that is not pending (completed / closed). */
  last?: Activity
  overdue: boolean
}

function byDate(a: Activity, b: Activity) {
  return a.scheduleDate.localeCompare(b.scheduleDate) || a.scheduleTime.localeCompare(b.scheduleTime)
}

export function summarizeActivities(activities: readonly Activity[], today: Date): ActivitySummary {
  const todayIso = toIsoDate(today)
  const pending = activities.filter(isPendingActivity).sort(byDate)
  const done = activities.filter((a) => !isPendingActivity(a)).sort(byDate)
  return {
    total: activities.length,
    pending,
    next: pending[0],
    last: done[done.length - 1],
    overdue: pending.some((a) => Boolean(a.scheduleDate) && a.scheduleDate < todayIso),
  }
}

/** Activities per lead id and per opportunity id. */
export function groupActivities(activities: readonly Activity[]) {
  const byLead = new Map<string, Activity[]>()
  const byOpportunity = new Map<string, Activity[]>()
  for (const a of activities) {
    const [map, id] = a.opportunityId ? [byOpportunity, a.opportunityId] : [byLead, a.leadId]
    if (!id) continue
    const list = map.get(id)
    if (list) list.push(a)
    else map.set(id, [a])
  }
  return { byLead, byOpportunity }
}

/** Latest of the server's last-activity date and the latest finished activity. */
export function lastActivityDate(serverDate: string | null | undefined, summary: ActivitySummary): string {
  const fromActivity = summary.last?.closureDate || summary.last?.scheduleDate || ''
  const server = serverDate ?? ''
  return server > fromActivity ? server : fromActivity
}

// ─── Attention ────────────────────────────────────────────────────────────────

export function attentionReasons(
  summary: ActivitySummary,
  daysInStage: number | null,
  threshold = STAGNANT_THRESHOLD_DAYS,
): AttentionReason[] {
  const reasons: AttentionReason[] = []
  if (summary.total === 0) reasons.push('Not Started')
  if (summary.overdue) reasons.push('Activity Overdue')
  if (daysInStage !== null && daysInStage > threshold) reasons.push('Stagnant')
  return reasons
}

/** When the record entered its current stage (approximation: last modification, else creation). */
export function stageSince(record: { audit?: { modifiedAt?: string }; createdAt: string }) {
  return record.audit?.modifiedAt || record.createdAt
}

export interface LeadAttentionRow {
  lead: Lead
  ageDays: number | null
  /** Creation time in ms (audit stamp, else creation date) — orders leads created on the same day. */
  createdTime: number | null
  daysInStage: number | null
  lastActivity: string
  next?: Activity
  reasons: AttentionReason[]
}

/** Lead Age ascending (youngest first); same age → the later creation time first; unknown ages last. */
export function compareLeadAge(
  a: Pick<LeadAttentionRow, 'ageDays' | 'createdTime'>,
  b: Pick<LeadAttentionRow, 'ageDays' | 'createdTime'>,
) {
  return (a.ageDays ?? Infinity) - (b.ageDays ?? Infinity) || (b.createdTime ?? 0) - (a.createdTime ?? 0)
}

/** Open leads that need action; youngest lead first. */
export function leadsRequiringAttention(
  leads: readonly Lead[],
  activitiesByLead: ReadonlyMap<string, Activity[]>,
  today: Date,
  threshold = STAGNANT_THRESHOLD_DAYS,
): LeadAttentionRow[] {
  return leads
    .filter((l) => isOpenStatus(l.leadStatus))
    .map((lead) => {
      const summary = summarizeActivities(activitiesByLead.get(lead.id) ?? [], today)
      const daysInStage = daysBetween(stageSince(lead), today)
      return {
        lead,
        ageDays: daysBetween(lead.createdAt, today),
        createdTime: parseDate(lead.audit?.createdAt || lead.createdAt)?.getTime() ?? null,
        daysInStage,
        lastActivity: lastActivityDate(lead.lastActivityAt, summary),
        next: summary.next,
        reasons: attentionReasons(summary, daysInStage, threshold),
      }
    })
    .filter((row) => row.reasons.length > 0)
    .sort(compareLeadAge)
}

export interface OpportunityAttentionRow {
  opportunity: Opportunity
  daysInStage: number | null
  lastActivity: string
  next?: Activity
  reasons: AttentionReason[]
}

/** Open opportunities that need action; longest in stage first. */
export function opportunitiesRequiringAttention(
  items: readonly Opportunity[],
  activitiesByOpportunity: ReadonlyMap<string, Activity[]>,
  today: Date,
  threshold = STAGNANT_THRESHOLD_DAYS,
): OpportunityAttentionRow[] {
  return items
    .filter((o) => isOpenStatus(o.status))
    .map((opportunity) => {
      const summary = summarizeActivities(activitiesByOpportunity.get(opportunity.id) ?? [], today)
      const daysInStage = daysBetween(stageSince(opportunity), today)
      return {
        opportunity,
        daysInStage,
        lastActivity: lastActivityDate(opportunity.lastActivityAt, summary),
        next: summary.next,
        reasons: attentionReasons(summary, daysInStage, threshold),
      }
    })
    .filter((row) => row.reasons.length > 0)
    .sort((a, b) => (b.daysInStage ?? -1) - (a.daysInStage ?? -1))
}

// ─── Expected closure this month ──────────────────────────────────────────────

export interface ClosureRow {
  opportunity: Opportunity
  weighted: number
  last?: Activity
  lastActivity: string
  pending: Activity[]
}

/** Open opportunities whose expected closure date falls in `today`'s month; earliest first. */
export function closuresThisMonth(
  items: readonly Opportunity[],
  activitiesByOpportunity: ReadonlyMap<string, Activity[]>,
  today: Date,
): ClosureRow[] {
  const { from, to } = currentMonthRange(today)
  return items
    .filter((o) => isOpenStatus(o.status) && o.closingDate >= from && o.closingDate <= to)
    .sort((a, b) => a.closingDate.localeCompare(b.closingDate))
    .map((opportunity) => {
      const summary = summarizeActivities(activitiesByOpportunity.get(opportunity.id) ?? [], today)
      return {
        opportunity,
        weighted: weightedValue(opportunity.dealValue, opportunity.weightPercent),
        last: summary.last,
        lastActivity: lastActivityDate(opportunity.lastActivityAt, summary),
        pending: summary.pending,
      }
    })
}

// ─── Last six months ──────────────────────────────────────────────────────────

export interface MonthSales {
  /** `YYYY-MM`. */
  key: string
  label: string
  created: number
  lost: number
  lostValue: Money[]
  won: number
  wonValue: Money[]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthKey(value: string | null | undefined) {
  const d = parseDate(value)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : ''
}

/** Current month and the five before it, oldest first; months without data show zeros. */
export function lastSixMonthsSales(items: readonly Opportunity[], today: Date): MonthSales[] {
  const months: MonthSales[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      created: 0,
      lost: 0,
      lostValue: [],
      won: 0,
      wonValue: [],
    }
  })
  const byKey = new Map(months.map((m) => [m.key, m]))
  for (const o of items) {
    const created = byKey.get(monthKey(o.audit?.createdAt || o.createdAt))
    if (created) created.created += 1
    const status = norm(o.status)
    if (status !== 'won' && status !== 'lost') continue
    const closed = byKey.get(monthKey(o.audit?.modifiedAt || o.closingDate))
    if (!closed) continue
    const money = { value: o.dealValue, currency: o.valueCurrency }
    if (status === 'won') {
      closed.won += 1
      closed.wonValue.push(money)
    } else {
      closed.lost += 1
      closed.lostValue.push(money)
    }
  }
  return months
}

