/**
 * Lead / opportunity status changes with a remark, Won order details and a status history.
 *
 * The remark rule is the server's: `isRemarkRequired` on the status fill values (StatusOption.isRemarkMandatory).
 * The remark is saved with the status on leads/save (`leadStatusRemarks`) · opportunities/save
 * (`opportunityStatusRemarks`).
 *
 * Still pending (docs/Point3_Point4_Backend_Schema.md):
 *   POST /api/crm/leads/change-status                  { leadNo, leadStatusNo, remark? }
 *   POST /api/crm/opportunities/change-status          { opportunityNo, opportunityStatusNo, remark?, orderValue?, orderDate? }
 *   GET  /api/crm/{leads|opportunities}/status-history/{id}   latest first
 *   isWon on the opportunity status master
 *
 * Mock mode (default, see pendingApiStore.ts): the Won rule, order details and history are kept in this browser.
 */
import type { Lead, LeadStage, LeadStatus, LeadStatusLog } from '../data/leads'
import type { LeadFormFillValues } from './leadFormFillValues'
import type { OpportunityFormFillValues } from './opportunityFormFillValues'
import type { DealStage, Opportunity, OpportunityStatus } from '../data/opportunities'
import { isAdmin } from '../auth/users'
import { spectrumEndpoints } from './endpoints'
import { fail } from './errors'
import { assertSuccess, type SpectrumResponse } from './fillValues'
import { http } from './http'
import type { ServerUserRef, SpectrumPage } from './leads'
import { rememberPerson } from './people'
import { refreshServerLead, updateServerLead } from './leadSync'
import { refreshServerOpportunity, updateServerOpportunity } from './opportunitySync'
import {
  PENDING_API_MODE,
  getPendingData,
  updatePendingData,
  type OpportunityOrder,
  type PendingApiData,
  type StatusHistoryEntry,
  type StatusRecordType,
  type StoredStatusRule,
} from './pendingApiStore'
import { withQuery } from './query'
import { getSessionSync } from './session'

export type { StatusHistoryEntry, StatusRecordType } from './pendingApiStore'

/** Remark length the backend stores (nvarchar(1000)). */
export const STATUS_REMARK_MAX = 1000

/** A status as the fill values list it (number, name and the flags). */
export interface StatusOption {
  no: number
  name: string
  /** The fill values' `isRemarkRequired`. */
  isRemarkMandatory?: boolean
  isWon?: boolean
  /** The stage the status belongs to (fill values `leadStageNo` / `opportunityStageNo`); none when unlinked. */
  stageName?: string
  stageNo?: number
  /** The status type (Converted, Won, Lost, …) when the fill values carry it. */
  typeName?: string
}

/** The name of the item numbered `no` in `list`, or undefined. */
function nameOfNo<T>(list: readonly T[] | undefined, no: number | null | undefined, key: (x: T) => number, name: (x: T) => string): string | undefined {
  const hit = no ? (list ?? []).find((x) => key(x) === no) : undefined
  return hit ? name(hit) : undefined
}

/** The lead statuses of the fill values, as the Change Status drawer lists them (with the remark rule and linked stage). */
export function leadStatusOptions(
  fill: Pick<LeadFormFillValues, 'leadStatuses'> & Partial<Pick<LeadFormFillValues, 'leadStages'>> | null | undefined,
): StatusOption[] {
  return (fill?.leadStatuses ?? []).map((s) => ({
    no: s.leadStatusNo,
    name: s.leadStatusName,
    isRemarkMandatory: s.isRemarkRequired,
    stageName: nameOfNo(fill?.leadStages, s.leadStageNo, (x) => x.leadStageNo, (x) => x.leadStageName),
    stageNo: s.leadStageNo ?? undefined,
    typeName: s.leadStatusTypeName ?? s.leadStatusType?.leadStatusTypeName ?? undefined,
  }))
}

