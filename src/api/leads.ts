/**
 * Spectrum lead APIs (from the backend Swagger).
 *
 *   POST   /api/crm/leads/save             create (leadNo omitted) / update
 *   GET    /api/crm/leads/search-data      ?CompanyNo=
 *   GET    /api/crm/leads/load-data/{id}
 *   DELETE /api/crm/leads/delete           ?leadNo=
 */
import { spectrumEndpoints } from './endpoints'
import { assertSuccess, type SpectrumResponse } from './fillValues'
import { fail } from './errors'
import { http } from './http'
import { repeatedQuery, withQuery } from './query'
import type { LeadFormFillValues } from './leadFormFillValues'

export interface LeadSaveContact {
  businessEntityContactPersonDetailNo: number
  isPrimary: boolean
}

export interface LeadSaveActivity {
  activityTypeNo: number
  subject?: string
  /** ISO date-time. */
  dueDate: string
  assignToLoginNo?: number
  notesOutcome?: string
  /** ISO date-time — with the "Closed" status. */
  closureDate?: string
  /** With the "Completed" status (Mark Complete). */
  completionRemark?: string
  statusNo: number
}

export interface LeadSaveNote {
  originatedBy?: string
  /** ISO date-time. */
  notesDate: string
  notesDiscussion?: string
}

/** Body of `POST /api/crm/leads/save`. */
export interface LeadSaveBody {
  leadNo?: number
  companyNo: number
  description?: string
  leadOwnerNo: number
  leadSourceNo: number
  /** ISO date-time. */
  leadDate: string
  leadName?: string
  salesOrganizationNo?: number
  leadStageNo: number
  leadStatusNo: number
  currencyNo?: number
  estimatedAmount?: number
  businessEntityNo?: number
  leadPriorityNo: number
  contacts?: LeadSaveContact[]
  products?: { crmProductNo: number }[]
  activities?: LeadSaveActivity[]
  notes?: LeadSaveNote[]
  /** Uploaded document-store files to link. */
  attachments?: { docNo: number }[]
}

export async function saveLead(body: LeadSaveBody): Promise<number> {
  const response = await http.post<SpectrumResponse<{ leadNo: number } | null>>(spectrumEndpoints.leads.save, body)
  assertSuccess(response)
  return Number(response.data?.leadNo ?? body.leadNo)
}

// ─── Read / delete ────────────────────────────────────────────────────────────

export interface ServerUserRef {
  loginNo: number
  loginId?: string | null
  printingName?: string | null
  email?: string | null
}

/** Contact person reference (`CrmContactPersonRefModel`). */
export interface ContactPersonRef {
  businessEntityContactPersonDetailNo: number
  contactPersonName?: string | null
}

/** Product reference nested in detail rows. */
export interface CrmProductRef {
  crmProductNo: number
  productName?: string | null
  code?: string | null
}

/**
 * Contact row of a lead / opportunity. Current API nests the person in `businessEntityContactPerson`;
 * the flat fields are the earlier shape, still accepted in case an older server answers.
 */
export interface DetailContactRow {
  businessEntityContactPerson?: ContactPersonRef | null
  isPrimary?: boolean
  /** @deprecated earlier flat shape */
  businessEntityContactPersonDetailNo?: number
  /** @deprecated earlier flat shape */
  contactPersonName?: string | null
}

/** Product row of a lead / opportunity (current: nested `crmProduct`; earlier: flat). */
export interface DetailProductRow {
  crmProduct?: CrmProductRef | null
  /** @deprecated earlier flat shape */
  crmProductNo?: number
  /** @deprecated earlier flat shape */
  productName?: string | null
}

/** Contact person number / name from either shape. */
export function contactRowNo(row: DetailContactRow): number | undefined {
  return row.businessEntityContactPerson?.businessEntityContactPersonDetailNo ?? row.businessEntityContactPersonDetailNo
}

export function contactRowName(row: DetailContactRow): string {
  return row.businessEntityContactPerson?.contactPersonName ?? row.contactPersonName ?? ''
}

