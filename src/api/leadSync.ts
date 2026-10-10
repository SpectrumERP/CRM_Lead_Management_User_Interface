/**
 * Keeps server leads (/api/crm/leads) in the in-app store, so the list, detail page and inline editors
 * keep working unchanged while the server is the source of truth:
 *
 *   syncServerLeads()      search-data → upsert every lead of the company
 *   refreshServerLead(no)  load-data   → upsert one lead with contacts, products, notes, activities
 *   updateServerLead(…)    save        → then refresh
 *   deleteServerLead(…)    delete      → then drop locally
 */
import type { Activity, ActivityType } from '../data/activities'
import { ACTIVITY_TYPES, activityStatusFromServer, serverActivityStatusKind, type ServerActivityStatusKind } from '../data/activities'
import { isLeadLocked, leadDeleteBlockedReason, leadLockedReason, type Lead, type LeadContactEntry, type LeadPriority, type LeadSource, type LeadStage, type LeadStatus, type LeadStatusLog, type RecordAudit } from '../data/leads'
import type { CrmNote } from '../contexts/crmTypes'
import { dropServerLead, getState, replaceServerLeadChildren, upsertServerLeads } from './db'
import { fail } from './errors'
import { guessIsoCurrency } from './fillValues'
import { getLeadFillValues } from './leadFormFillValues'
import { getOpportunityFillValues } from './opportunityFormFillValues'
import {
  buildLeadSaveBody,
  deleteLead,
  deleteLeadActivities,
  deleteLeadNotes,
  loadLead,
  saveLead,
  saveLeadActivity,
  saveLeadNote,
  searchLeads,
  contactRowName,
  contactRowNo,
  productRowName,
  productRowNo,
  type DetailContactRow,
  type DetailProductRow,
  type LeadDetail,
  type LeadSearchRow,
  type ServerUserRef,
} from './leads'
import { activityAttachmentBody, activityAttachmentFields, forgetActivityAttachments, newActivityId, rememberActivityAttachments } from './activityAttachments'
import { isPendingApiMock } from './pendingApiStore'
import { resolveSpectrumCompany } from './spectrumCompany'
import { searchUsers, userDisplayName } from './users'

// ─── Ids ──────────────────────────────────────────────────────────────────────

/** In-app id for a server lead, e.g. `SL-0042` (fits the store's `ABC-123` id format). */
export function serverLeadId(leadNo: number) {
  return `SL-${String(leadNo).padStart(4, '0')}`
}

export function isServerLeadId(id: string) {
  return /^SL-\d+$/.test(id)
}

/** Server lead number from an in-app id, or null. */
export function leadNoFromId(id: string): number | null {
  return isServerLeadId(id) ? Number(id.slice(3)) : null
}

/** Notes / activities that came from the server (replaced on every refresh). */
export function isServerChildId(id: string) {
  return /^S[NA]-\d+$/.test(id)
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

export function personName(user?: ServerUserRef | null) {
  return user ? userDisplayName({ printingName: user.printingName ?? '', loginId: user.loginId ?? '' }) : ''
}

export function dateOnly(iso?: string | null) {
  if (!iso) return ''
  // A UTC stamp (`2026-09-30T18:30:00Z` = 1 Oct in IST) is the local day; slicing it would move the date a day
  // back on every load and save.
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso.slice(10))) {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
  }
  return iso.slice(0, 10)
}