/** The opportunity statuses of the fill values, as the Change Status drawer lists them. */
export function opportunityStatusOptions(
  fill: Pick<OpportunityFormFillValues, 'opportunityStatuses'> & Partial<Pick<OpportunityFormFillValues, 'opportunityStages'>> | null | undefined,
): StatusOption[] {
  return (fill?.opportunityStatuses ?? []).map((s) => ({
    no: s.opportunityStatusNo,
    name: s.opportunityStatusName,
    isRemarkMandatory: s.isRemarkRequired,
    isWon: s.isWon,
    stageName: nameOfNo(fill?.opportunityStages, s.opportunityStageNo, (x) => x.opportunityStageNo, (x) => x.opportunityStageName),
    stageNo: s.opportunityStageNo ?? undefined,
    typeName: s.oppStatusTypeName ?? s.oppStatusType?.oppStatusTypeName ?? undefined,
  }))
}

// ─── Status type and linked stage ─────────────────────────────────────────────
// The fill values do not carry the status type yet: until they do, the status name stands in for it
// ("Converted", "Won" / "Closed Won", "Lost" / "Closed Lost").

const typeText = (status: StatusOption) => (status.typeName || status.name).trim()
const sameStageName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ')

/** A lead status of type Converted: choosing it converts the lead to an opportunity. */
export function isConvertedStatus(status: StatusOption | undefined): boolean {
  return Boolean(status && /\bconvert/i.test(typeText(status)))
}

/** Won or Lost, for an opportunity status of either type; undefined for the others. */
export function closingStatusType(status: StatusOption | undefined): 'Won' | 'Lost' | undefined {
  if (!status) return undefined
  if (status.isWon || /\bwon\b/i.test(typeText(status))) return 'Won'
  if (/\blost\b/i.test(typeText(status))) return 'Lost'
  return undefined
}

/** Why `status` cannot go with the stage `stageName` (it belongs to another stage), or undefined. */
export function stageMismatch(status: StatusOption | undefined, stageName: string): string | undefined {
  if (!status?.stageName || sameStageName(status.stageName, stageName)) return undefined
  return `Status "${status.name}" belongs to the stage "${status.stageName}". Select that stage, or another status.`
}

/** Lead: every status linked to a stage must go with that stage. */
export function leadStatusStageError(status: StatusOption | undefined, stageName: string): string | undefined {
  return stageMismatch(status, stageName)
}

/** Opportunity: a Won or Lost status must go with its linked stage. */
export function opportunityStatusStageError(status: StatusOption | undefined, stageName: string): string | undefined {
  return closingStatusType(status) ? stageMismatch(status, stageName) : undefined
}

export interface StatusRule {
  isRemarkMandatory: boolean
  /** Opportunity only: Order Value and Order Date are required. */
  isWon: boolean
}

/** Until a Won flag is saved for a status, "Won" / "Closed Won" counts as the Won status. */
const WON_NAME = /^(closed\s+)?won$/i

const ruleKey = (record: StatusRecordType) => (record === 'Lead' ? 'lead' : 'opportunity')

/**
 * The rules for one status: the remark from the server's `isRemarkRequired`; Won from the server's flag
 * (server mode) or the one saved in Settings (mock).
 */
export function statusRule(record: StatusRecordType, option: StatusOption | undefined, data: PendingApiData = getPendingData()): StatusRule {
  if (!option) return { isRemarkMandatory: false, isWon: false }
  const isRemarkMandatory = Boolean(option.isRemarkMandatory)
  if (PENDING_API_MODE === 'server') return { isRemarkMandatory, isWon: record === 'Opportunity' && Boolean(option.isWon) }
  const stored = data.rules[ruleKey(record)][option.no]
  return { isRemarkMandatory, isWon: record === 'Opportunity' && (stored?.isWon ?? WON_NAME.test(option.name.trim())) }
}

/** Mock: save the status rules (admins only). In server mode the flags are saved with the status masters. */
export function saveStatusRules(record: StatusRecordType, rules: Record<number, StoredStatusRule>) {
  if (!isAdmin(getSessionSync()?.role)) fail('FORBIDDEN', 'Only an administrator can change status rules.')
  updatePendingData((data) => ({ ...data, rules: { ...data.rules, [ruleKey(record)]: { ...rules } } }))
}