export function productRowNo(row: DetailProductRow): number | undefined {
  return row.crmProduct?.crmProductNo ?? row.crmProductNo
}

export function productRowName(row: DetailProductRow): string {
  return row.crmProduct?.productName ?? row.productName ?? ''
}

/**
 * Row of `GET /api/crm/leads/search-data`. The current API nests every reference (`leadStage: {…}`),
 * like load-data; the flat `…No` / `…Name` fields are the earlier shape, still read as a fallback.
 */
export interface LeadSearchRow {
  leadNo: number
  code?: string | null
  description?: string | null
  leadName?: string | null
  leadDate?: string | null
  company?: { companyNo: number; companyAlias?: string | null; companyName?: string | null } | null
  leadOwner?: ServerUserRef | null
  leadSource?: { leadSourceNo: number; leadSourceName?: string | null; code?: string | null } | null
  salesOrganization?: { salesOrganizationNo: number; salesOrganizationName?: string | null } | null
  leadStage?: { leadStageNo: number; leadStageName?: string | null; colorCoding?: string | null; isStagedCompleted?: boolean | null } | null
  leadStatus?: { leadStatusNo: number; leadStatusName?: string | null } | null
  leadPriority?: { leadPriorityNo: number; leadPriorityName?: string | null } | null
  businessEntity?: { businessEntityNo: number; businessEntityName?: string | null } | null
  currency?: { currencyNo: number; currencyName?: string | null; currencyCode?: string | null; symbol?: string | null; currencyNotation?: string | null } | null
  estimatedAmount?: number | null
  createdBy?: ServerUserRef | null
  createdDate?: string | null
  /** A user object; a bare login number is also accepted (earlier servers). */
  modifiedBy?: ServerUserRef | number | null
  modifiedDate?: string | null
  /** When the lead's latest activity happened (search-data only). */
  lastActivityDate?: string | null
  contacts?: (DetailContactRow & { leadContactDetailNo?: number })[] | null
  /** @deprecated earlier flat shape */ salesOrganizationNo?: number | null
  /** @deprecated earlier flat shape */ salesOrganizationName?: string | null
  /** @deprecated earlier flat shape */ leadStageNo?: number | null
  /** @deprecated earlier flat shape */ leadStageName?: string | null
  /** @deprecated earlier flat shape */ leadStatusNo?: number | null
  /** @deprecated earlier flat shape */ leadStatusName?: string | null
  /** @deprecated earlier flat shape */ currencyNo?: number | null
  /** @deprecated earlier flat shape */ currencyName?: string | null
  /** @deprecated earlier flat shape */ currencyNotation?: string | null
  /** @deprecated earlier flat shape */ businessEntityNo?: number | null
  /** @deprecated earlier flat shape */ businessEntityName?: string | null
  /** @deprecated earlier flat shape */ leadPriorityNo?: number | null
  /** @deprecated earlier flat shape */ leadPriorityName?: string | null
}

/** Paged list envelope of the search-data endpoints. */
export interface SpectrumPage<T> extends SpectrumResponse<T[] | null> {
  pageNo?: number
  pageSize?: number
  totalRecords?: number
  totalPages?: number
}

/** Every page of a search-data endpoint (the server pages; the lists show all rows). */
export async function fetchAllPages<T>(path: string, query: Record<string, string | number | undefined>, pageSize = 500): Promise<T[]> {
  const rows: T[] = []
  for (let pageNo = 1; pageNo <= 50; pageNo++) {
    const response = await http.get<SpectrumPage<T>>(withQuery(path, { ...query, PageNo: pageNo, PageSize: pageSize }))
    assertSuccess(response)
    const page = response.data ?? []
    rows.push(...page)
    const totalPages = Number(response.totalPages) || 0
    if (page.length < pageSize || (totalPages && pageNo >= totalPages)) break
  }
  return rows
}