/** `dd-mm-yyyy HH:MM`, the format in-app notes use. */
export function noteStamp(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function currencyIso(name?: string | null, notation?: string | null) {
  return name || notation ? guessIsoCurrency({ currencyName: name ?? '', symbol: notation ?? '' }) : undefined
}

export const normType = (v: string) => v.toLowerCase().replace(/[\s_-]+/g, '')

/** App type for a server activity type; server-only names (e.g. "Site Visit") are kept as they are. */
export function activityType(name?: string | null): ActivityType {
  if (!name) return 'Other'
  return ACTIVITY_TYPES.find((t) => normType(t) === normType(name)) ?? (name as ActivityType)
}

/**
 * Contact rows (nested `businessEntityContactPerson`, or the earlier flat shape) → contact entries,
 * primary first. Emails the app already knew for the same person are kept (the rows carry none).
 */
export function contactEntriesFromRows(
  rows: readonly DetailContactRow[] | null | undefined,
  known?: readonly LeadContactEntry[],
): LeadContactEntry[] {
  return [...(rows ?? [])]
    .filter((row) => contactRowNo(row) || contactRowName(row))
    .sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)))
    .map((row, i) => {
      const no = contactRowNo(row)
      return {
        name: contactRowName(row),
        email: known?.find((e) => no && e.businessEntityContactPersonDetailNo === no)?.email ?? '',
        phones: [],
        // The first row is primary even if the server flagged none.
        primary: i === 0,
        ...(no ? { businessEntityContactPersonDetailNo: no } : {}),
      }
    })
}

/** Server contact numbers of mapped entries, primary first. */
export function contactNosOf(entries: readonly LeadContactEntry[]): number[] {
  return entries.map((e) => e.businessEntityContactPersonDetailNo).filter((no): no is number => Boolean(no))
}

/** Product rows (nested `crmProduct`, or the earlier flat shape) → names and numbers. */
export function productsFromRows(rows: readonly DetailProductRow[] | null | undefined): { names: string[]; nos: number[] } {
  const list = rows ?? []
  return {
    names: list.map(productRowName).filter(Boolean),
    nos: list.map(productRowNo).filter((no): no is number => Boolean(no)),
  }
}

/** Search row → Lead. Detail-only fields (products) keep what `existing` has. */
/**
 * Created / modified by and when. `modifiedBy` normally arrives as a user object; if a server sends only a
 * login number, the name is known only when it is the creator (or was stored before) — no extra request.
 */
function searchRowAudit(row: LeadSearchRow, existing?: Lead): RecordAudit {
  const createdBy = personName(row.createdBy)
  const modified = row.modifiedBy
  const modifiedBy = !modified
    ? ''
    : typeof modified === 'object'
      ? personName(modified)
      : modified === row.createdBy?.loginNo
        ? createdBy
        : (existing?.audit?.modifiedBy ?? '')
  return {
    createdBy,
    createdAt: row.createdDate ?? '',
    modifiedBy,
    modifiedAt: row.modifiedDate ?? '',
  }
}

