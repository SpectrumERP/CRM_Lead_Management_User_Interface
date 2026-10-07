/**
 * Spectrum opportunity APIs (from the backend Swagger).
 *
 *   POST   /api/crm/opportunities/save            create (opportunityNo omitted) / update
 *   GET    /api/crm/opportunities/search-data     ?CompanyNo=&PageNo=&PageSize=…
 *   GET    /api/crm/opportunities/load-data/{id}
 *   DELETE /api/crm/opportunities/delete          ?opportunityNo=
 *   POST   /api/crm/opportunities/save-notes-detail    add / update one internal note
 *   DELETE /api/crm/opportunities/delete-notes-detail  ?opportunityNotesDetailNos=
 */
import { spectrumEndpoints } from './endpoints'
import { fail } from './errors'
import { assertSuccess, type SpectrumResponse } from './fillValues'
import { http } from './http'
import { fetchAllPages, type DetailContactRow, type DetailProductRow, type ServerUserRef } from './leads'
import type { OpportunityFormFillValues } from './opportunityFormFillValues'
import { repeatedQuery, withQuery } from './query'

/** Body of `POST /api/crm/opportunities/save`. */
export interface OpportunitySaveBody {
  opportunityNo?: number
  companyNo: number
  leadNo?: number
  opportunityName?: string
  opportunityOwnerNo: number
  salesOrganizationNo: number
  opportunityStageNo: number
  businessEntityNo: number
  currencyNo: number
  opportunityStatusNo: number
  /** ISO date-time. */
  expectedClosureDate?: string
  opportunityValue?: number
  contacts?: { businessEntityContactPersonDetailNo: number; isPrimary: boolean }[]
  products?: { crmProductNo: number }[]
  /** Uploaded document-store files to link. */
  attachments?: { docNo: number }[]
}

type Named<K extends string, N extends string> = { [P in K]: number } & { [P in N]?: string | null } & { code?: string | null }

/** Row of `search-data` and the header of `load-data` (same shape). */
export interface OpportunityRow {
  opportunityNo: number
  code?: string | null
  opportunityName?: string | null
  company?: { companyNo: number; companyAlias?: string | null; companyName?: string | null } | null
  lead?: {
    leadNo: number
    code?: string | null
    leadName?: string | null
    leadDate?: string | null
    leadSource?: { leadSourceNo: number; leadSourceName?: string | null; code?: string | null } | null
  } | null
  opportunityStage?: Named<'opportunityStageNo', 'opportunityStageName'> | null
  opportunityStatus?: Named<'opportunityStatusNo', 'opportunityStatusName'> | null
  businessEntity?: Named<'businessEntityNo', 'businessEntityName'> | null
  salesOrganization?: Named<'salesOrganizationNo', 'salesOrganizationName'> | null
  currency?: { currencyNo: number; currencyName?: string | null; currencyCode?: string | null; symbol?: string | null } | null
  opportunityValue?: number | null
  expectedClosureDate?: string | null
  opportunityOwner?: ServerUserRef | null
  createdBy?: ServerUserRef | null
  createdDate?: string | null
  modifiedBy?: ServerUserRef | null
  modifiedDate?: string | null
  /** When the opportunity's latest activity happened (search-data only). */
  lastActivityDate?: string | null
}

export interface OpportunityActivityRow {
  opportunityActivityDetailNo: number
  activityType?: { activityTypeNo: number; activityTypeName?: string | null; code?: string | null } | null
  subject?: string | null
  dueDate?: string | null
  assignedTo?: ServerUserRef | null
  notesOutcome?: string | null
  closureDate?: string | null
  completionRemark?: string | null
  status?: { statusNo: number; statusName?: string | null } | null
}

export interface OpportunityNoteRow {
  opportunityNotesDetailNo: number
  originatedBy?: string | null
  notesDate?: string | null
  notesDiscussion?: string | null
  createdBy?: ServerUserRef | null
  createdDate?: string | null
}

export interface OpportunityDetail extends OpportunityRow {
  contacts?: (DetailContactRow & { oppContactDetailNo?: number })[] | null
  products?: (DetailProductRow & { oppProductDetailNo?: number })[] | null
  activities?: OpportunityActivityRow[] | null
  notes?: OpportunityNoteRow[] | null
}

/** Body of `POST /api/crm/opportunities/save-activity-detail`. */
export interface OpportunityActivityBody {
  opportunityNo: number
  /** Omit to add; set to update that activity. */
  opportunityActivityDetailNo?: number
  activityTypeNo: number
  subject?: string
  /** ISO date-time. */
  dueDate: string
  assignedToNo: number
  notesOutcome?: string
  /** ISO date-time — with the "Closed" status. */
  closureDate?: string
  /** With the "Completed" status (Mark Complete). */
  completionRemark?: string
  statusNo: number
}

export async function saveOpportunityActivity(body: OpportunityActivityBody): Promise<void> {
  assertSuccess(await http.post<SpectrumResponse<boolean>>(spectrumEndpoints.opportunities.saveActivity, body))
}

/** `DELETE …/delete-activity-detail?opportunityActivityDetailNos=1&opportunityActivityDetailNos=2`. */
export async function deleteOpportunityActivities(detailNos: number[]): Promise<void> {
  if (!detailNos.length) return
  const url = `${spectrumEndpoints.opportunities.deleteActivities}?${repeatedQuery('opportunityActivityDetailNos', detailNos)}`
  assertSuccess(await http.delete<SpectrumResponse<boolean>>(url))
}