/** Mock: the rules of one status, as the status master form saves them (admins only). */
export function saveStatusRule(record: StatusRecordType, statusNo: number, rule: StoredStatusRule) {
  const current = getPendingData().rules[ruleKey(record)]
  saveStatusRules(record, { ...current, [statusNo]: record === 'Opportunity' ? rule : { isRemarkMandatory: rule.isRemarkMandatory } })
}

export interface StatusChangeDraft {
  newStatus?: StatusOption
  currentStatusName: string
  remark: string
  /** Typed amount (string from the input) or a number. */
  orderValue?: string | number
  /** `YYYY-MM-DD`. */
  orderDate?: string
}

export type StatusChangeErrors = Partial<Record<'status' | 'remark' | 'orderValue' | 'orderDate', string>>

const sameName = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

export function parseOrderValue(value: string | number | undefined): number {
  if (typeof value === 'number') return value
  return Number(String(value ?? '').replace(/[^\d.]/g, '')) || 0
}

/**
 * The rules the backend enforces, checked here before sending (and by the mock in place of the server):
 * a new status, the remark when its status requires one (max 1000), and Order Value > 0 / Order Date for Won.
 */
export function validateStatusChange(draft: StatusChangeDraft, rule: StatusRule): StatusChangeErrors {
  const errors: StatusChangeErrors = {}
  const status = draft.newStatus
  if (!status) {
    errors.status = 'Select the new status'
    return errors
  }
  if (sameName(status.name, draft.currentStatusName)) errors.status = `Status is already ${status.name}`
  const remark = draft.remark.trim()
  if (rule.isRemarkMandatory && !remark) errors.remark = `Remark is mandatory for status ${status.name}`
  else if (remark.length > STATUS_REMARK_MAX) errors.remark = `Remark cannot exceed ${STATUS_REMARK_MAX} characters`
  if (rule.isWon) {
    if (!(parseOrderValue(draft.orderValue) > 0)) errors.orderValue = 'Order Value is mandatory for Won'
    const date = draft.orderDate ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) errors.orderDate = 'Order Date is mandatory for Won'
  }
  return errors
}

function assertValid(draft: StatusChangeDraft, rule: StatusRule) {
  const first = Object.values(validateStatusChange(draft, rule))[0]
  if (first) fail('VALIDATION', first)
}

/** Who is changing it — the server takes this from the token; the mock from the signed-in session. */
function currentUser(): StatusHistoryEntry['changedBy'] {
  const user = getSessionSync()
  const loginNo = Number(user?.id.replace(/^SPX-/, ''))
  return { loginNo: Number.isInteger(loginNo) && loginNo > 0 ? loginNo : undefined, name: user?.name ?? 'Unknown user' }
}

function appendHistory(entry: Omit<StatusHistoryEntry, 'statusChangeHistoryNo' | 'changedBy' | 'changedDate'>) {
  const changedDate = new Date().toISOString()
  updatePendingData((data) => ({
    ...data,
    history: [
      { ...entry, statusChangeHistoryNo: Date.now(), changedBy: currentUser(), changedDate },
      ...data.history,
    ],
  }))
}

/**
 * A lead status changed on the lead form (saved with the form's own save): the history entry the Change
 * Status drawer would write. Mock only; the server keeps its own log.
 */
export function recordLeadStatusChange(leadNo: number, previousStatusName: string, newStatus: StatusOption, remark: string) {
  if (PENDING_API_MODE === 'server') return
  appendHistory({
    recordType: 'Lead',
    recordNo: leadNo,
    previousStatusName: previousStatusName || undefined,
    newStatusNo: newStatus.no,
    newStatusName: newStatus.name,
    remark: remark.trim() || undefined,
  })
}

export interface LeadStatusChange {
  newStatus: StatusOption
  remark: string
}