export function leadFromSearchRow(row: LeadSearchRow, existing?: Lead): Lead {
  // Search rows now carry the lead's contacts; older servers do not — then keep the stored ones.
  const rowContacts = row.contacts ? contactEntriesFromRows(row.contacts, existing?.contacts) : undefined
  const primary = rowContacts?.[0]
  return {
    id: serverLeadId(row.leadNo),
    audit: searchRowAudit(row, existing),
    spectrum: {
      ...existing?.spectrum,
      leadNo: row.leadNo,
      code: row.code ?? undefined,
      ownerLoginNo: row.leadOwner?.loginNo ?? existing?.spectrum?.ownerLoginNo,
      businessEntityNo: row.businessEntity?.businessEntityNo ?? row.businessEntityNo ?? existing?.spectrum?.businessEntityNo,
      currencyNo: row.currency?.currencyNo ?? row.currencyNo ?? existing?.spectrum?.currencyNo,
      salesOrganizationNo: row.salesOrganization?.salesOrganizationNo || row.salesOrganizationNo || existing?.spectrum?.salesOrganizationNo,
      leadDate: row.leadDate ?? existing?.spectrum?.leadDate,
      stageCompleted: row.leadStage ? Boolean(row.leadStage.isStagedCompleted) : existing?.spectrum?.stageCompleted,
      ...(rowContacts ? { contactPersonDetailNos: contactNosOf(rowContacts) } : {}),
    },
    leadName: row.leadName || row.code || serverLeadId(row.leadNo),
    companyName: row.businessEntity?.businessEntityName ?? row.businessEntityName ?? existing?.companyName ?? '',
    contactPerson: primary ? primary.name : (existing?.contactPerson ?? ''),
    email: primary ? primary.email || (primary.name === existing?.contactPerson ? existing.email : '') : (existing?.email ?? ''),
    phone: primary ? (primary.name === existing?.contactPerson ? existing.phone : '') : (existing?.phone ?? ''),
    leadSource: (row.leadSource?.leadSourceName ?? existing?.leadSource ?? '') as LeadSource,
    leadStage: (row.leadStage?.leadStageName ?? row.leadStageName ?? existing?.leadStage ?? '') as LeadStage,
    leadStatus: (row.leadStatus?.leadStatusName ?? row.leadStatusName ?? existing?.leadStatus ?? '') as LeadStatus,
    priority: (row.leadPriority?.leadPriorityName ?? row.leadPriorityName ?? existing?.priority) as LeadPriority | undefined,
    productsRequired: existing?.productsRequired ?? '',
    productTypes: existing?.productTypes,
    contacts: rowContacts ?? existing?.contacts,
    opportunityValue: row.estimatedAmount ?? 0,
    valueCurrency: currencyIso(row.currency?.currencyName ?? row.currencyName, row.currency?.currencyNotation ?? row.currencyNotation) ?? existing?.valueCurrency,
    assignedSalesperson: personName(row.leadOwner),
    lastActivity: dateOnly(row.modifiedDate ?? row.createdDate) || 'Just now',
    // null (not undefined) when the server has none, so a refresh clears an old value.
    lastActivityAt: row.lastActivityDate !== undefined ? row.lastActivityDate : existing?.lastActivityAt,
    createdAt: dateOnly(row.createdDate) || existing?.createdAt || new Date().toISOString().slice(0, 10),
    description: row.description ?? undefined,
    leadDescription: row.description ?? undefined,
  }
}


/** load-data `statusLogs` → the lead's status log, oldest first. */
export function statusLogsFromDetail(rows: NonNullable<LeadDetail['statusLogs']>): LeadStatusLog[] {
  return rows
    .filter((row) => row.leadStatus?.leadStatusName)
    .map((row) => ({
      no: row.leadStatusLogDetailNo,
      statusNo: row.leadStatus?.leadStatusNo,
      statusName: row.leadStatus!.leadStatusName!.trim(),
      by: personName(row.createdBy),
      byLoginNo: row.createdBy?.loginNo,
      at: row.createdDate ?? '',
    }))
    .sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0))
}