/** Body of `POST /api/crm/opportunities/save-notes-detail` (same fields as the lead one). */
export interface OpportunityNoteBody {
  opportunityNo: number
  /** Omit to add; set to update that note. */
  opportunityNotesDetailNo?: number
  originatedBy?: string
  /** ISO date-time. */
  notesDate: string
  notesDiscussion?: string
}

export async function saveOpportunityNote(body: OpportunityNoteBody): Promise<void> {
  assertSuccess(await http.post<SpectrumResponse<boolean>>(spectrumEndpoints.opportunities.saveNote, body))
}

/** `DELETE …/delete-notes-detail?opportunityNotesDetailNos=1&opportunityNotesDetailNos=2`. */
export async function deleteOpportunityNotes(detailNos: number[]): Promise<void> {
  if (!detailNos.length) return
  const url = `${spectrumEndpoints.opportunities.deleteNotes}?${repeatedQuery('opportunityNotesDetailNos', detailNos)}`
  assertSuccess(await http.delete<SpectrumResponse<boolean>>(url))
}

export async function saveOpportunity(body: OpportunitySaveBody): Promise<number> {
  const response = await http.post<SpectrumResponse<{ opportunityNo: number } | null>>(spectrumEndpoints.opportunities.save, body)
  assertSuccess(response)
  return Number(response.data?.opportunityNo ?? body.opportunityNo)
}

export function searchOpportunities(companyNo: number, pageSize = 500): Promise<OpportunityRow[]> {
  return fetchAllPages<OpportunityRow>(spectrumEndpoints.opportunities.search, { CompanyNo: companyNo }, pageSize)
}

export async function loadOpportunity(opportunityNo: number): Promise<OpportunityDetail> {
  const response = await http.get<SpectrumResponse<OpportunityDetail | null>>(
    `${spectrumEndpoints.opportunities.loadData}/${opportunityNo}`,
  )
  assertSuccess(response)
  if (!response.data) fail('NOT_FOUND', 'Opportunity not found.')
  return response.data
}

export async function deleteOpportunity(opportunityNo: number): Promise<void> {
  assertSuccess(
    await http.delete<SpectrumResponse<boolean>>(withQuery(spectrumEndpoints.opportunities.delete, { opportunityNo })),
  )
}

// ─── Form → body ──────────────────────────────────────────────────────────────

/** What the forms know at save time: stage / status by name, everything else by number. */
export interface OpportunityDraft {
  opportunityNo?: number
  companyNo: number
  leadNo?: number
  name: string
  ownerLoginNo?: number
  salesOrganizationNo?: number
  stageName: string
  statusName: string
  businessEntityNo?: number
  currencyNo?: number
  /** `YYYY-MM-DD`. */
  closingDate: string
  value?: number
  contactPersonDetailNos: number[]
  productNos: number[]
  /** docNos of files uploaded through the document store. */
  attachmentNos?: number[]
}

function noByName<T>(items: readonly T[], name: string, getName: (item: T) => string | undefined, getNo: (item: T) => number) {
  const needle = name.trim().toLowerCase()
  const found = items.find((item) => getName(item)?.trim().toLowerCase() === needle)
  return found ? getNo(found) : undefined
}

/** Resolve against the fill values; returns the body or the form fields to fix. */
export function buildOpportunitySaveBody(
  draft: OpportunityDraft,
  fill: OpportunityFormFillValues,
): { body: OpportunitySaveBody; errors?: undefined } | { body?: undefined; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const stageNo = noByName(fill.opportunityStages, draft.stageName, (x) => x.opportunityStageName, (x) => x.opportunityStageNo)
  const statusNo = noByName(fill.opportunityStatuses, draft.statusName, (x) => x.opportunityStatusName, (x) => x.opportunityStatusNo)
  // if (!draft.leadNo) errors.lead = 'Select the reference lead'
  if (!draft.ownerLoginNo) errors.owner = 'Select the opportunity owner from the list'
  if (!draft.salesOrganizationNo) errors.salesOrganization = 'Select a sales organization'
  if (!stageNo) errors.stage = 'Select an opportunity stage'
  if (!statusNo) errors.status = 'Select an opportunity status'
  if (!draft.businessEntityNo) errors.companyName = 'Select the business entity from the list'
  if (!draft.currencyNo) errors.currency = 'Select a currency'
  if (Object.keys(errors).length) return { errors }

  const body: OpportunitySaveBody = {
    companyNo: draft.companyNo,
    leadNo: draft.leadNo,
    opportunityName: draft.name.trim() || undefined,
    opportunityOwnerNo: draft.ownerLoginNo!,
    salesOrganizationNo: draft.salesOrganizationNo!,
    opportunityStageNo: stageNo!,
    businessEntityNo: draft.businessEntityNo!,
    currencyNo: draft.currencyNo!,
    opportunityStatusNo: statusNo!,
    expectedClosureDate: /^\d{4}-\d{2}-\d{2}$/.test(draft.closingDate) ? `${draft.closingDate}T00:00:00.000Z` : undefined,
    opportunityValue: draft.value,
    contacts: draft.contactPersonDetailNos
      .filter((no, i, all) => no > 0 && all.indexOf(no) === i)
      // The first one is the primary contact.
      .map((businessEntityContactPersonDetailNo, i) => ({ businessEntityContactPersonDetailNo, isPrimary: i === 0 })),
    products: draft.productNos.filter((no) => no > 0).map((crmProductNo) => ({ crmProductNo })),
  }
  if (draft.attachmentNos?.length) body.attachments = draft.attachmentNos.filter((no) => no > 0).map((docNo) => ({ docNo }))
  if (draft.opportunityNo) body.opportunityNo = draft.opportunityNo
  return { body }
}