export async function changeLeadStatus(lead: Lead, change: LeadStatusChange): Promise<void> {
  const leadNo = lead.spectrum?.leadNo
  if (!leadNo) fail('VALIDATION', 'This lead is not stored on the server.')
  const draft: StatusChangeDraft = { ...change, currentStatusName: lead.leadStatus }
  assertValid(draft, statusRule('Lead', change.newStatus))
  const remark = change.remark.trim() || undefined
  // A status linked to a stage moves the lead to that stage too.
  const stage = change.newStatus.stageName

  if (PENDING_API_MODE === 'server') {
    assertSuccess(
      await http.post<SpectrumResponse<unknown>>(spectrumEndpoints.leads.changeStatus, {
        leadNo,
        leadStatusNo: change.newStatus.no,
        ...(change.newStatus.stageNo ? { leadStageNo: change.newStatus.stageNo } : {}),
        remark,
      }),
    )
    await refreshServerLead(leadNo)
    return
  }

  // Saved on the server first (with its remark); the history entry is written only once that succeeded.
  await updateServerLead(
    lead,
    { leadStatus: change.newStatus.name as LeadStatus, ...(stage ? { leadStage: stage as LeadStage } : {}) },
    { statusRemarks: remark ?? null },
  )
  appendHistory({
    recordType: 'Lead',
    recordNo: leadNo,
    previousStatusName: lead.leadStatus || undefined,
    newStatusNo: change.newStatus.no,
    newStatusName: change.newStatus.name,
    remark,
  })
}

export interface OpportunityStatusChange {
  newStatus: StatusOption
  remark: string
  orderValue?: string | number
  orderDate?: string
}

export async function changeOpportunityStatus(opportunity: Opportunity, change: OpportunityStatusChange): Promise<void> {
  const opportunityNo = opportunity.spectrum?.opportunityNo
  if (!opportunityNo) fail('VALIDATION', 'This opportunity is not stored on the server.')
  const rule = statusRule('Opportunity', change.newStatus)
  assertValid({ ...change, currentStatusName: opportunity.status }, rule)
  const remark = change.remark.trim() || undefined
  // A status linked to a stage moves the opportunity to that stage too.
  const stage = change.newStatus.stageName
  // Order details only go with the Won status.
  const order: OpportunityOrder | undefined = rule.isWon
    ? { orderValue: parseOrderValue(change.orderValue), orderDate: change.orderDate! }
    : undefined

  if (PENDING_API_MODE === 'server') {
    assertSuccess(
      await http.post<SpectrumResponse<unknown>>(spectrumEndpoints.opportunities.changeStatus, {
        opportunityNo,
        opportunityStatusNo: change.newStatus.no,
        ...(change.newStatus.stageNo ? { opportunityStageNo: change.newStatus.stageNo } : {}),
        remark,
        ...order,
      }),
    )
    await refreshServerOpportunity(opportunityNo)
    return
  }

  // Won: the order value / date become the opportunity value and expected closure date of the save.
  await updateServerOpportunity(
    opportunity,
    {
      status: change.newStatus.name as OpportunityStatus,
      ...(stage ? { dealStage: stage as DealStage } : {}),
      ...(order ? { dealValue: order.orderValue, closingDate: order.orderDate } : {}),
    },
    { statusRemarks: remark ?? null },
  )
  if (order) updatePendingData((data) => ({ ...data, orders: { ...data.orders, [opportunityNo]: order } }))
  appendHistory({
    recordType: 'Opportunity',
    recordNo: opportunityNo,
    previousStatusName: opportunity.status || undefined,
    newStatusNo: change.newStatus.no,
    newStatusName: change.newStatus.name,
    remark,
    ...order,
  })
}

/** Order Value / Order Date of a Won opportunity (server fields, or the mock's), or undefined. */
export function opportunityOrder(opportunity: Opportunity, data: PendingApiData = getPendingData()): OpportunityOrder | undefined {
  const ref = opportunity.spectrum
  if (!ref) return undefined
  if (PENDING_API_MODE === 'server') {
    return ref.orderValue && ref.orderDate ? { orderValue: ref.orderValue, orderDate: ref.orderDate } : undefined
  }
  return data.orders[ref.opportunityNo]
}

// ─── History ──────────────────────────────────────────────────────────────────

