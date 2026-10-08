/**
 * Spectrum sales dashboard APIs (from the backend Swagger). All GET, filtered by `CompanyNo`.
 *
 *   /api/crm/dashboard/open-activities           pending activities + totals (paged)
 *   /api/crm/dashboard/lead-pipeline             open leads per stage
 *   /api/crm/dashboard/opportunity-pipeline      open opportunities per stage, with values
 *   /api/crm/dashboard/leads-attention           ?StagnantDays= (paged)
 *   /api/crm/dashboard/opportunities-attention   ?StagnantDays= (paged)
 *   /api/crm/dashboard/expected-closures         ?FromDate=&ToDate= (paged)
 *   /api/crm/dashboard/monthly-sales-summary     ?MonthCount=
 */
import type { Money } from '../data/dashboard'
import { spectrumEndpoints } from './endpoints'
import { assertSuccess } from './fillValues'
import { http } from './http'
import type { SpectrumPage } from './leads'
import { withQuery } from './query'

type Query = Record<string, string | number | undefined>

export interface DashboardUser {
  loginNo: number
  loginId?: string | null
  printingName?: string | null
  email?: string | null
}

export interface DashboardCurrency {
  currencyNo: number
  currencyCode?: string | null
  symbol?: string | null
}

export interface DashboardMoney {
  currency?: DashboardCurrency | null
  value: number
}

export interface DashboardBusinessEntity {
  businessEntityNo: number
  businessEntityName?: string | null
  code?: string | null
}

export interface DashboardProduct {
  productNo: number
  productName?: string | null
}

export interface DashboardNextActivity {
  activityDetailNo: number
  subject?: string | null
  dueDate?: string | null
  isOverdue: boolean
}

export interface DashboardOpenActivity {
  /** `Lead` or `Opportunity`. */
  recordType?: string | null
  activityDetailNo: number
  /** The opportunity activity's own number — what `save-activity-detail` takes. */
  opportunityActivityDetailNo?: number | null
  leadNo?: number | null
  opportunityNo?: number | null
  recordCode?: string | null
  recordName?: string | null
  recordStage?: { stageNo: number; stageName?: string | null; sequence?: number | null; colorCoding?: string | null } | null
  activityType?: { activityTypeNo: number; activityTypeName?: string | null } | null
  subject?: string | null
  dueDate?: string | null
  isOverdue: boolean
  assignTo?: DashboardUser | null
  notesOutcome?: string | null
  status?: { statusNo: number; statusName?: string | null } | null
  closureDate?: string | null
  completionRemark?: string | null
  createdDate?: string | null
  modifiedDate?: string | null
}

export interface DashboardOpenActivitiesTotals {
  openActivityCount: number
  overdueActivityCount: number
  dueTodayCount: number
  leadActivityCount: number
  opportunityActivityCount: number
}

export interface DashboardLeadStage {
  leadStageNo: number
  leadStageName?: string | null
  sequence?: number | null
  colorCoding?: string | null
  leadCount: number
}

export interface DashboardLeadPipelineTotals {
  openLeadCount: number
  stageCount: number
}

export interface DashboardOpportunityStage {
  opportunityStageNo: number
  opportunityStageName?: string | null
  sequence?: number | null
  weightage?: number | null
  colorCoding?: string | null
  opportunityCount: number
  opportunityValue?: DashboardMoney[] | null
  weightedValue?: DashboardMoney[] | null
}

export interface DashboardOpportunityPipelineTotals {
  openOpportunityCount: number
  opportunityValue?: DashboardMoney[] | null
  weightedValue?: DashboardMoney[] | null
  stageCount: number
}

