/**
 * Business entity form fill values: every dropdown the entity list and form need, in one call.
 *
 *   GET /api/master/business-entities/fill-values?companyNo={HeadOfficeNo}
 *
 * The server names fields per master (`operCRMBusinessEntityTypeNo`, `crmTimeZoneNo` or `timeZoneNo`, …);
 * each list is normalised here so the screens see one shape.
 */
import { spectrumEndpoints } from './endpoints'
import { assertCompanyNo, assertSuccess, type SpectrumResponse } from './fillValues'
import { toNo } from './geo'
import { http } from './http'
import { withQuery } from './query'
import type { LocationTimeZone } from '../utils/timeZones/locationTimeZone'

export interface BusinessEntityTypeOption {
  typeNo: number
  typeName: string
}

export interface CountryOption {
  countryNo: number
  countryName: string
}

export interface PortOption {
  portNo: number
  portName: string
}

export interface LocationTypeOption {
  locationTypeNo: number
  locationTypeName: string
  isDefault: boolean
}

/** Lead source, offered as the entity's "Contact Source". */
export interface LeadSourceOption {
  leadSourceNo: number
  leadSourceName: string
}

/** Tax document type — VAT, GST, IGV, … ("Tax Document Type" on the form). */
export interface GstinTypeOption {
  gstinTypeNo: number
  gstinTypeName: string
}

export type TimeZoneOption = LocationTimeZone

export interface BusinessEntityFillValues {
  businessEntityTypes: BusinessEntityTypeOption[]
  countries: CountryOption[]
  ports: PortOption[]
  locationTypes: LocationTypeOption[]
  timeZones: TimeZoneOption[]
  gstinTypes: GstinTypeOption[]
  leadSources: LeadSourceOption[]
}

export const EMPTY_BUSINESS_ENTITY_FILL_VALUES: BusinessEntityFillValues = {
  businessEntityTypes: [],
  countries: [],
  ports: [],
  locationTypes: [],
  timeZones: [],
  gstinTypes: [],
  leadSources: [],
}

type Raw = Record<string, unknown>

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function rows(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter((row): row is Raw => Boolean(row) && typeof row === 'object') : []
}

/** Rows with a number, first of each number kept. */
function list<T>(value: unknown, map: (row: Raw) => T | null, key: (item: T) => number): T[] {
  const seen = new Set<number>()
  const out: T[] = []
  for (const row of rows(value)) {
    const item = map(row)
    if (!item || seen.has(key(item))) continue
    seen.add(key(item))
    out.push(item)
  }
  return out
}

export function normaliseBusinessEntityFillValues(data: Raw | null | undefined): BusinessEntityFillValues {
  const raw = data ?? {}
  return {
    businessEntityTypes: list(
      raw.businessEntityTypes,
      (row) => {
        const typeNo = toNo(row.operCRMBusinessEntityTypeNo ?? row.businessEntityTypeNo ?? row.id)
        return typeNo ? { typeNo, typeName: str(row.operCRMBusinessEntityTypeName ?? row.businessEntityTypeName ?? row.name) } : null
      },
      (x) => x.typeNo,
    ),
    countries: list(
      raw.countries,
      (row) => {
        const countryNo = toNo(row.countryNo ?? row.id)
        return countryNo ? { countryNo, countryName: str(row.countryName ?? row.name) } : null
      },
      (x) => x.countryNo,
    ),
    ports: list(
      raw.ports,
      (row) => {
        const portNo = toNo(row.portNo ?? row.portId ?? row.id)
        return portNo ? { portNo, portName: str(row.portName ?? row.name) } : null
      },
      (x) => x.portNo,
    ),
    locationTypes: list(
      raw.locationTypes,
      (row) => {
        const locationTypeNo = toNo(row.locationTypeNo ?? row.addressTypeNo ?? row.id)
        return locationTypeNo
          ? { locationTypeNo, locationTypeName: str(row.locationTypeName ?? row.addressTypeName ?? row.name), isDefault: row.isDefault === true }
          : null
      },
      (x) => x.locationTypeNo,
    ),
    timeZones: list(
      raw.timeZones,
      (row) => {
        const timeZoneNo = toNo(row.crmTimeZoneNo ?? row.timeZoneNo ?? row.id)
        return timeZoneNo
          ? { timeZoneNo, timeZoneName: str(row.crmTimeZoneName ?? row.timeZoneName ?? row.name), countryNo: toNo(row.countryNo) }
          : null
      },
      (x) => x.timeZoneNo,
    ),
    gstinTypes: list(
      raw.gstinTypes,
      (row) => {
        const gstinTypeNo = toNo(row.gstinTypeNo ?? row.id)
        return gstinTypeNo ? { gstinTypeNo, gstinTypeName: str(row.gstinTypeName ?? row.name) } : null
      },
      (x) => x.gstinTypeNo,
    ),
    leadSources: list(
      raw.leadSources,
      (row) => {
        const leadSourceNo = toNo(row.leadSourceNo ?? row.id)
        return leadSourceNo ? { leadSourceNo, leadSourceName: str(row.leadSourceName ?? row.name) } : null
      },
      (x) => x.leadSourceNo,
    ),
  }
}

export async function fetchBusinessEntityFillValues(companyNo: number): Promise<BusinessEntityFillValues> {
  assertCompanyNo(companyNo)
  const url = withQuery(spectrumEndpoints.businessEntities.fillValues, { companyNo })
  const response = await http.get<SpectrumResponse<Raw | null>>(url)
  assertSuccess(response)
  return normaliseBusinessEntityFillValues(response.data)
}

/** One request per head office per session — the list, the form and the masters reuse it. */
const cache = new Map<number, Promise<BusinessEntityFillValues>>()

export function getBusinessEntityFillValues(headOfficeNo: number): Promise<BusinessEntityFillValues> {
  let pending = cache.get(headOfficeNo)
  if (!pending) {
    pending = fetchBusinessEntityFillValues(headOfficeNo)
    // A failed load should be retried next time, not cached.
    pending.catch(() => cache.delete(headOfficeNo))
    cache.set(headOfficeNo, pending)
  }
  return pending
}

/** Forget the cached lists (after a type / country / port master changes). */
export function clearBusinessEntityFillValuesCache() {
  cache.clear()
}

/** The location type marked default, else the first one. */
export function defaultLocationTypeNo(fill: Pick<BusinessEntityFillValues, 'locationTypes'>): number | null {
  return (fill.locationTypes.find((t) => t.isDefault) ?? fill.locationTypes[0])?.locationTypeNo ?? null
}