/** `data` of `GET /api/crm/leads/load-data/{id}`. */
export interface LeadDetail {
  leadNo: number
  code?: string | null
  description?: string | null
  leadName?: string | null
  leadDate?: string | null
  leadOwner?: ServerUserRef | null
  leadSource?: { leadSourceNo: number; leadSourceName?: string | null } | null
  salesOrganization?: { salesOrganizationNo: number; salesOrganizationName?: string | null } | null
  leadStage?: { leadStageNo: number; leadStageName?: string | null; isStagedCompleted?: boolean | null } | null
  leadStatus?: { leadStatusNo: number; leadStatusName?: string | null } | null
  currency?: { currencyNo: number; currencyName?: string | null; currencyNotation?: string | null } | null
  estimatedAmount?: number | null
  businessEntity?: { businessEntityNo: number; businessEntityName?: string | null } | null
  leadPriority?: { leadPriorityNo: number; leadPriorityName?: string | null } | null
  contacts?: (DetailContactRow & { leadContactDetailNo?: number })[] | null
  products?: (DetailProductRow & { leadProductDetailNo?: number })[] | null
  notes?: {
    leadNotesDetailNo: number
    originatedBy?: string | null
    notesDate?: string | null
    notesDiscussion?: string | null
    createdBy?: ServerUserRef | null
    createdDate?: string | null
  }[] | null
  activities?: {
    leadActivityDetailNo: number
    activityType?: { activityTypeNo: number; activityTypeName?: string | null } | null
    subject?: string | null
    dueDate?: string | null
    assignTo?: ServerUserRef | null
    notesOutcome?: string | null
    closureDate?: string | null
    completionRemark?: string | null
    status?: { statusNo: number; statusName?: string | null } | null
  }[] | null
  createdBy?: ServerUserRef | null
  createdDate?: string | null
  modifiedBy?: ServerUserRef | null
  modifiedDate?: string | null
}

/** One row of the lead / opportunity timeline endpoints (see timeline.ts). */
export interface ServerTimelineRow {
  title?: string | null
  description?: string | null
  /** e.g. `LeadCreated`, `LeadStatus`, `LeadStage`, `Activity`, `Internal Notes`. */
  timelineType?: string | null
  timelineTypeNo?: number | null
  actionDate?: string | null
  createdBy?: ServerUserRef | null
}

export function searchLeads(companyNo: number): Promise<LeadSearchRow[]> {
  return fetchAllPages<LeadSearchRow>(spectrumEndpoints.leads.search, { CompanyNo: companyNo })
}

/** `POST /api/crm/leads/convert-to-opportunity` → the new opportunity number. */
export async function convertLeadToOpportunity(body: {
  leadNo: number
  currencyNo: number
  opportunityValue?: number
  /** ISO date-time. */
  expectedClosureDate?: string
}): Promise<number> {
  const response = await http.post<SpectrumResponse<{ opportunityNo: number } | null>>(spectrumEndpoints.leads.convert, body)
  assertSuccess(response)
  const opportunityNo = Number(response.data?.opportunityNo)
  if (!opportunityNo) fail('VALIDATION', 'The server did not return the new opportunity number.')
  return opportunityNo
}

export async function loadLead(leadNo: number): Promise<LeadDetail> {
  const response = await http.get<SpectrumResponse<LeadDetail | null>>(`${spectrumEndpoints.leads.loadData}/${leadNo}`)
  assertSuccess(response)
  if (!response.data) fail('NOT_FOUND', 'Lead not found.')
  return response.data
}

export async function deleteLead(leadNo: number): Promise<void> {
  const response = await http.delete<SpectrumResponse<boolean>>(withQuery(spectrumEndpoints.leads.delete, { leadNo }))
  assertSuccess(response)
}

// ─── Form → body ──────────────────────────────────────────────────────────────

/** One activity as the lead form collects it (type and assignee by number, status by name). */
export interface LeadDraftActivity {
  typeNo?: number
  subject: string
  /** `YYYY-MM-DD` from the date input. */
  dueDate: string
  assignToLoginNo?: number
  notesOutcome: string
  /** "Open" or "Closed" (names from the fill values). */
  statusName: string
  /** `YYYY-MM-DD` — sent as `closureDate` when the status is Closed. */
  closureDate?: string
}