export interface DashboardLeadAttention {
  leadNo: number
  code?: string | null
  leadName?: string | null
  businessEntity?: DashboardBusinessEntity | null
  products?: DashboardProduct[] | null
  leadStage?: { leadStageNo: number; leadStageName?: string | null; colorCoding?: string | null } | null
  leadStatus?: { leadStatusNo: number; leadStatusName?: string | null } | null
  leadOwner?: DashboardUser | null
  createdDate?: string | null
  leadAgeDays: number
  stageChangedDate?: string | null
  daysInStage: number
  lastActivityDate?: string | null
  nextActivity?: DashboardNextActivity | null
  reasons?: string[] | null
}

export interface DashboardLeadsAttentionTotals {
  attentionLeadCount: number
  notStartedCount: number
  activityOverdueCount: number
  stagnantCount: number
  stagnantDays: number
}

export interface DashboardOpportunityStageRef {
  opportunityStageNo: number
  opportunityStageName?: string | null
  colorCoding?: string | null
  weightage?: number | null
}

export interface DashboardOpportunityAttention {
  opportunityNo: number
  code?: string | null
  opportunityName?: string | null
  businessEntity?: DashboardBusinessEntity | null
  products?: DashboardProduct[] | null
  opportunityValue?: number | null
  currency?: DashboardCurrency | null
  opportunityStage?: DashboardOpportunityStageRef | null
  opportunityStatus?: { opportunityStatusNo: number; opportunityStatusName?: string | null } | null
  opportunityOwner?: DashboardUser | null
  expectedClosureDate?: string | null
  stageChangedDate?: string | null
  daysInStage: number
  lastActivityDate?: string | null
  nextActivity?: DashboardNextActivity | null
  reasons?: string[] | null
}

export interface DashboardOpportunitiesAttentionTotals {
  attentionOpportunityCount: number
  notStartedCount: number
  activityOverdueCount: number
  stagnantCount: number
  stagnantDays: number
  opportunityValue?: DashboardMoney[] | null
}

export interface DashboardExpectedClosure {
  opportunityNo: number
  code?: string | null
  opportunityName?: string | null
  businessEntity?: DashboardBusinessEntity | null
  opportunityValue?: number | null
  currency?: DashboardCurrency | null
  opportunityStage?: DashboardOpportunityStageRef | null
  weightedValue: number
  expectedClosureDate?: string | null
  lastActivity?: {
    activityDetailNo: number
    subject?: string | null
    activityTypeName?: string | null
    activityDate?: string | null
    /** The last activity's remark — shown in the Remark column. */
    notesOutcome?: string | null
  } | null
  pendingActivityCount: number
  overdueActivityCount: number
  /** The opportunity's newest internal note (Remark column); null when it has none. */
  latestNote?: { notesDetailNo?: number; notesDiscussion?: string | null; notesDate?: string | null; originatedBy?: string | null } | null
}

export interface DashboardExpectedClosuresTotals {
  fromDate?: string | null
  toDate?: string | null
  closingCount: number
  opportunityValue?: DashboardMoney[] | null
  weightedValue?: DashboardMoney[] | null
  pendingActivityCount: number
}

export interface DashboardMonthlySales {
  month?: string | null
  monthName?: string | null
  createdCount: number
  wonCount: number
  wonValue?: DashboardMoney[] | null
  lostCount: number
  lostValue?: DashboardMoney[] | null
}

export interface DashboardMonthlySalesTotals {
  createdCount: number
  wonCount: number
  wonValue?: DashboardMoney[] | null
  lostCount: number
  lostValue?: DashboardMoney[] | null
}

/** Rows plus the server's totals for one dashboard section. */
export interface DashboardResult<Row, Totals> {
  rows: Row[]
  totals: Totals | null
}

interface DashboardResponse<Row, Totals> extends SpectrumPage<Row> {
  totals?: Totals | null
}

/** Rows per request; the tables page, sort and search on the client. */
const PAGE_SIZE = 500
/** Safety stop for a server that never reports its last page. */
const MAX_PAGES = 20

/**
 * Identical GETs already on the way share one request (React StrictMode runs the dashboard's effects
 * twice in development). Forgotten once settled, so a reload or retry fetches fresh data.
 */