/** Full detail → Lead (+ its server notes and activities). */
export function leadFromDetail(detail: LeadDetail, existing?: Lead): { lead: Lead; notes: CrmNote[]; activities: Activity[] } {
  const id = serverLeadId(detail.leadNo)
  const contacts = contactEntriesFromRows(detail.contacts, existing?.contacts)
  const { names: productNames, nos: productNos } = productsFromRows(detail.products)
  const leadName = detail.leadName || detail.code || id
  const primary = contacts[0]

  const lead: Lead = {
    id,
    audit: {
      createdBy: personName(detail.createdBy),
      createdAt: detail.createdDate ?? '',
      modifiedBy: personName(detail.modifiedBy) || existing?.audit?.modifiedBy || '',
      modifiedAt: detail.modifiedDate ?? '',
    },
    spectrum: {
      leadNo: detail.leadNo,
      code: detail.code ?? undefined,
      ownerLoginNo: detail.leadOwner?.loginNo,
      businessEntityNo: detail.businessEntity?.businessEntityNo,
      contactPersonDetailNos: contactNosOf(contacts),
      currencyNo: detail.currency?.currencyNo,
      productNos,
      salesOrganizationNo: detail.salesOrganization?.salesOrganizationNo || undefined,
      leadDate: detail.leadDate ?? undefined,
      stageCompleted: Boolean(detail.leadStage?.isStagedCompleted),
      detailLoaded: true,
      ...(detail.statusLogs ? { statusLogs: statusLogsFromDetail(detail.statusLogs) } : {}),
    },
    leadName,
    companyName: detail.businessEntity?.businessEntityName ?? existing?.companyName ?? '',
    // The detail has contact names only — keep an email / phone the app already knew.
    contactPerson: primary?.name ?? '',
    email: primary && primary.name === existing?.contactPerson ? existing.email : '',
    phone: primary && primary.name === existing?.contactPerson ? existing.phone : '',
    leadSource: (detail.leadSource?.leadSourceName ?? '') as LeadSource,
    leadStage: (detail.leadStage?.leadStageName ?? '') as LeadStage,
    leadStatus: (detail.leadStatus?.leadStatusName ?? '') as LeadStatus,
    priority: (detail.leadPriority?.leadPriorityName ?? undefined) as LeadPriority | undefined,
    productsRequired: productNames.join(', '),
    productTypes: productNames,
    contacts,
    opportunityValue: detail.estimatedAmount ?? 0,
    valueCurrency: currencyIso(detail.currency?.currencyName, detail.currency?.currencyNotation),
    assignedSalesperson: personName(detail.leadOwner),
    lastActivity: dateOnly(detail.modifiedDate ?? detail.createdDate) || 'Just now',
    createdAt: dateOnly(detail.createdDate) || existing?.createdAt || new Date().toISOString().slice(0, 10),
    description: detail.description ?? undefined,
    leadDescription: detail.description ?? undefined,
  }

  const notes: CrmNote[] = (detail.notes ?? []).map((n) => ({
    id: `SN-${n.leadNotesDetailNo}`,
    title: 'Internal note',
    text: n.notesDiscussion ?? '',
    relatedLeadId: id,
    relatedLeadName: leadName,
    date: noteStamp(n.notesDate ?? n.createdDate),
    by: n.originatedBy || personName(n.createdBy),
  }))

  const activities: Activity[] = (detail.activities ?? []).map((a) => {
    const status = activityStatusFromServer(a.status?.statusName)
    return {
      id: `SA-${a.leadActivityDetailNo}`,
      type: activityType(a.activityType?.activityTypeName),
      subject: a.subject ?? '',
      leadId: id,
      leadName,
      contactPerson: primary?.name ?? '',
      assignedTo: personName(a.assignTo),
      scheduleDate: dateOnly(a.dueDate),
      scheduleTime: '',
      reminder: 'None',
      notes: a.notesOutcome ?? '',
      status,
      outcome: a.completionRemark ?? '',
      closureDate: dateOnly(a.closureDate) || undefined,
      completeDate: '',
      completeTime: '',
      ...activityAttachmentFields(`SA-${a.leadActivityDetailNo}`, a.attachments),
    }
  })

  return { lead, notes, activities }
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

function findLead(id: string) {
  return getState().leads.find((lead) => lead.id === id)
}

/** Converted / completed-stage leads take no more changes (lead, activities or notes). */
function assertLeadUnlocked(leadId: string) {
  const lead = findLead(leadId)
  if (lead && isLeadLocked(lead)) fail('VALIDATION', leadLockedReason(lead) + '.')
}

let inFlightSync: Promise<number> | null = null

/** Load every lead of the current company into the store. Resolves to the number of leads. */
export function syncServerLeads(): Promise<number> {
  if (inFlightSync) return inFlightSync
  inFlightSync = (async () => {
    const company = await resolveSpectrumCompany()
    if (!company) return 0
    // No fill values needed: server leads are stored as sent (not validated against the lists).
    const rows = await searchLeads(company.headOfficeNo)
    upsertServerLeads(rows.map((row) => leadFromSearchRow(row, findLead(serverLeadId(row.leadNo)))), { replaceAll: true })
    return rows.length
  })().finally(() => {
    inFlightSync = null
  })
  return inFlightSync
}

const inFlightLead = new Map<number, Promise<Lead>>()

/**
 * Load one lead in full (contacts, products, notes, activities). Concurrent calls for the same lead
 * share one request (React StrictMode runs effects twice in development).
 */
export function refreshServerLead(leadNo: number): Promise<Lead> {
  const pending = inFlightLead.get(leadNo)
  if (pending) return pending
  const next = (async () => {
    const detail = await loadLead(leadNo)
    const { lead, notes, activities } = leadFromDetail(detail, findLead(serverLeadId(leadNo)))
    upsertServerLeads([lead])
    replaceServerLeadChildren(lead.id, { notes, activities }, isServerChildId)
    return findLead(lead.id) ?? lead
  })().finally(() => inFlightLead.delete(leadNo))
  inFlightLead.set(leadNo, next)
  return next
}

export async function deleteServerLead(lead: Lead): Promise<void> {
  if (!lead.spectrum) return
  // Converted / completed-stage leads stay (their opportunity refers to them).
  const blocked = leadDeleteBlockedReason(lead)
  if (blocked) fail('VALIDATION', `${blocked}.`)
  await deleteLead(lead.spectrum.leadNo)
  dropServerLead(lead.id)
}

export async function loginNoForName(name: string): Promise<number | undefined> {
  const users = await searchUsers(name)
  return users.find((u) => userDisplayName(u).toLowerCase() === name.trim().toLowerCase())?.loginNo
}

/**
 * Apply an in-app patch (names, as the inline editors send them) to a server lead: resolve the names to
 * server numbers, save, then reload it. Contact changes are not sent — contacts are picked per entity.
 */
export async function updateServerLead(current: Lead, patch: Partial<Lead>): Promise<Lead> {
  if (!current.spectrum) fail('VALIDATION', 'This lead is not stored on the server.')
  const company = await resolveSpectrumCompany()
  if (!company) fail('UNAUTHENTICATED')
  const fill = await getLeadFillValues(company.headOfficeNo)
  const base = current.spectrum.detailLoaded ? current : await refreshServerLead(current.spectrum.leadNo)
  if (isLeadLocked(base)) fail('VALIDATION', leadLockedReason(base) + '.')
  const ref = base.spectrum!
  const next = { ...base, ...patch }

  const ownerLoginNo = patch.assignedSalesperson && patch.assignedSalesperson !== base.assignedSalesperson
    ? await loginNoForName(patch.assignedSalesperson)
    : ref.ownerLoginNo
  const productNos = patch.productTypes
    ? patch.productTypes
        .map((name) => fill.products.find((p) => p.productName === name)?.crmProductNo)
        .filter((no): no is number => no !== undefined)
    : (ref.productNos ?? [])
  // A currency picked from the server list comes as its number; otherwise map a changed ISO code.
  const currencyNo = patch.spectrum?.currencyNo ?? (patch.valueCurrency && patch.valueCurrency !== base.valueCurrency
    ? (fill.currencies.find((c) => guessIsoCurrency(c) === patch.valueCurrency)?.currencyNo ?? ref.currencyNo)
    : ref.currencyNo)
  const [primaryContact, ...otherContacts] = ref.contactPersonDetailNos ?? []

  const built = buildLeadSaveBody({
    leadNo: ref.leadNo,
    companyNo: company.headOfficeNo,
    leadName: next.leadName,
    description: next.description ?? next.leadDescription ?? '',
    leadDate: ref.leadDate ? new Date(ref.leadDate) : new Date(`${base.createdAt}T00:00:00Z`),
    ownerLoginNo,
    sourceName: next.leadSource,
    stageName: next.leadStage,
    statusName: next.leadStatus,
    priorityName: next.priority ?? '',
    // The lead's own; a lead saved without one takes the first from the fill values (the server needs it).
    salesOrganizationNo: patch.spectrum?.salesOrganizationNo ?? ref.salesOrganizationNo ?? fill.salesOrganizations[0]?.salesOrganizationNo,
    currencyNo,
    estimatedAmount: next.opportunityValue,
    businessEntityNo: ref.businessEntityNo,
    contactPersonDetailNo: primaryContact,
    otherContactPersonDetailNos: otherContacts,
    requireEntityAndContact: false,
    productNos,
    notes: [],
  }, fill)
  if (built.errors) fail('VALIDATION', Object.values(built.errors)[0])
  await saveLead(built.body)
  return refreshServerLead(ref.leadNo)
}

// ─── Activities / notes on a server lead ─────────────────────────────────────

/** Server detail number of a synced activity (`SA-8`) / note (`SN-5`), else undefined. */
function childNo(id: string, prefix: 'SA' | 'SN') {
  return id.startsWith(`${prefix}-`) ? Number(id.slice(3)) : undefined
}

/** `YYYY-MM-DD` + optional `HH:MM` (local) → ISO. */
export function localDateTimeToIso(date: string, time = '') {
  const d = new Date(`${date}T${/^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '00:00'}:00`)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/** In-app note stamps: `dd-mm-yyyy HH:MM`, `YYYY-MM-DDTHH:MM` or anything Date can read. */
export function noteDateToIso(value: string) {
  const m = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}:\d{2}))?/.exec(value.trim())
  if (m) return localDateTimeToIso(`${m[3]}-${m[2]}-${m[1]}`, m[4] ?? '')
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