/** What the lead form knows at save time: master values by name, everything else by number. */
export interface LeadFormDraft {
  leadNo?: number
  companyNo: number
  leadName: string
  description: string
  leadDate: Date
  ownerLoginNo?: number
  sourceName: string
  stageName: string
  statusName: string
  priorityName: string
  /** Required by the server (`SalesOrganizationNo` is not nullable). */
  salesOrganizationNo?: number
  currencyNo?: number
  estimatedAmount?: number
  businessEntityNo?: number
  contactPersonDetailNo?: number
  /** The form requires both; updates of leads created elsewhere may have neither. Default true. */
  requireEntityAndContact?: boolean
  /** Extra contacts to keep on update (the first overall is primary). */
  otherContactPersonDetailNos?: number[]
  productNos: number[]
  /** Activities to create with the lead (the new-lead form can add several). */
  activities?: LeadDraftActivity[]
  notes: { originatedBy: string; notesDate: Date; notesDiscussion: string }[]
  /** docNos of files uploaded through the document store. */
  attachmentNos?: number[]
}

/** Form field key → message, for fields the server needs but the draft could not supply. */
export type LeadDraftErrors = Record<string, string>

function noByName<T>(items: readonly T[], name: string, getName: (item: T) => string | undefined, getNo: (item: T) => number) {
  const needle = name.trim().toLowerCase()
  const found = items.find((item) => getName(item)?.trim().toLowerCase() === needle)
  return found ? getNo(found) : undefined
}

/** `YYYY-MM-DD` → midnight UTC ISO, so the date does not shift with the browser's time zone. */
function dateOnlyToIso(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : new Date(value).toISOString()
}

/**
 * Resolve the draft against the fill values. Returns the body, or the fields to fix — names that are
 * not in the server lists, or numbers the form never received (e.g. a user picked before they loaded).
 */