const inFlight = new Map<string, Promise<unknown>>()

function getShared<T>(url: string): Promise<T> {
  const pending = inFlight.get(url)
  if (pending) return pending as Promise<T>
  const next = http.get<T>(url).finally(() => inFlight.delete(url))
  inFlight.set(url, next)
  return next
}

async function getOnce<Row, Totals>(path: string, query: Query): Promise<DashboardResult<Row, Totals>> {
  const response = await getShared<DashboardResponse<Row, Totals>>(withQuery(path, query))
  assertSuccess(response)
  return { rows: response.data ?? [], totals: response.totals ?? null }
}

/** Every page of a paged dashboard list; totals come from the first page. */
async function getAllPages<Row, Totals>(path: string, query: Query): Promise<DashboardResult<Row, Totals>> {
  const rows: Row[] = []
  let totals: Totals | null = null
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const response = await getShared<DashboardResponse<Row, Totals>>(withQuery(path, { ...query, PageNo: pageNo, PageSize: PAGE_SIZE }))
    assertSuccess(response)
    if (pageNo === 1) totals = response.totals ?? null
    const page = response.data ?? []
    rows.push(...page)
    const totalPages = Number(response.totalPages) || 0
    if (page.length < PAGE_SIZE || (totalPages && pageNo >= totalPages)) break
  }
  return { rows, totals }
}

/** Server amounts (one per currency) → the app's `{ value, currency }`. */
export function toMoney(list: readonly DashboardMoney[] | null | undefined): Money[] {
  return (list ?? []).map((m) => ({ value: Number(m.value) || 0, currency: m.currency?.currencyCode || undefined }))
}

/** `YYYY-MM-DD` part of a server date-time, or '' when missing. */
export function isoDay(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

export function getOpenActivities(companyNo: number) {
  return getAllPages<DashboardOpenActivity, DashboardOpenActivitiesTotals>(spectrumEndpoints.dashboard.openActivities, {
    CompanyNo: companyNo,
    OnlyOpenRecords: 'true',
  })
}

export function getLeadPipeline(companyNo: number) {
  return getOnce<DashboardLeadStage, DashboardLeadPipelineTotals>(spectrumEndpoints.dashboard.leadPipeline, { CompanyNo: companyNo })
}

export function getOpportunityPipeline(companyNo: number) {
  return getOnce<DashboardOpportunityStage, DashboardOpportunityPipelineTotals>(spectrumEndpoints.dashboard.opportunityPipeline, {
    CompanyNo: companyNo,
  })
}

export function getLeadsAttention(companyNo: number, stagnantDays: number) {
  return getAllPages<DashboardLeadAttention, DashboardLeadsAttentionTotals>(spectrumEndpoints.dashboard.leadsAttention, {
    CompanyNo: companyNo,
    StagnantDays: stagnantDays,
  })
}

export function getOpportunitiesAttention(companyNo: number, stagnantDays: number) {
  return getAllPages<DashboardOpportunityAttention, DashboardOpportunitiesAttentionTotals>(
    spectrumEndpoints.dashboard.opportunitiesAttention,
    { CompanyNo: companyNo, StagnantDays: stagnantDays },
  )
}

/** `from` / `to` as `YYYY-MM-DD`. */
export function getExpectedClosures(companyNo: number, from: string, to: string) {
  return getAllPages<DashboardExpectedClosure, DashboardExpectedClosuresTotals>(spectrumEndpoints.dashboard.expectedClosures, {
    CompanyNo: companyNo,
    FromDate: from,
    ToDate: to,
  })
}

export function getMonthlySalesSummary(companyNo: number, monthCount = 6) {
  return getOnce<DashboardMonthlySales, DashboardMonthlySalesTotals>(spectrumEndpoints.dashboard.monthlySalesSummary, {
    CompanyNo: companyNo,
    MonthCount: monthCount,
  })
}
