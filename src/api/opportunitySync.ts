/**
 * Keeps server opportunities (/api/crm/opportunities) in the in-app store — same approach as leadSync:
 * the pages keep reading the store, the server stays the source of truth.
 */
import type { LeadCurrency } from '../data/leads'
import { productsFromText, type Product } from '../data/products'
import type { DealStage, Opportunity, OpportunityStatus } from '../data/opportunities'
import { dropServerOpportunity, getState, replaceServerOpportunityActivities, upsertServerOpportunities } from './db'
import { fail } from './errors'
import { guessIsoCurrency } from './fillValues'
import {
  activityStatusFields,
  activityStatusNo,
  activityType,
  contactEntriesFromRows,
  contactNosOf,
  dateOnly,
  leadNoFromId,
  localDateTimeToIso,
  loginNoForName,
  normType,
  personName,
  productsFromRows,
  refreshServerLead,
  serverLeadId,
} from './leadSync'
import { getLeadFillValues } from './leadFormFillValues'
import { convertLeadToOpportunity } from './leads'
import { activityStatusFromServer, type Activity } from '../data/activities'
import {
  buildOpportunitySaveBody,
  deleteOpportunity,
  deleteOpportunityActivities,
  loadOpportunity,
  saveOpportunity,
  saveOpportunityActivity,
  searchOpportunities,
  type OpportunityDetail,
  type OpportunityRow,
} from './opportunities'
import { getOpportunityFillValues, stageWeight, type OpportunityFormFillValues } from './opportunityFormFillValues'
import { resolveSpectrumCompany } from './spectrumCompany'

// ─── Ids ──────────────────────────────────────────────────────────────────────

export function serverOpportunityId(opportunityNo: number) {
  return `SO-${String(opportunityNo).padStart(4, '0')}`
}

export function opportunityNoFromId(id: string): number | null {
  return /^SO-\d+$/.test(id) ? Number(id.slice(3)) : null
}