async function leadFill() {
  const company = await resolveSpectrumCompany()
  if (!company) fail('UNAUTHENTICATED')
  return getLeadFillValues(company.headOfficeNo)
}

const STATUS_NAMES: Record<ServerActivityStatusKind, RegExp> = {
  open: /^(open|pending|in progress)$/i,
  closed: /^(closed|cancel+ed)$/i,
  completed: /^(completed?|done)$/i,
}

/**
 * Server status number for an open / closed / completed activity, matched by name in the fill values
 * ("Open", "Closed", "Completed"). A server without "Completed" gets "Closed" for it. When the lead
 * fill values lack a status, the opportunity ones are tried.
 */
export async function activityStatusNo(
  kind: ServerActivityStatusKind,
  primary: readonly { statusNo: number; statusName: string }[],
): Promise<number | undefined> {
  const pick = (list: readonly { statusNo: number; statusName: string }[], k: ServerActivityStatusKind) =>
    list.find((s) => STATUS_NAMES[k].test(s.statusName.trim()))?.statusNo
  const inList = (list: readonly { statusNo: number; statusName: string }[]) =>
    pick(list, kind) ?? (kind === 'completed' ? pick(list, 'closed') : undefined)
  const found = inList(primary)
  if (found) return found
  const company = await resolveSpectrumCompany()
  if (!company) return undefined
  const oppFill = await getOpportunityFillValues(company.headOfficeNo).catch(() => null)
  return oppFill ? inList(oppFill.activityStatuses) : undefined
}

