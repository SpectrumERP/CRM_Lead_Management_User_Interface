/**
 * Spectrum business entity search — options for the Business Entity field on the lead and
 * opportunity forms.
 *
 *   GET /api/master/business-entities/search/business-entity-wise?KeywordSearch=tata&PageSize=50
 *
 * Paging is cursor-based (`Direction` + `CursorRowNo` + `PageSize`), and page info sits at the top
 * level next to `data`, not inside it. The company comes from the token, so none is sent.
 */
import { spectrumEndpoints } from './endpoints'
import { fail } from './errors'
import { assertSuccess, type SpectrumResponse } from './fillValues'
import { http } from './http'
import { withQuery } from './query'

export interface BusinessEntityRow {
  businessEntityNo: number
  code: string
  businessEntityName: string
  businessEntityTypeName: string | null
  crmTimeZoneNo: number | null
  crmTimeZoneName: string | null
  vatgstNo: string | null
  creditInsuranceLimit: number | null
  locationNo: number | null
  locationTypeNo: number | null
  address: string | null
  countryNo: number | null
  countryName: string | null
  stateNo: number | null
  stateName: string | null
  cityNo: number | null
  cityName: string | null
  pinCode: string | null
  createdBy: number | null
  userName: string | null
  displayName: string | null
  createdDate: string | null
}

/** Paging fields returned alongside `data`. */
export interface PagedFields {
  /** First letters present in the result set (for A–Z filters). */
  alphabets: string[]
  pageSize: number
  totalRecords: number
  totalPages: number
  firstRowNo: number
  lastRowNo: number
}

export type BusinessEntitySearchResponse = Partial<SpectrumResponse<BusinessEntityRow[] | null>> &
  Pick<SpectrumResponse<unknown>, 'success' | 'message'> &
  Partial<PagedFields>

export interface BusinessEntityPage extends PagedFields {
  items: BusinessEntityRow[]
}

export interface BusinessEntitySearch {
  /** Free text across the entity's fields — what the form dropdown sends as the user types. */
  keywordSearch?: string
  /** First-letter filter, one of the returned `alphabets`. */
  startsWith?: string
  code?: string
  businessEntityName?: string
  timeZone?: string
  address?: string
  countryName?: string
  stateName?: string
  cityName?: string
  /** Cursor paging: direction from `cursorRowNo` (e.g. the previous page's `lastRowNo` / `firstRowNo`). */
  direction?: string
  cursorRowNo?: number
  pageSize?: number
}

export const BUSINESS_ENTITY_PAGE_SIZE = 50

/** API query parameter name for each search field. */
const PARAMS: Record<keyof BusinessEntitySearch, string> = {
  keywordSearch: 'KeywordSearch',
  startsWith: 'StartsWith',
  code: 'Code',
  businessEntityName: 'BusinessEntityName',
  timeZone: 'TimeZone',
  address: 'Address',
  countryName: 'CountryName',
  stateName: 'StateName',
  cityName: 'CityName',
  direction: 'Direction',
  cursorRowNo: 'CursorRowNo',
  pageSize: 'PageSize',
}

export async function searchBusinessEntities(input: BusinessEntitySearch = {}): Promise<BusinessEntityPage> {
  const pageSize = input.pageSize ?? BUSINESS_ENTITY_PAGE_SIZE
  const query: Record<string, string | number | undefined> = {}
  for (const key of Object.keys(PARAMS) as (keyof BusinessEntitySearch)[]) {
    const value = key === 'pageSize' ? pageSize : input[key]
    query[PARAMS[key]] = typeof value === 'string' ? value.trim() || undefined : value
  }
  const response = await http.get<BusinessEntitySearchResponse>(withQuery(spectrumEndpoints.businessEntities.search, query))
  assertSuccess(response as SpectrumResponse<unknown>)
  const items = response.data ?? []
  return {
    items,
    alphabets: response.alphabets ?? [],
    pageSize: response.pageSize ?? pageSize,
    totalRecords: response.totalRecords ?? items.length,
    totalPages: response.totalPages ?? 1,
    firstRowNo: response.firstRowNo ?? (items.length ? 1 : 0),
    lastRowNo: response.lastRowNo ?? items.length,
  }
}

/** "Mumbai, Maharashtra" style location line for option rows. */
export function businessEntityLocation(row: Pick<BusinessEntityRow, 'cityName' | 'stateName' | 'countryName'>) {
  return [row.cityName, row.stateName].filter(Boolean).join(', ') || row.countryName || ''
}

// ─── Contact persons ──────────────────────────────────────────────────────────

/**
 * Contact persons of one business entity.
 *
 *   GET /api/master/business-entities/contact-persons?BusinessEntityNo=3&KeywordSearch=roberto
 */
export interface ContactPersonRow {
  businessEntityContactPersonDetailNo: number
  businessEntityNo: number
  contactPersonName: string
  email: string | null
  designation: string | null
  businessEntityName: string | null
  code: string | null
  businessEntityTypeName: string | null
}

export interface ContactPersonSearch {
  businessEntityNo: number
  /** Free text, sent as the user types in the Contact Person dropdown. */
  keywordSearch?: string
  /** Load one specific contact. */
  contactPersonDetailNo?: number
}

export async function searchContactPersons(input: ContactPersonSearch): Promise<ContactPersonRow[]> {
  if (!Number.isInteger(input.businessEntityNo) || input.businessEntityNo < 1) {
    fail('VALIDATION', 'Business entity must be a positive number.')
  }
  const url = withQuery(spectrumEndpoints.businessEntities.contactPersons, {
    KeywordSearch: input.keywordSearch?.trim() || undefined,
    BusinessEntityNo: input.businessEntityNo,
    BusinessEntityContactPersonDetailNo: input.contactPersonDetailNo,
  })
  const response = await http.get<SpectrumResponse<ContactPersonRow[] | null>>(url)
  assertSuccess(response)
  return response.data ?? []
}