export function buildLeadSaveBody(
  draft: LeadFormDraft,
  fill: LeadFormFillValues,
): { body: LeadSaveBody; errors?: undefined } | { body?: undefined; errors: LeadDraftErrors } {
  const errors: LeadDraftErrors = {}
  const leadSourceNo = noByName(fill.leadSources, draft.sourceName, (x) => x.leadSourceName, (x) => x.leadSourceNo)
  const leadStageNo = noByName(fill.leadStages, draft.stageName, (x) => x.leadStageName, (x) => x.leadStageNo)
  const leadStatusNo = noByName(fill.leadStatuses, draft.statusName, (x) => x.leadStatusName, (x) => x.leadStatusNo)
  const leadPriorityNo = noByName(fill.leadPriorities, draft.priorityName, (x) => x.leadPriorityName, (x) => x.leadPriorityNo)

  if (!draft.ownerLoginNo) errors.owner = 'Select the lead owner from the list'
  if (!leadSourceNo) errors.source = 'Select a lead source'
  if (!leadStageNo) errors.stage = 'Select a lead stage'
  if (!leadStatusNo) errors.status = 'Select a lead status'
  if (!leadPriorityNo) errors.priority = 'Select a lead priority'
  if (!draft.salesOrganizationNo) errors.salesOrganization = 'Select a sales organization'
  if (draft.requireEntityAndContact !== false) {
    if (!draft.businessEntityNo) errors.entity = 'Select the business entity from the list'
    if (!draft.contactPersonDetailNo) errors.contact = 'Select a contact person of this business entity'
  }

  const drafts = draft.activities ?? []
  const activities: LeadSaveActivity[] = []
  drafts.forEach((a) => {
    // With several activities, say which one needs fixing.
    const which = drafts.length > 1 ? `Activity "${a.subject.trim() || 'untitled'}": ` : ''
    const statusNo = noByName(fill.activityStatuses, a.statusName, (x) => x.statusName, (x) => x.statusNo)
    if (!a.typeNo) errors.activityType ??= `${which}Select an activity type`
    if (!a.assignToLoginNo) errors.assignedTo ??= `${which}Select the assignee from the list`
    if (!statusNo) errors.activityStatus ??= `${which}Activity status "${a.statusName}" is not set up on the server`
    if (a.typeNo && statusNo) {
      activities.push({
        activityTypeNo: a.typeNo,
        subject: a.subject.trim() || undefined,
        dueDate: dateOnlyToIso(a.dueDate),
        assignToLoginNo: a.assignToLoginNo,
        notesOutcome: a.notesOutcome.trim() || undefined,
        closureDate: /^closed$/i.test(a.statusName.trim()) && a.closureDate ? dateOnlyToIso(a.closureDate) : undefined,
        statusNo,
      })
    }
  })

  if (Object.keys(errors).length) return { errors }

  const body: LeadSaveBody = {
    companyNo: draft.companyNo,
    leadName: draft.leadName.trim() || undefined,
    description: draft.description.trim() || undefined,
    leadDate: draft.leadDate.toISOString(),
    leadOwnerNo: draft.ownerLoginNo!,
    leadSourceNo: leadSourceNo!,
    leadStageNo: leadStageNo!,
    leadStatusNo: leadStatusNo!,
    leadPriorityNo: leadPriorityNo!,
    salesOrganizationNo: draft.salesOrganizationNo,
    businessEntityNo: draft.businessEntityNo,
    currencyNo: draft.currencyNo,
    estimatedAmount: draft.estimatedAmount,
    contacts: [draft.contactPersonDetailNo, ...(draft.otherContactPersonDetailNos ?? [])]
      .filter((no, i, all): no is number => Boolean(no) && all.indexOf(no) === i)
      .map((no, i) => ({ businessEntityContactPersonDetailNo: no, isPrimary: i === 0 })),
    products: draft.productNos.filter((no) => no > 0).map((crmProductNo) => ({ crmProductNo })),
    activities: activities.length ? activities : undefined,
    notes: draft.notes.length
      ? draft.notes.map((n) => ({
          originatedBy: n.originatedBy.trim() || undefined,
          notesDate: n.notesDate.toISOString(),
          notesDiscussion: n.notesDiscussion.trim() || undefined,
        }))
      : undefined,
  }
  if (draft.attachmentNos?.length) body.attachments = draft.attachmentNos.filter((no) => no > 0).map((docNo) => ({ docNo }))
  if (draft.leadNo) body.leadNo = draft.leadNo
  return { body }
}

// ─── Activity / note details of an existing lead ─────────────────────────────

export interface LeadActivityDetailBody extends LeadSaveActivity {
  leadNo: number
  /** Omit to add; set to update that activity. */
  leadActivityDetailNo?: number
}

export interface LeadNoteDetailBody extends LeadSaveNote {
  leadNo: number
  /** Omit to add; set to update that note. */
  leadNotesDetailNo?: number
}

export async function saveLeadActivity(body: LeadActivityDetailBody): Promise<void> {
  assertSuccess(await http.post<SpectrumResponse<boolean>>(spectrumEndpoints.leads.saveActivity, body))
}

export async function saveLeadNote(body: LeadNoteDetailBody): Promise<void> {
  assertSuccess(await http.post<SpectrumResponse<boolean>>(spectrumEndpoints.leads.saveNote, body))
}


export async function deleteLeadActivities(detailNos: number[]): Promise<void> {
  if (!detailNos.length) return
  const url = `${spectrumEndpoints.leads.deleteActivities}?${repeatedQuery('leadActivityDetailNos', detailNos)}`
  assertSuccess(await http.delete<SpectrumResponse<boolean>>(url))
}

export async function deleteLeadNotes(detailNos: number[]): Promise<void> {
  if (!detailNos.length) return
  const url = `${spectrumEndpoints.leads.deleteNotes}?${repeatedQuery('leadNotesDetailNos', detailNos)}`
  assertSuccess(await http.delete<SpectrumResponse<boolean>>(url))
}