/**
 * Status-dependent fields of an activity save: "Closed" carries `closureDate` (today when none was
 * picked), "Completed" carries `completionRemark`. `notesOutcome` is the activity's own notes.
 */
export function activityStatusFields(activity: Pick<Activity, 'status' | 'notes' | 'outcome' | 'closureDate'>) {
  const kind = serverActivityStatusKind(activity.status)
  return {
    kind,
    statusName: kind === 'completed' ? 'Completed' : kind === 'closed' ? 'Closed' : 'Open',
    notesOutcome: activity.notes.trim() || undefined,
    closureDate: kind === 'closed' ? localDateTimeToIso(activity.closureDate || new Date().toISOString().slice(0, 10)) : undefined,
    completionRemark: kind === 'completed' ? activity.outcome.trim() || undefined : undefined,
  }
}

/**
 * Add (in-app id) or update (`SA-…` id) an activity on a server lead, then reload the lead so the
 * saved version replaces the local one.
 */
export async function saveServerLeadActivity(activity: Activity): Promise<void> {
  const leadNo = leadNoFromId(activity.leadId)
  if (!leadNo) fail('VALIDATION', 'This activity is not on a server lead.')
  assertLeadUnlocked(activity.leadId)
  // An update needs the server's activity number; a bad one would reach the server as null.
  const detailNo = childNo(activity.id, 'SA')
  if (detailNo !== undefined && !(detailNo > 0)) fail('VALIDATION', 'This activity has no server activity number; reload the lead and try again.')
  const fill = await leadFill()
  const typeNo = fill.leadActivityTypes.find((t) => normType(t.leadActivityTypeName) === normType(activity.type))?.leadActivityTypeNo
  if (!typeNo) fail('VALIDATION', `Activity type "${activity.type}" is not set up on the server.`)
  const status = activityStatusFields(activity)
  const statusNo = await activityStatusNo(status.kind, fill.activityStatuses)
  if (!statusNo) fail('VALIDATION', `Activity status "${status.statusName}" is not set up on the server.`)
  const assignToLoginNo = activity.assignedTo ? await loginNoForName(activity.assignedTo) : undefined
  if (activity.assignedTo && !assignToLoginNo) fail('VALIDATION', `"${activity.assignedTo}" was not found among server users.`)
  const leadActivityIds = () => getState().activities.filter((a) => a.leadId === activity.leadId && !a.opportunityId).map((a) => a.id)
  const before = detailNo === undefined ? leadActivityIds() : []
  await saveLeadActivity({
    leadNo,
    leadActivityDetailNo: detailNo,
    activityTypeNo: typeNo,
    subject: activity.subject.trim() || undefined,
    dueDate: localDateTimeToIso(activity.scheduleDate, activity.scheduleTime),
    assignToLoginNo,
    notesOutcome: status.notesOutcome,
    closureDate: status.closureDate,
    completionRemark: status.completionRemark,
    statusNo,
    ...activityAttachmentBody(activity),
  })
  // Mock: files are linked once the save succeeded — an update by its id, a new activity by the id it got.
  if (detailNo !== undefined) rememberActivityAttachments(activity.id, activity.attachments)
  await refreshServerLead(leadNo)
  if (detailNo === undefined && activity.attachments?.length && isPendingApiMock()) {
    const id = newActivityId(before, getState().activities.filter((a) => a.leadId === activity.leadId && !a.opportunityId))
    if (id) {
      rememberActivityAttachments(id, activity.attachments)
      await refreshServerLead(leadNo)
    }
  }
}

