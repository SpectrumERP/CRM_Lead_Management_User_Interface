import type { LeadCurrency } from '../data/leads'
import type { Opportunity } from '../data/opportunities'

/** Shared list envelope. Real API should return this shape. */
export interface ListResponse<T> {
  items: T[]
  total: number
  page?: number
  pageSize?: number
}

export interface OpportunityTotals {
  dealValue: number
  weightedValue: number
}

export interface OpportunityListResponse extends ListResponse<Opportunity> {
  totals: OpportunityTotals
}

export interface OpportunityListQuery {
  q?: string
  stages?: string[]
  leadId?: string
  page?: number
  pageSize?: number
}

export interface OpportunityStageMeta {
  value: string
  weightPercent: number
}

export interface OpportunityMeta {
  stages: OpportunityStageMeta[]
  currencies: LeadCurrency[]
}

export interface ConvertOpportunityBody {
  leadId: string
  dealValue: number
  valueCurrency: LeadCurrency
  closingDate: string
}
