import {
  LEAD_CURRENCIES,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STAGES,
  LEAD_STATUSES,
  type Lead,
  type LeadCurrency,
  type LeadPriority,
  type LeadSource,
  type LeadStage,
  type LeadStatus,
} from '../data/leads'
import { ACTIVITY_STATUSES, type Activity, type ActivityStatus } from '../data/activities'
import { MEETING_STATUSES, type Meeting, type MeetingStatus } from '../data/meetings'
import { DEAL_STAGES, OPPORTUNITY_STATUSES, type DealStage, type Opportunity, type OpportunityStatus } from '../data/opportunities'
import { validation } from './errors'
import { isEmail, isPhone, sanitizeEmail, sanitizeText } from './sanitize'

const RECORD_ID = /^[A-Z]{2,6}-[A-Z0-9]{2,24}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DEAL = 1_000_000_000_000

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value)
}

/** Stable CRM record id (e.g. LID-1001, OPP-AB12). */
export function assertRecordId(id: string, label = 'Record'): string {
  const next = sanitizeText(id, 40)
  if (!RECORD_ID.test(next)) validation(`${label} id is invalid.`)
  return next
}

export function assertEmail(value: string, label = 'Email'): string {
  const next = sanitizeEmail(value)
  if (!next || !isEmail(next)) validation(`${label} is invalid.`)
  return next
}

export function assertOptionalEmail(value: string | undefined, label = 'Email'): string | undefined {
  if (value == null || !String(value).trim()) return undefined
  return assertEmail(value, label)
}

export function assertPhone(value: string, label = 'Phone'): string {
  const next = sanitizeText(value, 40)
  if (!isPhone(next)) validation(`${label} is invalid.`)
  return next
}

export function assertOptionalPhone(value: string | undefined, label = 'Phone'): string | undefined {
  if (value == null || !String(value).trim()) return undefined
  return assertPhone(value, label)
}

export function assertMoney(value: number, label = 'Amount'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) validation(`${label} must be a number.`)
  if (value < 0) validation(`${label} cannot be negative.`)
  if (value > MAX_DEAL) validation(`${label} is too large.`)
  return Math.round(value * 100) / 100
}

