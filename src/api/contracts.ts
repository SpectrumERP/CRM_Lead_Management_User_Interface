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
  /** Plain sums (meaningful only when every row is in one currency). */
  dealValue: number
  weightedValue: number
  /** Sums per currency — amounts in different currencies are never added together. */
  byCurrency?: { currency: LeadCurrency; dealValue: number; weightedValue: number }[]
}

export interface OpportunityListResponse extends ListResponse<Opportunity> {
  totals: OpportunityTotals
}

export interface OpportunityListQuery {
  q?: string
  stages?: string[]
  leadId?: string
  /** `server` → only opportunities synced from Spectrum. */
  source?: 'server'
  /** Grid column to sort by (see OPPORTUNITY_SORT_KEYS in db.ts); sorted before paging. */
  sort?: string
  dir?: 'asc' | 'desc'
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