/** Add (in-app id) or update (`SN-…` id) a note on a server lead, then reload the lead. */
export async function saveServerLeadNote(note: CrmNote): Promise<void> {
  const leadNo = leadNoFromId(note.relatedLeadId)
  if (!leadNo) fail('VALIDATION', 'This note is not on a server lead.')
  await saveLeadNote({
    leadNo,
    leadNotesDetailNo: childNo(note.id, 'SN'),
    originatedBy: note.by.trim() || undefined,
    notesDate: noteDateToIso(note.date),
    notesDiscussion: note.text.trim() || undefined,
  })
  await refreshServerLead(leadNo)
}

/** Delete a server activity (`SA-…` id) through `delete-activity-detail`, then reload the lead. */
export async function deleteServerLeadActivity(activity: Pick<Activity, 'id' | 'leadId'>): Promise<void> {
  const leadNo = leadNoFromId(activity.leadId)
  const detailNo = childNo(activity.id, 'SA')
  if (!leadNo || !detailNo) fail('VALIDATION', 'This activity is not saved on the server.')
  assertLeadUnlocked(activity.leadId)
  await deleteLeadActivities([detailNo])
  forgetActivityAttachments([activity.id])
  await refreshServerLead(leadNo)
}

/** Delete a server note (`SN-…` id) through `delete-notes-detail`, then reload the lead. */
export async function deleteServerLeadNote(note: Pick<CrmNote, 'id' | 'relatedLeadId'>): Promise<void> {
  const leadNo = leadNoFromId(note.relatedLeadId)
  const detailNo = childNo(note.id, 'SN')
  if (!leadNo || !detailNo) fail('VALIDATION', 'This note is not saved on the server.')
  await deleteLeadNotes([detailNo])
  await refreshServerLead(leadNo)
}