/** A server status log row and a mock entry this close together (same new status) are one change. */
const SAME_CHANGE_MS = 5 * 60_000

const time = (iso: string) => {
  const at = Date.parse(iso)
  return Number.isFinite(at) ? at : 0
}

/**
 * Mock history: this browser's entries (with remarks) plus the lead's server status log for changes made
 * elsewhere — previous status taken from the log order, and log rows a browser entry already covers left out.
 * Latest first.
 */
export function mergeStatusHistory(
  record: StatusRecordType,
  recordNo: number,
  entries: readonly StatusHistoryEntry[],
  serverLogs: readonly LeadStatusLog[] = [],
): StatusHistoryEntry[] {
  const own = entries.filter((e) => e.recordType === record && e.recordNo === recordNo)
  const logs = [...serverLogs].sort((a, b) => time(a.at) - time(b.at))
  const fromLogs: StatusHistoryEntry[] = logs.map((log, i) => ({
    statusChangeHistoryNo: -log.no,
    recordType: record,
    recordNo,
    previousStatusName: logs[i - 1]?.statusName,
    newStatusNo: log.statusNo,
    newStatusName: log.statusName,
    changedBy: { loginNo: log.byLoginNo, name: log.by },
    changedDate: log.at,
  }))
  const covered = (row: StatusHistoryEntry) =>
    own.some((e) => sameName(e.newStatusName, row.newStatusName) && Math.abs(time(e.changedDate) - time(row.changedDate)) <= SAME_CHANGE_MS)
  return [...own, ...fromLogs.filter((row) => !covered(row))].sort((a, b) => time(b.changedDate) - time(a.changedDate))
}

/** Row of the pending `status-history` endpoint. */
interface ServerStatusHistoryRow {
  statusChangeHistoryNo: number
  recordType?: StatusRecordType
  recordNo: number
  previousStatus?: { leadStatusNo?: number; opportunityStatusNo?: number; leadStatusName?: string | null; opportunityStatusName?: string | null } | null
  newStatus?: { leadStatusNo?: number; opportunityStatusNo?: number; leadStatusName?: string | null; opportunityStatusName?: string | null } | null
  remark?: string | null
  orderValue?: number | null
  orderDate?: string | null
  changedBy?: ServerUserRef | null
  changedDate?: string | null
}

function fromServerRow(record: StatusRecordType, row: ServerStatusHistoryRow): StatusHistoryEntry {
  const name = (s: ServerStatusHistoryRow['newStatus']) => s?.leadStatusName ?? s?.opportunityStatusName ?? undefined
  return {
    statusChangeHistoryNo: row.statusChangeHistoryNo,
    recordType: row.recordType ?? record,
    recordNo: row.recordNo,
    previousStatusNo: row.previousStatus?.leadStatusNo ?? row.previousStatus?.opportunityStatusNo,
    previousStatusName: name(row.previousStatus),
    newStatusNo: row.newStatus?.leadStatusNo ?? row.newStatus?.opportunityStatusNo,
    newStatusName: name(row.newStatus) ?? '',
    remark: row.remark ?? undefined,
    orderValue: row.orderValue ?? undefined,
    orderDate: row.orderDate?.slice(0, 10) ?? undefined,
    changedBy: { loginNo: row.changedBy?.loginNo, name: rememberPerson(row.changedBy) || row.changedBy?.loginId || '' },
    changedDate: row.changedDate ?? '',
  }
}

/** Server mode: the record's status history, latest first (first 100). */
export async function fetchStatusHistory(record: StatusRecordType, recordNo: number): Promise<StatusHistoryEntry[]> {
  const base = record === 'Lead' ? spectrumEndpoints.leads.statusHistory : spectrumEndpoints.opportunities.statusHistory
  const response = await http.get<SpectrumPage<ServerStatusHistoryRow>>(
    withQuery(`${base}/${recordNo}`, { PageNo: 1, PageSize: 100, SortingColumnName: 'ChangedDate', SortingType: 'DESC' }),
  )
  assertSuccess(response)
  return (response.data ?? []).map((row) => fromServerRow(record, row))
}
