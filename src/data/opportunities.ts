import {
  LEADS,
  displayLeadName,
  formatMoney,
  type Lead,
  type LeadContactEntry,
  type RecordAudit,
  type LeadCurrency,
  type LeadSource,
} from './leads'
import { formatDateTime } from '../utils/dateFormat'

export type DealStage =
  | 'Qualification'
  | 'Proposal'
  | 'Negotiation'
  | 'Commitment'
  | 'Closed Won'
  | 'Closed Lost'

export type OpportunityStatus = 'Open' | 'On Hold' | 'Won' | 'Lost'

export const DEAL_STAGES: DealStage[] = [
  'Qualification',
  'Proposal',
  'Negotiation',
  'Commitment',
  'Closed Won',
  'Closed Lost',
]

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = ['Open', 'On Hold', 'Won', 'Lost']

export const DEAL_STAGE_WEIGHT: Record<DealStage, number> = {
  Qualification: 20,
  Proposal: 40,
  Negotiation: 60,
  Commitment: 80,
  'Closed Won': 100,
  'Closed Lost': 0,
}

/** CSS badge class for an opportunity deal stage. */
export function dealStageClass(stage: DealStage) {
  if (stage === 'Closed Won') return 'status-open'
  if (stage === 'Closed Lost') return 'status-dropped'
  if (stage === 'Negotiation' || stage === 'Commitment') return 'stage-qualified'
  if (stage === 'Proposal') return 'stage-requirement'
  return 'stage-contacted'
}

export function opportunityStatusClass(status: OpportunityStatus) {
  if (status === 'Open') return 'status-open'
  if (status === 'Won') return 'stage-qualified'
  if (status === 'On Hold') return 'stage-requirement'
  return 'status-dropped'
}

/** Stage label with weightage, e.g. `Negotiation (60%)`. */
export function formatOpportunityStage(stage: DealStage, weightPercent?: number) {
  const weight = weightPercent ?? dealWeight(stage)
  return `${stage} (${weight}%)`
}

/** Server numbers for an opportunity that lives in Spectrum (`/api/crm/opportunities`). */
export interface SpectrumOpportunityRef {
  opportunityNo: number
  code?: string
  leadNo?: number
  ownerLoginNo?: number
  businessEntityNo?: number
  contactPersonDetailNos?: number[]
  currencyNo?: number
  salesOrganizationNo?: number
  productNos?: number[]
  /** Document-store files (docNos) picked on the edit form, sent with that save only. */
  attachmentNos?: number[]
  /** True once `load-data` has filled contacts / products. */
  detailLoaded?: boolean
  /** Won order details from the server (pending backend fields; mock mode keeps them in api/pendingApiStore). */
  orderValue?: number
  /** `YYYY-MM-DD`. */
  orderDate?: string
}

export interface Opportunity {
  id: string
  /** Set for opportunities loaded from / saved to the Spectrum server. */
  spectrum?: SpectrumOpportunityRef
  /** Created / modified by and when (server opportunities). */
  audit?: RecordAudit
  /** Reference Lead No — set when converted from a lead; empty/undefined for direct create. */
  leadId?: string
  name: string
  description?: string
  companyName: string
  contactPerson: string
  email: string
  phone: string
  /** Primary + secondary contacts (primary first). `contactPerson` / `email` / `phone` mirror the primary. */
  contacts?: LeadContactEntry[]
  productsRequired: string
  dealValue: number
  valueCurrency: LeadCurrency
  dealStage: DealStage
  status: OpportunityStatus
  weightPercent: number
  weightedValue: number
  closingDate: string
  owner: string
  leadSource: LeadSource | string
  lastActivity: string
  /** Server opportunities: date-time of the latest activity (search-data `lastActivityDate`); null = none. */
  lastActivityAt?: string | null
  createdAt: string
  createdBy: string
  convertedAt?: string
  convertedBy?: string
}

export function dealWeight(stage: DealStage): number {
  return DEAL_STAGE_WEIGHT[stage]
}

export function weightedDealValue(dealValue: number, stage: DealStage): number {
  return Math.round((dealValue * dealWeight(stage)) / 100)
}

export function formatDealValue(value: number, currency: LeadCurrency = 'INR'): string {
  return formatMoney(value, currency)
}

export function buildOpportunity(
  lead: Lead,
  input: {
    id: string
    dealValue: number
    valueCurrency: LeadCurrency
    closingDate: string
    dealStage?: DealStage
    status?: OpportunityStatus
    lastActivity?: string
    createdAt?: string
    createdBy?: string
    convertedAt?: string
    convertedBy?: string
  },
): Opportunity {
  const dealStage = input.dealStage ?? 'Qualification'
  const createdBy = input.createdBy ?? input.convertedBy ?? lead.assignedSalesperson
  return {
    id: input.id,
    leadId: lead.id,
    name: displayLeadName(lead),
    companyName: lead.companyName,
    contactPerson: lead.contactPerson,
    email: lead.email,
    phone: lead.phone,
    productsRequired: lead.productsRequired,
    dealValue: input.dealValue,
    valueCurrency: input.valueCurrency,
    dealStage,
    status: input.status ?? 'Open',
    weightPercent: dealWeight(dealStage),
    weightedValue: weightedDealValue(input.dealValue, dealStage),
    closingDate: input.closingDate,
    owner: lead.assignedSalesperson,
    leadSource: lead.leadSource,
    lastActivity: input.lastActivity ?? 'Just now',
    createdAt: input.createdAt ?? new Date().toISOString().slice(0, 10),
    createdBy,
    convertedAt: input.convertedAt,
    convertedBy: input.convertedBy,
  }
}

/** When a lead was converted — see utils/dateFormat. */
export function formatConversionStamp(iso: string): string {
  return formatDateTime(iso)
}

function seedFrom(id: string, leadId: string, stage: DealStage): Opportunity | null {
  const lead = LEADS.find((item) => item.id === leadId)
  if (!lead) return null
  return buildOpportunity(lead, {
    id,
    dealValue: lead.opportunityValue,
    valueCurrency: lead.valueCurrency ?? 'INR',
    closingDate: lead.expectedClosureDate ?? '',
    dealStage: stage,
    lastActivity: lead.lastActivity,
    createdAt: lead.createdAt,
    createdBy: lead.assignedSalesperson,
  })
}

export const OPPORTUNITIES: Opportunity[] = [
  seedFrom('OPP-1001', 'LID-1007', 'Negotiation'),
  seedFrom('OPP-1002', 'LID-1006', 'Proposal'),
  seedFrom('OPP-1003', 'LID-1012', 'Qualification'),
  seedFrom('OPP-1004', 'LID-1005', 'Commitment'),
].filter((item): item is Opportunity => Boolean(item))