export function assertIsoDate(value: string, label = 'Date'): string {
  const next = sanitizeText(value, 40)
  if (!ISO_DATE.test(next)) validation(`${label} must be YYYY-MM-DD.`)
  const parsed = new Date(`${next}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== next) {
    validation(`${label} is invalid.`)
  }
  return next
}

export function assertLeadStage(value: string): LeadStage {
  if (!isOneOf(value, LEAD_STAGES)) validation('Lead stage is invalid.')
  return value
}

export function assertLeadStatus(value: string): LeadStatus {
  if (!isOneOf(value, LEAD_STATUSES)) validation('Lead status is invalid.')
  return value
}

export function assertLeadSource(value: string): LeadSource {
  if (!isOneOf(value, LEAD_SOURCES)) validation('Lead source is invalid.')
  return value
}

export function assertLeadPriority(value: string): LeadPriority {
  if (!isOneOf(value, LEAD_PRIORITIES)) validation('Lead priority is invalid.')
  return value
}

export function assertDealStage(value: string): DealStage {
  if (!isOneOf(value, DEAL_STAGES)) validation('Deal stage is invalid.')
  return value
}

export function assertOpportunityStatus(value: string): OpportunityStatus {
  if (!isOneOf(value, OPPORTUNITY_STATUSES)) validation('Opportunity status is invalid.')
  return value
}

export function assertActivityStatus(value: string): ActivityStatus {
  if (!isOneOf(value, ACTIVITY_STATUSES)) validation('Activity status is invalid.')
  return value
}

export function assertCurrency(value: string): LeadCurrency {
  const next = sanitizeText(value, 8).toUpperCase()
  if (!isOneOf(next, LEAD_CURRENCIES as readonly string[])) validation('Currency is invalid.')
  return next as LeadCurrency
}

/** Fields clients may PATCH on a lead. id / createdAt are never writable. */
export const LEAD_PATCH_KEYS = [
  'leadName',
  'companyName',
  'contactPerson',
  'email',
  'phone',
  'leadSource',
  'leadStage',
  'leadStatus',
  'productsRequired',
  'productTypes',
  'opportunityValue',
  'valueCurrency',
  'expectedClosureDate',
  'assignedSalesperson',
  'lastActivity',
  'description',
  'priority',
  'estimatedLeadName',
  'leadDescription',
  'conversationDetails',
  'contacts',
  'taskId',
  'taskName',
  'taskDescription',
] as const satisfies readonly (keyof Lead)[]

export type LeadPatch = Pick<Partial<Lead>, (typeof LEAD_PATCH_KEYS)[number]>

/** Fields clients may PATCH on an opportunity. id / leadId / createdAt / createdBy are never writable. */
export const OPPORTUNITY_PATCH_KEYS = [
  'name',
  'companyName',
  'contactPerson',
  'email',
  'phone',
  'productsRequired',
  'dealValue',
  'valueCurrency',
  'dealStage',
  'status',
  'closingDate',
  'owner',
  'lastActivity',
] as const satisfies readonly (keyof Opportunity)[]

export type OpportunityPatch = Pick<Partial<Opportunity>, (typeof OPPORTUNITY_PATCH_KEYS)[number]>

/** Fields clients may PATCH on an activity. */
export const ACTIVITY_PATCH_KEYS = [
  'subject',
  'type',
  'status',
  'scheduleDate',
  'scheduleTime',
  'contactPerson',
  'assignedTo',
  'notes',
  'outcome',
  'reminder',
  'hasAttachment',
  'attachmentName',
] as const satisfies readonly (keyof Activity)[]

export type ActivityPatch = Pick<Partial<Activity>, (typeof ACTIVITY_PATCH_KEYS)[number]>

/** Fields clients may PATCH on a meeting. */
export const MEETING_PATCH_KEYS = [
  'subject',
  'contactPerson',
  'date',
  'time',
  'endTime',
  'mode',
  'location',
  'participants',
  'notes',
  'status',
  'outcome',
  'hasAttachment',
  'attachmentName',
] as const satisfies readonly (keyof Meeting)[]

export type MeetingPatch = Pick<Partial<Meeting>, (typeof MEETING_PATCH_KEYS)[number]>

export function assertMeetingStatus(value: string): MeetingStatus {
  if (!isOneOf(value, MEETING_STATUSES)) validation('Meeting status is invalid.')
  return value
}

/** Validate + normalize a lead write payload (create or merged patch). */
export function validateLeadWrite(lead: Lead): Lead {
  assertRecordId(lead.id, 'Lead')
  if (!sanitizeText(lead.companyName, 200)) validation('Company name is required.')
  if (!sanitizeText(lead.contactPerson, 200)) validation('Contact person is required.')
  assertEmail(lead.email)
  if (lead.phone?.trim()) assertPhone(lead.phone)
  assertLeadSource(lead.leadSource)
  assertLeadStage(lead.leadStage)
  assertLeadStatus(lead.leadStatus)
  if (lead.priority) assertLeadPriority(lead.priority)
  assertMoney(lead.opportunityValue, 'Opportunity value')
  if (lead.valueCurrency) assertCurrency(lead.valueCurrency)
  if (lead.expectedClosureDate?.trim()) assertIsoDate(lead.expectedClosureDate, 'Expected closure date')
  if (!sanitizeText(lead.assignedSalesperson, 200)) validation('Assigned salesperson is required.')
  return lead
}

/** Validate conversion input before creating an opportunity. */
export function validateConvertInput(input: {
  dealValue: number
  valueCurrency: LeadCurrency
  closingDate: string
}) {
  return {
    dealValue: assertMoney(input.dealValue, 'Deal value'),
    valueCurrency: assertCurrency(input.valueCurrency),
    closingDate: assertIsoDate(input.closingDate, 'Closing date'),
  }
}

/** Validate + normalize an opportunity write payload (merged patch). */
export function validateOpportunityWrite(item: Opportunity) {
  assertRecordId(item.id, 'Opportunity')
  if (item.leadId?.trim()) assertRecordId(item.leadId, 'Reference lead')
  if (!sanitizeText(item.name, 200)) validation('Opportunity name is required.')
  if (!sanitizeText(item.companyName, 200)) validation('Company name is required.')
  if (!sanitizeText(item.contactPerson, 200)) validation('Contact person is required.')
  assertEmail(item.email)
  if (item.phone?.trim()) assertPhone(item.phone)
  assertDealStage(item.dealStage)
  assertOpportunityStatus(item.status)
  assertMoney(item.dealValue, 'Opportunity value')
  assertCurrency(item.valueCurrency)
  assertIsoDate(item.closingDate, 'Expected closure date')
  if (!sanitizeText(item.owner, 200)) validation('Opportunity owner is required.')
  if (!sanitizeText(item.createdBy, 200)) validation('Created by is required.')
  return item
}

export function validateActivityPatch(patch: ActivityPatch): ActivityPatch {
  if (patch.status !== undefined) assertActivityStatus(patch.status)
  if (patch.scheduleDate?.trim()) assertIsoDate(patch.scheduleDate, 'Schedule date')
  return patch
}
