/**
 * Lead form fill values: every dropdown the lead form needs, loaded in one call.
 *
 *   GET /api/crm/leads/fill-values?companyNo={HeadOfficeNo}
 *
 * Sample response (captured from the server): ./fixtures/lead-form-fill-values.json. Item shapes follow the master APIs
 * (`<master>No`, `code`, `<master>Name`, `sequence`). Business entities, contacts and products are
 * large, searchable lists, so they stay on their own paginated endpoints and are not included here.
 */
import { spectrumEndpoints } from './endpoints'
import { assertCompanyNo, assertSuccess, type CrmProductOption, type CurrencyOption, type SalesOrganizationOption, type SpectrumResponse, type UserOption } from './fillValues'
import { http } from './http'
import { withQuery } from './query'
import { allowServerMasterValues } from './validate'

export type { CurrencyOption, SalesOrganizationOption, SpectrumResponse, UserOption } from './fillValues'
export { bySequence, defaultOption } from './fillValues'

export interface LeadSourceOption {
  leadSourceNo: number
  code: string
  leadSourceName: string
  /** Not sent by the server today; the first item (by sequence) is used instead. */
  isDefault?: boolean
}

export interface LeadStageOption {
  leadStageNo: number
  code: string
  leadStageName: string
  sequence: number
  /** Badge colour, e.g. `#3B82F6`. */
  colorCode?: string
  /** Not sent by the server today; the first item (by sequence) is used instead. */
  isDefault?: boolean
}

export interface LeadStatusOption {
  leadStatusNo: number
  code: string
  leadStatusName: string
  /** Not sent by the server today; the first item (by sequence) is used instead. */
  isDefault?: boolean
  /** A remark is required when a lead moves to this status (sent as leadStatusRemarks). */
  isRemarkRequired?: boolean
}

export interface LeadPriorityOption {
  leadPriorityNo: number
  code: string
  leadPriorityName: string
  sequence: number
  /** Not sent by the server today; the first item (by sequence) is used instead. */
  isDefault?: boolean
}

export interface LeadActivityTypeOption {
  leadActivityTypeNo: number
  code: string
  leadActivityTypeName: string
}

export interface ActivityStatusOption {
  statusNo: number
  statusName: string
  isDefault: boolean
}

export interface LeadFormFillValues {
  leadSources: LeadSourceOption[]
  leadStages: LeadStageOption[]
  leadStatuses: LeadStatusOption[]
  leadPriorities: LeadPriorityOption[]
  leadActivityTypes: LeadActivityTypeOption[]
  activityStatuses: ActivityStatusOption[]
  currencies: CurrencyOption[]
  /** Not sent by the server today — owner / assignee pickers keep the in-app list. */
  users: UserOption[]
  /** Product master for the Product picker. */
  products: CrmProductOption[]
  /** Sales organizations — the lead save requires one (`salesOrganizationNo`). */
  salesOrganizations: SalesOrganizationOption[]
}

const EMPTY: LeadFormFillValues = {
  leadSources: [],
  leadStages: [],
  leadStatuses: [],
  leadPriorities: [],
  leadActivityTypes: [],
  activityStatuses: [],
  currencies: [],
  users: [],
  products: [],
  salesOrganizations: [],
}

function uniqueBy<T>(items: T[], key: (item: T) => unknown): T[] {
  const seen = new Set<unknown>()
  return items.filter((item) => (seen.has(key(item)) ? false : (seen.add(key(item)), true)))
}

export async function fetchLeadFormFillValues(companyNo: number): Promise<LeadFormFillValues> {
  assertCompanyNo(companyNo)
  const url = withQuery(spectrumEndpoints.leads.fillValues, { companyNo })
  const response = await http.get<SpectrumResponse<Partial<LeadFormFillValues> | null>>(url)
  assertSuccess(response)
  // Missing lists become empty so the form never has to null-check.
  const values = { ...EMPTY, ...response.data }
  // The server can repeat a row (seen with activityStatuses); keep the first of each number.
  values.activityStatuses = uniqueBy(values.activityStatuses, (item) => item.statusNo)
  return values
}

/** One request per head office per session — every form and sync job reuses it. */
const cache = new Map<number, Promise<LeadFormFillValues>>()

export function getLeadFillValues(headOfficeNo: number): Promise<LeadFormFillValues> {
  let pending = cache.get(headOfficeNo)
  if (!pending) {
    pending = fetchLeadFormFillValues(headOfficeNo).then((values) => {
      // Let the in-app store accept leads that use these server master names.
      allowServerMasterValues('leadStage', values.leadStages.map((x) => x.leadStageName))
      allowServerMasterValues('leadStatus', values.leadStatuses.map((x) => x.leadStatusName))
      allowServerMasterValues('leadSource', values.leadSources.map((x) => x.leadSourceName))
      allowServerMasterValues('leadPriority', values.leadPriorities.map((x) => x.leadPriorityName))
      return values
    })
    // A failed load should be retried next time, not cached.
    pending.catch(() => cache.delete(headOfficeNo))
    cache.set(headOfficeNo, pending)
  }
  return pending
}

/** Forget the cached lead fill values (after a master changes), so the next form load fetches fresh lists. */
export function clearLeadFillValuesCache() {
  cache.clear()
}
