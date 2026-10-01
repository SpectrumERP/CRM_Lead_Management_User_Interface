/**
 * Opportunity form fill values (from the backend Swagger):
 *
 *   GET /api/crm/opportunities/fill-values?companyNo={HeadOfficeNo}&leadNo=
 *
 * Sample response: ./fixtures/opportunity-form-fill-values.json.
 */
import { spectrumEndpoints } from './endpoints'
import { assertCompanyNo, assertSuccess, type CrmProductOption, type SalesOrganizationOption, type SpectrumResponse } from './fillValues'

export type { SalesOrganizationOption } from './fillValues'
import { http } from './http'
import { withQuery } from './query'

export interface OpportunityStageOption {
  opportunityStageNo: number
  code?: string
  opportunityStageName: string
  sequence: number
  /** Win probability as sent by the server, e.g. "60" (a string). */
  weightage?: string | null
  colorCoding?: string | null
}

export interface OpportunityStatusOption {
  opportunityStatusNo: number
  code?: string
  opportunityStatusName: string
}

export interface OpportunityCurrencyOption {
  currencyNo: number
  currencyCode?: string
  currencyName: string
  symbol?: string
}

export interface OpportunityFormFillValues {
  opportunityStages: OpportunityStageOption[]
  opportunityStatuses: OpportunityStatusOption[]
  currencies: OpportunityCurrencyOption[]
  activityStatuses: { statusNo: number; statusName: string }[]
  /** Product master for the Product picker. */
  products: CrmProductOption[]
  salesOrganizations: SalesOrganizationOption[]
}

const EMPTY: OpportunityFormFillValues = {
  opportunityStages: [],
  opportunityStatuses: [],
  currencies: [],
  activityStatuses: [],
  products: [],
  salesOrganizations: [],
}

export async function fetchOpportunityFormFillValues(companyNo: number, leadNo?: number): Promise<OpportunityFormFillValues> {
  assertCompanyNo(companyNo)
  const url = withQuery(spectrumEndpoints.opportunities.fillValues, { companyNo, leadNo })
  const response = await http.get<SpectrumResponse<Partial<OpportunityFormFillValues> | null>>(url)
  assertSuccess(response)
  // Missing lists become empty so the form never has to null-check.
  return { ...EMPTY, ...response.data }
}

/** Stage weightage as a number (0–100); unparseable → 0. */
export function stageWeight(stage: Pick<OpportunityStageOption, 'weightage'> | undefined): number {
  const value = Number(String(stage?.weightage ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

/** Stage label as the form shows it, e.g. `Negotiation (60%)`. */
export function opportunityStageLabel(stage: OpportunityStageOption) {
  return `${stage.opportunityStageName} (${stageWeight(stage)}%)`
}

/** One request per head office per session. */
const cache = new Map<number, Promise<OpportunityFormFillValues>>()

export function getOpportunityFillValues(headOfficeNo: number): Promise<OpportunityFormFillValues> {
  let pending = cache.get(headOfficeNo)
  if (!pending) {
    pending = fetchOpportunityFormFillValues(headOfficeNo)
    pending.catch(() => cache.delete(headOfficeNo))
    cache.set(headOfficeNo, pending)
  }
  return pending
}

/** Forget the cached opportunity fill values (after a master changes), so the next form load fetches fresh lists. */
export function clearOpportunityFillValuesCache() {
  cache.clear()
}
