import { LEADS, LEAD_CURRENCIES, normalizeOrgName, type Lead, type LeadContactEntry, type LeadCurrency } from '../data/leads'
import {
  DEAL_STAGES,
  DEAL_STAGE_WEIGHT,
  OPPORTUNITIES,
  buildOpportunity,
  dealWeight,
  weightedDealValue,
  type Opportunity,
} from '../data/opportunities'
import type { ListResponse, OpportunityListResponse, OpportunityMeta } from './contracts'
import { BUSINESS_ENTITIES, type BusinessEntity } from '../data/businessEntities'
import { CONTACTS, type Contact } from '../data/contacts'
import { ACTIVITIES, type Activity } from '../data/activities'
import { MEETINGS, type Meeting } from '../data/meetings'
import { DOCUMENTS, sanitizePreviewUrl, type CRMDocument } from '../data/documents'
import { AUDIT_ENTRIES, type AuditAction, type AuditEntry, type AuditModule } from '../data/auditLog'
import { isAdmin } from '../auth/users'
import type { CrmEmail, CrmNote } from '../contexts/crmTypes'
import { currentUser, requirePermission, assertCanWriteRecord } from './policy'
import { sanitizeEmail, sanitizeName, sanitizeText } from './sanitize'
import { conflict, notFound } from './errors'
import { pickAllowlisted } from './pick'
import {
  ACTIVITY_PATCH_KEYS,
  LEAD_PATCH_KEYS,
  MEETING_PATCH_KEYS,
  OPPORTUNITY_PATCH_KEYS,
  validateActivityPatch,
  validateConvertInput,
  validateLeadWrite,
  validateOpportunityWrite,
  type ActivityPatch,
  type LeadPatch,
  type OpportunityPatch,
} from './validate'

const STORAGE_KEY = 'fi-crm-db-v1'
const DB_VERSION = 2

export interface CrmDb {
  version: number
  leads: Lead[]
  opportunities: Opportunity[]
  entities: BusinessEntity[]
  contacts: Contact[]
  activities: Activity[]
  meetings: Meeting[]
  notes: CrmNote[]
  emails: CrmEmail[]
  documents: CRMDocument[]
  audit: AuditEntry[]
}

function seed(): CrmDb {
  return {
    version: DB_VERSION,
    leads: [...LEADS],
    opportunities: [...OPPORTUNITIES],
    entities: [...BUSINESS_ENTITIES],
    contacts: [...CONTACTS],
    activities: [...ACTIVITIES],
    meetings: [...MEETINGS],
    notes: [],
    emails: [],
    documents: [...DOCUMENTS],
    audit: [...AUDIT_ENTRIES],
  }
}

function seedLeadFor(lead: Lead): Lead | undefined {
  return (
    LEADS.find((item) => item.id === lead.id)
    ?? LEADS.find((item) => normalizeOrgName(item.companyName) === normalizeOrgName(lead.companyName))
  )
}