/** Fill-values product → the app's `Product` shape (id = crmProductNo). */
function fromCrmProduct(item: { crmProductNo: number; productName: string; code: string }): Product {
  return { id: item.crmProductNo, itemName: item.productName, itemCode: item.code }
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

/** Stage weightage from the fill values (the rows only carry the stage name). */
function weightFor(stageName: string, fill?: OpportunityFormFillValues) {
  return stageWeight(fill?.opportunityStages.find((s) => s.opportunityStageName === stageName))
}

/** Search row / detail → Opportunity. Contacts and products keep what `existing` has unless given. */
export function opportunityFromRow(
  row: OpportunityRow | OpportunityDetail,
  existing?: Opportunity,
  fill?: OpportunityFormFillValues,
): Opportunity {
  const detail = 'contacts' in row || 'products' in row ? (row as OpportunityDetail) : undefined
  const stage = row.opportunityStage?.opportunityStageName ?? existing?.dealStage ?? ''
  const value = row.opportunityValue ?? 0
  const weight = weightFor(stage, fill) || existing?.weightPercent || 0
  // Nested `businessEntityContactPerson` / `crmProduct` (current API) or the earlier flat shape.
  const contacts = detail?.contacts ? contactEntriesFromRows(detail.contacts, existing?.contacts) : undefined
  const products = detail?.products ? productsFromRows(detail.products) : undefined
  const currency = row.currency
  const primary = contacts?.[0]?.name
  return {
    id: serverOpportunityId(row.opportunityNo),
    audit: {
      createdBy: personName(row.createdBy),
      createdAt: row.createdDate ?? '',
      modifiedBy: personName(row.modifiedBy) || existing?.audit?.modifiedBy || '',
      modifiedAt: row.modifiedDate ?? '',
    },
    spectrum: {
      ...existing?.spectrum,
      opportunityNo: row.opportunityNo,
      code: row.code ?? undefined,
      leadNo: row.lead?.leadNo || existing?.spectrum?.leadNo,
      ownerLoginNo: row.opportunityOwner?.loginNo ?? existing?.spectrum?.ownerLoginNo,
      businessEntityNo: row.businessEntity?.businessEntityNo ?? existing?.spectrum?.businessEntityNo,
      currencyNo: currency?.currencyNo ?? existing?.spectrum?.currencyNo,
      salesOrganizationNo: row.salesOrganization?.salesOrganizationNo ?? existing?.spectrum?.salesOrganizationNo,
      ...(detail
        ? {
            contactPersonDetailNos: contactNosOf(contacts ?? []),
            productNos: products?.nos ?? [],
            detailLoaded: true,
          }
        : {}),
    },
    leadId: row.lead?.leadNo ? serverLeadId(row.lead.leadNo) : existing?.leadId,
    name: row.opportunityName || row.code || serverOpportunityId(row.opportunityNo),
    companyName: row.businessEntity?.businessEntityName ?? existing?.companyName ?? '',
    // Contact names come with the detail only; email / phone are not sent by the server.
    contactPerson: primary ?? existing?.contactPerson ?? '',
    email: primary && primary !== existing?.contactPerson ? '' : (existing?.email ?? ''),
    phone: primary && primary !== existing?.contactPerson ? '' : (existing?.phone ?? ''),
    contacts: contacts ?? existing?.contacts,
    productsRequired: products ? products.names.join(', ') : (existing?.productsRequired ?? ''),
    dealValue: value,
    valueCurrency: (currency
      ? guessIsoCurrency({ currencyName: currency.currencyName ?? '', symbol: currency.symbol ?? '' })
      : (existing?.valueCurrency ?? 'INR')) as LeadCurrency,
    dealStage: stage as DealStage,
    status: (row.opportunityStatus?.opportunityStatusName ?? existing?.status ?? 'Open') as OpportunityStatus,
    weightPercent: weight,
    weightedValue: Math.round((value * weight) / 100),
    closingDate: dateOnly(row.expectedClosureDate) || existing?.closingDate || '',
    owner: personName(row.opportunityOwner) || existing?.owner || '',
    leadSource: row.lead?.leadSource?.leadSourceName ?? existing?.leadSource ?? '',
    lastActivity: dateOnly(row.modifiedDate ?? row.createdDate) || 'Just now',
    // Search rows carry it (null = none); load-data does not — keep the last known value.
    lastActivityAt: row.lastActivityDate !== undefined ? row.lastActivityDate : existing?.lastActivityAt,
    createdAt: dateOnly(row.createdDate) || existing?.createdAt || new Date().toISOString().slice(0, 10),
    createdBy: personName(row.createdBy) || existing?.createdBy || '',
  }
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

function findOpportunity(id: string) {
  return getState().opportunities.find((item) => item.id === id)
}

async function context() {
  const company = await resolveSpectrumCompany()
  if (!company) fail('UNAUTHENTICATED')
  return { company, fill: await getOpportunityFillValues(company.headOfficeNo) }
}

let inFlightSync: Promise<number> | null = null

export function syncServerOpportunities(): Promise<number> {
  if (inFlightSync) return inFlightSync
  inFlightSync = (async () => {
    const company = await resolveSpectrumCompany()
    if (!company) return 0
    const fill = await getOpportunityFillValues(company.headOfficeNo)
    const rows = await searchOpportunities(company.headOfficeNo)
    upsertServerOpportunities(
      rows.map((row) => opportunityFromRow(row, findOpportunity(serverOpportunityId(row.opportunityNo)), fill)),
      { replaceAll: true },
    )
    return rows.length
  })().finally(() => {
    inFlightSync = null
  })
  return inFlightSync
}

/** The opportunity's own activities (from its load-data) → app activities. */
export function opportunityActivities(detail: OpportunityDetail, item: Opportunity): Activity[] {
  return (detail.activities ?? []).map((a) => {
    const status = activityStatusFromServer(a.status?.statusName)
    return {
      id: `SOA-${a.opportunityActivityDetailNo}`,
      type: activityType(a.activityType?.activityTypeName),
      subject: a.subject ?? '',
      leadId: item.leadId ?? '',
      opportunityId: item.id,
      leadName: item.name,
      contactPerson: item.contactPerson,
      assignedTo: personName(a.assignedTo),
      scheduleDate: dateOnly(a.dueDate),
      scheduleTime: '',
      reminder: 'None',
      notes: a.notesOutcome ?? '',
      status,
      outcome: a.completionRemark ?? '',
      closureDate: dateOnly(a.closureDate) || undefined,
      completeDate: '',
      completeTime: '',
      hasAttachment: false,
    }
  })
}

const inFlightOpportunity = new Map<number, Promise<Opportunity>>()

/**
 * Load one opportunity in full (contacts, products, its own activities). Concurrent calls for the same
 * opportunity share one request (React StrictMode runs effects twice in development).
 */
export function refreshServerOpportunity(opportunityNo: number): Promise<Opportunity> {
  const pending = inFlightOpportunity.get(opportunityNo)
  if (pending) return pending
  const next = (async () => {
    const { fill } = await context()
    const detail = await loadOpportunity(opportunityNo)
    const id = serverOpportunityId(opportunityNo)
    upsertServerOpportunities([opportunityFromRow(detail, findOpportunity(id), fill)])
    const item = findOpportunity(id)!
    replaceServerOpportunityActivities(id, opportunityActivities(detail, item))
    return item
  })().finally(() => inFlightOpportunity.delete(opportunityNo))
  inFlightOpportunity.set(opportunityNo, next)
  return next
}

/**
 * Add (in-app id) or update (`SOA-…` id) an activity on a server opportunity, then reload it.
 * Activity type numbers come from the lead fill values (the opportunity ones carry no types).
 */
export async function saveServerOpportunityActivity(activity: Activity): Promise<void> {
  const opportunityNo = activity.opportunityId ? opportunityNoFromId(activity.opportunityId) : null
  if (!opportunityNo) fail('VALIDATION', 'This activity is not on a server opportunity.')
  const { company, fill } = await context()
  const leadFill = await getLeadFillValues(company.headOfficeNo)
  const typeNo = leadFill.leadActivityTypes.find((t) => normType(t.leadActivityTypeName) === normType(activity.type))?.leadActivityTypeNo
  if (!typeNo) fail('VALIDATION', `Activity type "${activity.type}" is not set up on the server.`)
  const status = activityStatusFields(activity)
  const statusNo = await activityStatusNo(status.kind, fill.activityStatuses.length ? fill.activityStatuses : leadFill.activityStatuses)
  if (!statusNo) fail('VALIDATION', `Activity status "${status.statusName}" is not set up on the server.`)
  const assignedToNo = activity.assignedTo ? await loginNoForName(activity.assignedTo) : undefined
  if (!assignedToNo) fail('VALIDATION', `"${activity.assignedTo}" was not found among server users.`)
  await saveOpportunityActivity({
    opportunityNo,
    opportunityActivityDetailNo: activity.id.startsWith('SOA-') ? Number(activity.id.slice(4)) : undefined,
    activityTypeNo: typeNo,
    subject: activity.subject.trim() || undefined,
    dueDate: localDateTimeToIso(activity.scheduleDate, activity.scheduleTime),
    assignedToNo,
    notesOutcome: status.notesOutcome,
    closureDate: status.closureDate,
    completionRemark: status.completionRemark,
    statusNo,
  })
  await refreshServerOpportunity(opportunityNo)
}

/** Delete a server opportunity activity (`SOA-…` id) through `delete-activity-detail`, then reload it. */
export async function deleteServerOpportunityActivity(activity: Pick<Activity, 'id' | 'opportunityId'>): Promise<void> {
  const opportunityNo = activity.opportunityId ? opportunityNoFromId(activity.opportunityId) : null
  const detailNo = activity.id.startsWith('SOA-') ? Number(activity.id.slice(4)) : undefined
  if (!opportunityNo || !detailNo) fail('VALIDATION', 'This activity is not saved on the server.')
  await deleteOpportunityActivities([detailNo])
  await refreshServerOpportunity(opportunityNo)
}

export async function deleteServerOpportunity(item: Opportunity): Promise<void> {
  if (!item.spectrum) return
  await deleteOpportunity(item.spectrum.opportunityNo)
  dropServerOpportunity(item.id)
}

/** Fields the server cannot take from an in-app patch (contacts are picked per business entity). */
const CONTACT_FIELDS = ['contactPerson', 'email', 'phone'] as const

/** Apply an in-app patch (names, as the editors send them) to a server opportunity, save, reload. */
export async function updateServerOpportunity(current: Opportunity, patch: Partial<Opportunity>): Promise<Opportunity> {
  if (!current.spectrum) fail('VALIDATION', 'This opportunity is not stored on the server.')
  // Contacts can change only by picking server contact persons (the form sends their numbers).
  const pickedContacts = patch.spectrum?.contactPersonDetailNos
  if (!pickedContacts && CONTACT_FIELDS.some((key) => key in patch && patch[key] !== current[key])) {
    fail('VALIDATION', 'Contacts of a server opportunity come from its business entity and cannot be typed in.')
  }
  const { company, fill } = await context()
  const base = current.spectrum.detailLoaded ? current : await refreshServerOpportunity(current.spectrum.opportunityNo)
  const ref = base.spectrum!
  const next = { ...base, ...patch }

  // Forms that picked from the server lists pass the numbers in `patch.spectrum`; inline edits send names.
  const picked = patch.spectrum
  const ownerLoginNo = picked?.ownerLoginNo
    ?? (patch.owner && patch.owner !== base.owner ? await loginNoForName(patch.owner) : ref.ownerLoginNo)
  if (patch.owner && patch.owner !== base.owner && !ownerLoginNo) fail('VALIDATION', `"${patch.owner}" was not found among server users.`)
  const currencyNo = picked?.currencyNo ?? (patch.valueCurrency && patch.valueCurrency !== base.valueCurrency
    ? (fill.currencies.find((c) => guessIsoCurrency({ currencyName: c.currencyName, symbol: c.symbol ?? '' }) === patch.valueCurrency)?.currencyNo ?? ref.currencyNo)
    : ref.currencyNo)
  const productNos = patch.productsRequired !== undefined && patch.productsRequired !== base.productsRequired
    ? productsFromText(patch.productsRequired, fill.products.map(fromCrmProduct)).map((p) => p.id)
    : (ref.productNos ?? [])

  const built = buildOpportunitySaveBody({
    opportunityNo: ref.opportunityNo,
    companyNo: company.headOfficeNo,
    leadNo: ref.leadNo,
    name: next.name,
    ownerLoginNo,
    salesOrganizationNo: ref.salesOrganizationNo,
    stageName: next.dealStage,
    statusName: next.status,
    businessEntityNo: ref.businessEntityNo,
    currencyNo,
    closingDate: next.closingDate,
    value: next.dealValue,
    contactPersonDetailNos: pickedContacts ?? ref.contactPersonDetailNos ?? [],
    productNos,
    attachmentNos: picked?.attachmentNos,
  }, fill)
  if (built.errors) fail('VALIDATION', Object.values(built.errors)[0])
  await saveOpportunity(built.body)
  return refreshServerOpportunity(ref.opportunityNo)
}

/**
 * Convert a server lead through `POST /api/crm/leads/convert-to-opportunity`: the server builds the
 * opportunity from the lead (entity, contacts, products, owner); the dialog adds currency, value and date.
 */
export async function convertServerLead(
  leadId: string,
  input: { dealValue: number; valueCurrency: LeadCurrency; closingDate: string; currencyNo?: number },
): Promise<Opportunity> {
  const leadNo = leadNoFromId(leadId)
  if (!leadNo) fail('VALIDATION', 'This lead is not stored on the server.')
  const { fill } = await context()
  const lead = getState().leads.find((l) => l.id === leadId)
  const currencyNo = input.currencyNo
    ?? fill.currencies.find((c) => guessIsoCurrency({ currencyName: c.currencyName, symbol: c.symbol ?? '' }) === input.valueCurrency)?.currencyNo
    ?? lead?.spectrum?.currencyNo
  if (!currencyNo) fail('VALIDATION', 'Select a currency.')
  const opportunityNo = await convertLeadToOpportunity({
    leadNo,
    currencyNo,
    opportunityValue: input.dealValue,
    expectedClosureDate: /^\d{4}-\d{2}-\d{2}$/.test(input.closingDate) ? `${input.closingDate}T00:00:00.000Z` : undefined,
  })
  // The server moves the lead on (converted) — reload both.
  const [created] = await Promise.all([refreshServerOpportunity(opportunityNo), refreshServerLead(leadNo).catch(() => undefined)])
  return created
}