function withSeedSecondaryContacts(leads: Lead[]): Lead[] {
  return leads.map((lead) => {
    const seeded = seedLeadFor(lead)
    const seedSecondaries = seeded?.contacts?.filter((item) => !item.primary) ?? []
    if (!seedSecondaries.length) return lead
    const current = lead.contacts?.length
      ? lead.contacts
      : [{
          name: lead.contactPerson,
          email: lead.email,
          phones: lead.phone ? [lead.phone] : [],
          primary: true,
        }]
    const primary = current.filter((item) => item.primary)
    const secondaries = current.filter((item) => !item.primary)
    const seen = new Set(
      secondaries.map((item) => (item.email || item.name).trim().toLowerCase()).filter(Boolean),
    )
    const extras = seedSecondaries.filter((item) => {
      const key = (item.email || item.name).trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (!extras.length && lead.contacts?.length) return lead
    return {
      ...lead,
      contacts: [...(primary.length ? primary : current.filter((item) => item.primary)), ...secondaries, ...extras],
    }
  })
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function load(): CrmDb {
  if (!canUseStorage()) return seed()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seed()
    const parsed = JSON.parse(raw) as CrmDb
    if (parsed.version !== DB_VERSION || !Array.isArray(parsed.leads)) return seed()
    const next = {
      ...seed(),
      ...parsed,
      version: DB_VERSION,
      leads: Array.isArray(parsed.leads) ? withSeedSecondaryContacts(parsed.leads) : seed().leads,
      documents: Array.isArray(parsed.documents)
        ? parsed.documents.map((doc) => ({
            ...doc,
            previewUrl: sanitizePreviewUrl(doc.previewUrl),
          }))
        : seed().documents,
      opportunities: Array.isArray(parsed.opportunities)
        ? parsed.opportunities.map((item) =>
            sanitizeOpportunity({
              ...item,
              status: item.status ?? 'Open',
              createdBy: item.createdBy || item.convertedBy || item.owner || 'System',
            }),
          )
        : seed().opportunities,
      emails: Array.isArray(parsed.emails) ? parsed.emails : [],
    }
    persist(next)
    return next
  } catch {
    return seed()
  }
}

function persist(next: CrmDb) {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

function currentActor() {
  const user = currentUser()
  return { name: user.name, role: user.role }
}

function stamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

let state: CrmDb = load()
const listeners = new Set<() => void>()

function emit() {
  persist(state)
  listeners.forEach((listener) => listener())
}

function setState(next: CrmDb) {
  state = next
  emit()
}

function auditEntry(
  module: AuditModule,
  action: AuditAction,
  recordId: string,
  recordName: string,
  extra: Partial<AuditEntry> = {},
): AuditEntry {
  const actor = currentActor()
  return {
    id: `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    dateTime: stamp(),
    user: actor.name,
    userRole: actor.role,
    module,
    recordId,
    recordName,
    action,
    details: extra.details ?? `${action} ${module.toLowerCase()} ${recordName}.`,
    navigateType: extra.navigateType,
    navigateId: extra.navigateId ?? recordId,
    field: extra.field,
    previousValue: extra.previousValue,
    newValue: extra.newValue,
  }
}

function withAudit(next: CrmDb, entry: AuditEntry): CrmDb {
  return { ...next, audit: [entry, ...next.audit] }
}

const EMPTY_AUDIT: AuditEntry[] = []
let viewCache: { state: CrmDb; userId: string; view: CrmDb } | null = null

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getState(): CrmDb {
  const user = requirePermission('crm.read')
  if (viewCache && viewCache.state === state && viewCache.userId === user.id) {
    return viewCache.view
  }
  const view = isAdmin(user.role) ? state : { ...state, audit: EMPTY_AUDIT }
  viewCache = { state, userId: user.id, view }
  return view
}

function sanitizeOpportunity(item: Opportunity): Opportunity {
  const leadId = item.leadId?.trim() ? sanitizeText(item.leadId, 40) : undefined
  return {
    ...item,
    leadId: leadId || undefined,
    name: sanitizeName(item.name),
    companyName: sanitizeName(item.companyName),
    contactPerson: sanitizeName(item.contactPerson),
    email: sanitizeEmail(item.email),
    phone: sanitizeText(item.phone, 40),
    productsRequired: sanitizeText(item.productsRequired, 500),
    contacts: item.contacts?.map(sanitizeContactEntry),
    owner: sanitizeName(item.owner),
    status: item.status ?? 'Open',
    createdBy: sanitizeName(item.createdBy || item.convertedBy || item.owner || 'System'),
    closingDate: sanitizeText(item.closingDate, 40),
    convertedAt: item.convertedAt ? sanitizeText(item.convertedAt, 40) : undefined,
    convertedBy: item.convertedBy ? sanitizeName(item.convertedBy) : undefined,
  }
}

function sanitizeContactEntry(item: LeadContactEntry): LeadContactEntry {
  return {
    name: sanitizeName(item.name),
    email: sanitizeEmail(item.email),
    phones: item.phones.map((phone) => sanitizeText(phone, 40)).filter(Boolean),
    primary: Boolean(item.primary),
    ...(item.designation ? { designation: sanitizeName(item.designation) } : {}),
    ...(item.businessEntityContactPersonDetailNo ? { businessEntityContactPersonDetailNo: item.businessEntityContactPersonDetailNo } : {}),
  }
}

function sanitizeLead(lead: Lead): Lead {
  return {
    ...lead,
    companyName: sanitizeName(lead.companyName),
    contactPerson: sanitizeName(lead.contactPerson),
    email: sanitizeEmail(lead.email),
    phone: sanitizeText(lead.phone, 40),
    productsRequired: sanitizeText(lead.productsRequired, 500),
    productTypes: lead.productTypes?.map((item) => sanitizeText(item, 80)).filter(Boolean),
    contacts: lead.contacts?.map(sanitizeContactEntry),
    assignedSalesperson: sanitizeName(lead.assignedSalesperson),
    description: lead.description ? sanitizeText(lead.description, 2000) : lead.description,
    estimatedLeadName: lead.estimatedLeadName ? sanitizeName(lead.estimatedLeadName) : lead.estimatedLeadName,
    leadDescription: lead.leadDescription ? sanitizeText(lead.leadDescription, 2000) : lead.leadDescription,
    conversationDetails: lead.conversationDetails ? sanitizeText(lead.conversationDetails, 4000) : lead.conversationDetails,
    taskId: lead.taskId ? sanitizeName(lead.taskId) : lead.taskId,
    taskName: lead.taskName ? sanitizeName(lead.taskName) : lead.taskName,
    taskDescription: lead.taskDescription ? sanitizeText(lead.taskDescription, 2000) : lead.taskDescription,
  }
}

function sanitizeContact(contact: Contact): Contact {
  return {
    ...contact,
    name: sanitizeName(contact.name),
    businessEntityName: sanitizeName(contact.businessEntityName),
    designation: sanitizeName(contact.designation),
    department: sanitizeName(contact.department),
    mobile: sanitizeText(contact.mobile, 40),
    email: sanitizeEmail(contact.email),
    locationLabel: sanitizeName(contact.locationLabel),
    remarks: sanitizeText(contact.remarks, 2000),
  }
}

function sanitizeActivity(activity: Activity): Activity {
  return {
    ...activity,
    subject: sanitizeName(activity.subject),
    leadName: sanitizeName(activity.leadName),
    contactPerson: sanitizeName(activity.contactPerson),
    assignedTo: sanitizeName(activity.assignedTo),
    notes: sanitizeText(activity.notes),
    outcome: sanitizeText(activity.outcome, 1000),
  }
}

function sanitizeMeeting(meeting: Meeting): Meeting {
  return {
    ...meeting,
    subject: sanitizeName(meeting.subject),
    leadName: sanitizeName(meeting.leadName),
    contactPerson: sanitizeName(meeting.contactPerson),
    location: sanitizeText(meeting.location, 500),
    participants: meeting.participants.map((name) => sanitizeName(name)),
    notes: sanitizeText(meeting.notes),
    outcome: sanitizeText(meeting.outcome, 1000),
  }
}

function sanitizeNote(note: CrmNote): CrmNote {
  return {
    ...note,
    title: sanitizeName(note.title),
    text: sanitizeText(note.text),
    relatedLeadName: sanitizeName(note.relatedLeadName),
    by: sanitizeName(note.by),
  }
}

function sanitizeCrmEmail(item: CrmEmail): CrmEmail {
  return {
    ...item,
    to: sanitizeEmail(item.to),
    from: sanitizeEmail(item.from),
    subject: sanitizeName(item.subject),
    body: sanitizeText(item.body),
    leadName: sanitizeName(item.leadName),
    by: sanitizeName(item.by),
    date: sanitizeText(item.date, 40),
    time: sanitizeText(item.time, 40),
    direction: item.direction === 'in' ? 'in' : 'out',
  }
}

function sanitizeDocument(doc: CRMDocument): CRMDocument {
  return {
    ...doc,
    name: sanitizeName(doc.name),
    relatedName: sanitizeName(doc.relatedName),
    uploadedBy: sanitizeName(doc.uploadedBy),
    category: sanitizeName(doc.category),
    previewUrl: sanitizePreviewUrl(doc.previewUrl),
  }
}

function rejectDuplicate(exists: boolean, label: string) {
  if (exists) conflict(`${label} already exists.`)
}

function requireRow<T>(row: T | undefined, label: string): T {
  if (!row) notFound(label)
  return row
}

export function addLead(lead: Lead) {
  assertCanWriteRecord(lead.assignedSalesperson)
  const next = sanitizeLead(validateLeadWrite(lead))
  rejectDuplicate(state.leads.some((item) => item.id === next.id), 'Lead')
  setState(
    withAudit(
      { ...state, leads: [next, ...state.leads] },
      auditEntry('Lead', 'Created', next.id, next.companyName, {
        details: `Lead created for ${next.companyName}.`,
        navigateType: 'lead',
      }),
    ),
  )
}

export function patchLead(id: string, patch: Partial<Lead>) {
  const current = requireRow(state.leads.find((item) => item.id === id), 'Lead')
  assertCanWriteRecord(current.assignedSalesperson)
  const allowed = pickAllowlisted(patch, LEAD_PATCH_KEYS) as LeadPatch
  const next = sanitizeLead(
    validateLeadWrite({
      ...current,
      ...allowed,
      id: current.id,
      createdAt: current.createdAt,
    }),
  )
  setState(
    withAudit(
      { ...state, leads: state.leads.map((item) => (item.id === id ? next : item)) },
      auditEntry('Lead', 'Updated', next.id, next.companyName, {
        details: `Lead ${next.id} updated.`,
        navigateType: 'lead',
      }),
    ),
  )
}

/** State with a lead and everything hanging off it removed. */
function withoutLead(id: string): CrmDb {
  return {
    ...state,
    leads: state.leads.filter((item) => item.id !== id),
    activities: state.activities.filter((item) => item.leadId !== id),
    meetings: state.meetings.filter((item) => item.leadId !== id),
    notes: state.notes.filter((item) => item.relatedLeadId !== id),
    emails: state.emails.filter((item) => item.leadId !== id),
    documents: state.documents.filter((item) => !(item.relatedType === 'lead' && item.relatedId === id)),
    opportunities: state.opportunities.filter((item) => item.leadId !== id),
  }
}

export function removeLead(id: string) {
  const current = requireRow(state.leads.find((item) => item.id === id), 'Lead')
  assertCanWriteRecord(current.assignedSalesperson)
  setState(
    withAudit(
      withoutLead(id),
      auditEntry('Lead', 'Deleted', current.id, current.companyName, {
        details: `Lead ${current.id} deleted.`,
      }),
    ),
  )
}

// ─── Server-backed leads ──────────────────────────────────────────────────────
// Leads with `spectrum` set come from /api/crm/leads. The server is the source of truth, so they are
// stored as received (sanitised, not re-validated against the in-app lists).

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

/**
 * Insert / update server leads. Fields the incoming lead leaves undefined keep their stored value, so a
 * search row (no contacts or products) does not wipe details loaded earlier. `replaceAll` also drops
 * server leads that are no longer returned.
 */
export function upsertServerLeads(leads: Lead[], options: { replaceAll?: boolean } = {}) {
  const incomingIds = new Set(leads.map((lead) => lead.id))
  const byId = new Map(state.leads.map((lead) => [lead.id, lead]))
  const merged = leads.map((lead) => {
    const current = byId.get(lead.id)
    const next = current
      ? { ...current, ...definedOnly(lead), spectrum: { ...current.spectrum, ...definedOnly(lead.spectrum ?? { leadNo: 0 }) } as Lead['spectrum'] }
      : lead
    return sanitizeLead(next)
  })
  const others = state.leads.filter((lead) => {
    if (incomingIds.has(lead.id)) return false
    return !(options.replaceAll && lead.spectrum)
  })
  setState({ ...state, leads: [...merged, ...others] })
}

/** Replace the server-sourced notes / activities of one lead (in-app ones are kept). */
export function replaceServerLeadChildren(
  leadId: string,
  children: { notes: CrmNote[]; activities: Activity[] },
  isServerId: (id: string) => boolean,
) {
  setState({
    ...state,
    notes: [
      ...children.notes.map(sanitizeNote),
      ...state.notes.filter((item) => !(item.relatedLeadId === leadId && isServerId(item.id))),
    ],
    activities: [
      ...children.activities,
      ...state.activities.filter((item) => !(item.leadId === leadId && isServerId(item.id))),
    ],
  })
}

/** Insert / update server opportunities; same merge rules as `upsertServerLeads`. */
export function upsertServerOpportunities(items: Opportunity[], options: { replaceAll?: boolean } = {}) {
  const incomingIds = new Set(items.map((item) => item.id))
  const byId = new Map(state.opportunities.map((item) => [item.id, item]))
  const merged = items.map((item) => {
    const current = byId.get(item.id)
    const next = current
      ? {
          ...current,
          ...definedOnly(item),
          spectrum: { ...current.spectrum, ...definedOnly(item.spectrum ?? { opportunityNo: 0 }) } as Opportunity['spectrum'],
        }
      : item
    return sanitizeOpportunity(next)
  })
  const others = state.opportunities.filter((item) => {
    if (incomingIds.has(item.id)) return false
    return !(options.replaceAll && item.spectrum)
  })
  setState({ ...state, opportunities: [...merged, ...others] })
}

/** Replace the server activities of one opportunity (in-app ones are kept). */
export function replaceServerOpportunityActivities(opportunityId: string, activities: Activity[]) {
  setState({
    ...state,
    activities: [
      ...activities,
      ...state.activities.filter((item) => !(item.opportunityId === opportunityId && item.id.startsWith('SOA-'))),
    ],
  })
}

/** Replace a server opportunity's internal notes (`SON-…`) with the ones from its load-data. */
export function replaceServerOpportunityNotes(opportunityId: string, notes: CrmNote[]) {
  setState({
    ...state,
    notes: [
      ...notes.map(sanitizeNote),
      ...state.notes.filter((item) => !(item.relatedLeadId === opportunityId && item.id.startsWith('SON-'))),
    ],
  })
}

/** Remove an opportunity locally after the server has deleted it. */
export function dropServerOpportunity(id: string) {
  if (!state.opportunities.some((item) => item.id === id)) return
  setState({ ...state, opportunities: state.opportunities.filter((item) => item.id !== id) })
}

/** Remove a lead locally after the server has deleted it. */
export function dropServerLead(id: string) {
  if (!state.leads.some((item) => item.id === id)) return
  setState(withoutLead(id))
}

export function convertLeadToOpportunity(
  leadId: string,
  input: { dealValue: number; valueCurrency: LeadCurrency; closingDate: string },
) {
  const lead = requireRow(state.leads.find((item) => item.id === leadId), 'Lead')
  assertCanWriteRecord(lead.assignedSalesperson)
  if (state.opportunities.some((item) => item.leadId === leadId)) {
    conflict('This lead is already converted to an opportunity.')
  }
  const safeInput = validateConvertInput({
    dealValue: input.dealValue,
    valueCurrency: input.valueCurrency ?? lead.valueCurrency ?? 'INR',
    closingDate: input.closingDate,
  })
  const actor = currentUser()
  const convertedAt = new Date().toISOString()
  const opportunity = sanitizeOpportunity(
    buildOpportunity(lead, {
      id: `OPP-${Date.now().toString(36).toUpperCase()}`,
      dealValue: safeInput.dealValue,
      valueCurrency: safeInput.valueCurrency,
      closingDate: safeInput.closingDate,
      status: 'Open',
      createdBy: actor.name,
      convertedAt,
      convertedBy: actor.name,
    }),
  )
  const nextLead = sanitizeLead(
    validateLeadWrite({
      ...lead,
      leadStage: 'Converted to Opportunity',
      leadStatus: 'Converted',
      opportunityValue: safeInput.dealValue,
      valueCurrency: safeInput.valueCurrency,
      lastActivity: 'Just now',
    }),
  )
  setState(
    withAudit(
      {
        ...state,
        leads: state.leads.map((item) => (item.id === leadId ? nextLead : item)),
        opportunities: [opportunity, ...state.opportunities],
      },
      auditEntry('Opportunity', 'Created', opportunity.id, opportunity.companyName, {
        details: `Lead ${lead.id} converted to opportunity ${opportunity.id}.`,
        navigateType: 'opportunity',
        field: 'Lead Stage',
        previousValue: lead.leadStage,
        newValue: 'Converted to Opportunity',
      }),
    ),
  )
  return opportunity
}

export function addContact(contact: Contact) {
  assertCanWriteRecord()
  const next = sanitizeContact(contact)
  rejectDuplicate(state.contacts.some((item) => item.id === next.id), 'Contact')
  setState(
    withAudit(
      { ...state, contacts: [next, ...state.contacts] },
      auditEntry('Contact', 'Created', next.id, next.name, {
        details: `Contact ${next.name} created.`,
        navigateType: 'contact',
      }),
    ),
  )
}

export function addActivity(activity: Activity) {
  assertCanWriteRecord(activity.assignedTo)
  const next = sanitizeActivity(activity)
  rejectDuplicate(state.activities.some((item) => item.id === next.id), 'Activity')
  setState(
    withAudit(
      { ...state, activities: [next, ...state.activities] },
      auditEntry('Activity', 'Created', next.id, next.subject, {
        details: `Activity "${next.subject}" logged.`,
        navigateType: 'activity',
        navigateId: next.leadId,
      }),
    ),
  )
}

export function addMeeting(meeting: Meeting) {
  assertCanWriteRecord()
  const next = sanitizeMeeting(meeting)
  rejectDuplicate(state.meetings.some((item) => item.id === next.id), 'Meeting')
  setState(
    withAudit(
      { ...state, meetings: [next, ...state.meetings] },
      auditEntry('Meeting', 'Meeting Scheduled', next.id, next.subject, {
        details: `Meeting "${next.subject}" scheduled.`,
        navigateType: 'meeting',
        navigateId: next.leadId,
      }),
    ),
  )
}

export function addNote(note: CrmNote) {
  assertCanWriteRecord(note.by)
  const next = sanitizeNote(note)
  rejectDuplicate(state.notes.some((item) => item.id === next.id), 'Note')
  setState({ ...state, notes: [next, ...state.notes] })
}

export function addEmail(email: CrmEmail) {
  assertCanWriteRecord(email.by)
  const next = sanitizeCrmEmail(email)
  rejectDuplicate(state.emails.some((item) => item.id === next.id), 'Email')
  setState({ ...state, emails: [next, ...state.emails] })
}

export function addDocument(doc: CRMDocument) {
  assertCanWriteRecord(doc.uploadedBy)
  const next = sanitizeDocument(doc)
  rejectDuplicate(state.documents.some((item) => item.id === next.id), 'Document')
  setState(
    withAudit(
      { ...state, documents: [next, ...state.documents] },
      auditEntry('Document', 'Document Uploaded', next.id, next.name, {
        details: `Document "${next.name}" uploaded.`,
        navigateType: next.relatedType === 'entity' ? 'entity' : 'lead',
        navigateId: next.relatedId,
      }),
    ),
  )
}

export function patchActivity(id: string, patch: Partial<Activity>) {
  const current = requireRow(state.activities.find((item) => item.id === id), 'Activity')
  assertCanWriteRecord(current.assignedTo)
  const allowed = validateActivityPatch(pickAllowlisted(patch, ACTIVITY_PATCH_KEYS) as ActivityPatch)
  const next = sanitizeActivity({
    ...current,
    ...allowed,
    id: current.id,
    leadId: current.leadId,
  })
  let db: CrmDb = {
    ...state,
    activities: state.activities.map((item) => (item.id === id ? next : item)),
  }
  if (allowed.status && allowed.status !== current.status) {
    db = withAudit(
      db,
      auditEntry(
        'Activity',
        allowed.status === 'Completed' ? 'Activity Completed' : 'Status Changed',
        next.id,
        next.subject,
        {
          field: 'Status',
          previousValue: current.status,
          newValue: allowed.status,
          details: `Activity "${next.subject}" status set to ${allowed.status}.`,
          navigateType: 'activity',
          navigateId: next.leadId,
        },
      ),
    )
  }
  setState(db)
}

export function patchMeeting(id: string, patch: Partial<Meeting>) {
  const current = requireRow(state.meetings.find((item) => item.id === id), 'Meeting')
  assertCanWriteRecord()
  const allowed = pickAllowlisted(patch, MEETING_PATCH_KEYS)
  const next = sanitizeMeeting({
    ...current,
    ...allowed,
    id: current.id,
    leadId: current.leadId,
  })
  let db: CrmDb = {
    ...state,
    meetings: state.meetings.map((item) => (item.id === id ? next : item)),
  }
  if (allowed.status && allowed.status !== current.status) {
    db = withAudit(
      db,
      auditEntry(
        'Meeting',
        allowed.status === 'Completed' ? 'Meeting Completed' : 'Status Changed',
        next.id,
        next.subject,
        {
          field: 'Status',
          previousValue: current.status,
          newValue: allowed.status,
          details: `Meeting "${next.subject}" status set to ${allowed.status}.`,
          navigateType: 'meeting',
          navigateId: next.leadId,
        },
      ),
    )
  }
  setState(db)
}

function asList<T>(items: T[]): ListResponse<T> {
  return { items, total: items.length }
}

export function listLeads() {
  requirePermission('crm.read')
  return asList(getState().leads)
}

export function getLead(id: string) {
  requirePermission('crm.read')
  return requireRow(getState().leads.find((item) => item.id === id), 'Lead')
}

export function listEntities() {
  requirePermission('crm.read')
  return asList(getState().entities)
}

export function getEntity(id: string) {
  requirePermission('crm.read')
  return requireRow(getState().entities.find((item) => item.id === id), 'Business entity')
}

export function listContacts() {
  requirePermission('crm.read')
  return asList(getState().contacts)
}

export function getContact(id: string) {
  requirePermission('crm.read')
  return requireRow(getState().contacts.find((item) => item.id === id), 'Contact')
}

export function listActivities() {
  requirePermission('crm.read')
  return asList(getState().activities)
}

export function listMeetings() {
  requirePermission('crm.read')
  return asList(getState().meetings)
}

export function listNotes() {
  requirePermission('crm.read')
  return asList(getState().notes)
}

export function listEmails() {
  requirePermission('crm.read')
  return asList(getState().emails)
}

export function listDocuments() {
  requirePermission('crm.read')
  return asList(getState().documents)
}

export function getOpportunityMeta(): OpportunityMeta {
  requirePermission('crm.read')
  return {
    stages: DEAL_STAGES.map((value) => ({ value, weightPercent: DEAL_STAGE_WEIGHT[value] })),
    currencies: LEAD_CURRENCIES,
  }
}

export function addOpportunity(opportunity: Opportunity) {
  assertCanWriteRecord(opportunity.owner)
  const dealStage = opportunity.dealStage
  const dealValue = opportunity.dealValue
  const next = sanitizeOpportunity(
    validateOpportunityWrite({
      ...opportunity,
      id: opportunity.id?.trim() || `OPP-${Date.now().toString(36).toUpperCase()}`,
      leadId: opportunity.leadId?.trim() || undefined,
      status: opportunity.status ?? 'Open',
      createdAt: opportunity.createdAt || new Date().toISOString().slice(0, 10),
      createdBy: opportunity.createdBy || currentUser().name,
      weightPercent: dealWeight(dealStage),
      weightedValue: weightedDealValue(dealValue, dealStage),
      lastActivity: opportunity.lastActivity || 'Just now',
    }),
  )
  rejectDuplicate(state.opportunities.some((item) => item.id === next.id), 'Opportunity')
  setState(
    withAudit(
      { ...state, opportunities: [next, ...state.opportunities] },
      auditEntry('Opportunity', 'Created', next.id, next.companyName, {
        details: next.leadId
          ? `Opportunity ${next.id} created from lead ${next.leadId}.`
          : `Opportunity ${next.id} created directly.`,
        navigateType: 'opportunity',
      }),
    ),
  )
  return next
}

export function getOpportunity(id: string) {
  requirePermission('crm.read')
  return requireRow(getState().opportunities.find((item) => item.id === id), 'Opportunity')
}

export function patchOpportunity(id: string, patch: Partial<Opportunity>) {
  const current = requireRow(state.opportunities.find((item) => item.id === id), 'Opportunity')
  assertCanWriteRecord(current.owner)
  const allowed = pickAllowlisted(patch, OPPORTUNITY_PATCH_KEYS) as OpportunityPatch
  const dealStage = allowed.dealStage ?? current.dealStage
  const dealValue = allowed.dealValue ?? current.dealValue
  const next = sanitizeOpportunity(
    validateOpportunityWrite({
      ...current,
      ...allowed,
      id: current.id,
      leadId: current.leadId,
      companyName: allowed.companyName ?? current.companyName,
      createdAt: current.createdAt,
      createdBy: current.createdBy,
      convertedAt: current.convertedAt,
      convertedBy: current.convertedBy,
      dealStage,
      dealValue,
      status: allowed.status ?? current.status,
      weightPercent: dealWeight(dealStage),
      weightedValue: weightedDealValue(dealValue, dealStage),
      lastActivity: allowed.lastActivity ?? 'Just now',
    }),
  )
  setState(
    withAudit(
      { ...state, opportunities: state.opportunities.map((item) => (item.id === id ? next : item)) },
      auditEntry('Opportunity', 'Updated', next.id, next.name, {
        details: `Opportunity ${next.id} updated.`,
        navigateType: 'opportunity',
      }),
    ),
  )
  return next
}

export function removeOpportunity(id: string) {
  const current = requireRow(state.opportunities.find((item) => item.id === id), 'Opportunity')
  assertCanWriteRecord(current.owner)
  setState(
    withAudit(
      {
        ...state,
        opportunities: state.opportunities.filter((item) => item.id !== id),
      },
      auditEntry('Opportunity', 'Deleted', current.id, current.name, {
        details: `Opportunity ${current.id} deleted.`,
      }),
    ),
  )
}

/** What each sortable grid column of the opportunities list sorts by (the value the cell shows). */
const OPPORTUNITY_SORT_KEYS: Record<string, (item: Opportunity) => string | number> = {
  code: (item) => item.id,
  name: (item) => item.name,
  entity: (item) => item.companyName,
  primaryContact: (item) => item.contactPerson,
  products: (item) => item.productsRequired,
  value: (item) => item.dealValue,
  stage: (item) => item.dealStage,
  weight: (item) => item.weightPercent,
  weighted: (item) => item.weightedValue,
  closing: (item) => item.closingDate,
  owner: (item) => item.owner,
  // Missing values (no activity yet) sort as empty; ISO date-times sort correctly as text.
  lastActivityOn: (item) => item.lastActivityAt ?? '',
  createdBy: (item) => item.audit?.createdBy || item.createdBy || '',
  createdOn: (item) => item.audit?.createdAt || item.createdAt || '',
  modifiedBy: (item) => item.audit?.modifiedBy || '',
  modifiedOn: (item) => item.audit?.modifiedAt || '',
}

export function listOpportunities(query: Record<string, string> = {}): OpportunityListResponse {
  requirePermission('crm.read')
  const q = (query.q ?? '').trim().toLowerCase()
  const stages = (query.stages ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const leadId = query.leadId?.trim() ?? ''
  let items = getState().opportunities
  // `source=server`: Spectrum logins list server opportunities only (demo ones are hidden).
  if (query.source === 'server') items = items.filter((item) => item.spectrum)
  if (leadId) items = items.filter((item) => item.leadId === leadId)
  if (stages.length) items = items.filter((item) => stages.includes(item.dealStage))
  if (q) {
    items = items.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.companyName.toLowerCase().includes(q) ||
        item.contactPerson.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q),
    )
  }
  const perCurrency = new Map<string, { currency: string; dealValue: number; weightedValue: number }>()
  for (const item of items) {
    const currency = item.valueCurrency || 'INR'
    const row = perCurrency.get(currency) ?? { currency, dealValue: 0, weightedValue: 0 }
    row.dealValue += item.dealValue
    row.weightedValue += item.weightedValue
    perCurrency.set(currency, row)
  }
  const totals = {
    dealValue: items.reduce((sum, item) => sum + item.dealValue, 0),
    weightedValue: items.reduce((sum, item) => sum + item.weightedValue, 0),
    byCurrency: [...perCurrency.values()],
  }
  // Sorted before paging, so a column sorts the whole list (as in the leads grid).
  const sortValue = query.sort ? OPPORTUNITY_SORT_KEYS[query.sort] : undefined
  if (sortValue) {
    const sign = query.dir === 'desc' ? -1 : 1
    items = [...items].sort((a, b) => {
      const av = sortValue(a)
      const bv = sortValue(b)
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
      return sign * cmp
    })
  }
  const total = items.length
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || total || 10))
  const paged = items.slice((page - 1) * pageSize, page * pageSize)
  return { items: paged, total, page, pageSize, totals }
}

/** Test-only: replace in-memory state without touching unrelated suites. */
export function __resetDb(next: CrmDb = seed()) {
  state = next
  viewCache = null
  listeners.clear()
}

/** Remove an in-app activity (server ones are deleted through the API and reloaded). */
export function removeActivity(id: string) {
  if (!state.activities.some((item) => item.id === id)) return
  setState({ ...state, activities: state.activities.filter((item) => item.id !== id) })
}

/** Remove an in-app note (server ones are deleted through the API and reloaded). */
export function removeNote(id: string) {
  if (!state.notes.some((item) => item.id === id)) return
  setState({ ...state, notes: state.notes.filter((item) => item.id !== id) })
}

/** Update an in-app note (server ones are saved through the API and reloaded). */
export function patchNote(id: string, patch: Partial<CrmNote>) {
  if (!state.notes.some((item) => item.id === id)) return
  setState({ ...state, notes: state.notes.map((item) => (item.id === id ? sanitizeNote({ ...item, ...patch, id }) : item)) })
}
