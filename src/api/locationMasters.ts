/**
 * State, City and Port masters (Search / Load Data / Save / Delete under /api/master/*). Unlike the
 * masters in masters.ts these carry parent places (country → state → city), so each has its own shape.
 *
 *   GET    /api/master/{states|cities|ports}/search-data?companyNo=
 *   GET    /api/master/{states|cities|ports}/load-data/{id}?companyNo=
 *   POST   /api/master/{states|cities|ports}/save
 *   DELETE /api/master/states/delete?stateNo=  ·  /api/master/ports/delete?portNo=
 *   DELETE /api/master/cities/{cityNo}?companyNo=
 */
import { spectrumEndpoints } from './endpoints'
import { fail } from './errors'
import { assertCompanyNo, assertSuccess, type SpectrumResponse } from './fillValues'
import { toNo } from './geo'
import { http } from './http'
import { withQuery } from './query'

export type LocationMasterKind = 'state' | 'city' | 'port'

/** One row of any of the three masters; fields a master does not have stay empty. */
export interface LocationMasterRow {
  no: number
  code: string
  name: string
  /** Port alias. */
  alias: string
  countryNo: number | null
  countryName: string
  stateNo: number | null
  stateName: string
  cityNo: number | null
  cityName: string
  /** State: two-digit GST state code. */
  gstStateCode: string
  /** State: union territory flag. */
  isUnionTerritory: boolean
  createdBy: string | null
  createdDate: string | null
}

export interface LocationMasterInput {
  /** Omit or null to insert; > 0 to update. */
  no?: number | null
  name: string
  alias?: string
  countryNo?: number | null
  stateNo?: number | null
  cityNo?: number | null
  gstStateCode?: string
  isUnionTerritory?: boolean
}

export const LOCATION_MASTER_LIMITS = { name: 50, alias: 10, gstStateCode: 2 } as const

interface KindDef {
  path: string
  noKey: string
  nameKey: string
  label: string
}

const KINDS: Record<LocationMasterKind, KindDef> = {
  state: { path: 'states', noKey: 'stateNo', nameKey: 'stateName', label: 'State' },
  city: { path: 'cities', noKey: 'cityNo', nameKey: 'cityName', label: 'City' },
  port: { path: 'ports', noKey: 'portNo', nameKey: 'portName', label: 'Port' },
}

type Raw = Record<string, unknown>

function obj(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function person(value: unknown): string | null {
  if (typeof value === 'string') return value || null
  const user = obj(value)
  return text(user.printingName) || text(user.displayName) || text(user.loginId) || null
}

export function locationMasterRow(kind: LocationMasterKind, raw: Raw): LocationMasterRow {
  const def = KINDS[kind]
  const country = obj(raw.country)
  const state = obj(raw.state)
  const city = obj(raw.city)
  return {
    no: toNo(raw[def.noKey] ?? raw.id) ?? 0,
    code: text(raw.code),
    name: text(raw[def.nameKey] ?? raw.name),
    alias: text(raw.portAlias ?? raw.alias),
    countryNo: toNo(country.countryNo ?? raw.countryNo),
    countryName: text(country.countryName ?? raw.countryName),
    stateNo: toNo(state.stateNo ?? raw.stateNo),
    stateName: text(state.stateName ?? raw.stateName),
    cityNo: toNo(city.cityNo ?? raw.cityNo),
    cityName: text(city.cityName ?? raw.cityName),
    gstStateCode: text(raw.gstStateCode ?? raw.gstCode),
    isUnionTerritory: raw.isUnionTerritory === true,
    createdBy: person(raw.createdBy) || text(raw.createdByName) || null,
    createdDate: text(raw.createdDate) || null,
  }
}

/** Required fields per master, as the save API enforces them. */
export function locationMasterErrors(kind: LocationMasterKind, input: LocationMasterInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const L = LOCATION_MASTER_LIMITS
  const label = KINDS[kind].label
  const name = input.name.trim()
  if (!name) errors.name = `${label} name is required`
  else if (name.length > L.name) errors.name = `Maximum ${L.name} characters`
  if (!toNo(input.countryNo)) errors.countryNo = 'Country is required'
  if (kind !== 'state' && !toNo(input.stateNo)) errors.stateNo = 'State is required'
  if (kind === 'port') {
    const alias = input.alias?.trim() ?? ''
    if (!alias) errors.alias = 'Port alias is required'
    else if (alias.length > L.alias) errors.alias = `Maximum ${L.alias} characters`
    if (!toNo(input.cityNo)) errors.cityNo = 'City is required'
  }
  if (kind === 'state') {
    const gst = input.gstStateCode?.trim() ?? ''
    if (gst && !/^\d{1,2}$/.test(gst)) errors.gstStateCode = 'GST state code is up to two digits'
  }
  return errors
}

function saveBody(kind: LocationMasterKind, input: LocationMasterInput, companyNo: number): Raw {
  const def = KINDS[kind]
  const no = input.no && input.no > 0 ? input.no : null
  const name = input.name.trim()
  switch (kind) {
    case 'state':
      return {
        stateNo: no,
        stateName: name,
        gstStateCode: input.gstStateCode?.trim() ?? '',
        isUnionTerritory: input.isUnionTerritory === true,
        countryNo: toNo(input.countryNo),
        companyNo,
      }
    case 'city':
      return { cityNo: no, cityName: name, stateNo: toNo(input.stateNo), companyNo }
    case 'port':
      return {
        [def.noKey]: no,
        portName: name,
        portAlias: input.alias?.trim() || null,
        countryNo: toNo(input.countryNo),
        stateNo: toNo(input.stateNo),
        cityNo: toNo(input.cityNo),
      }
  }
}

export function createLocationMasterApi(kind: LocationMasterKind) {
  const def = KINDS[kind]
  const base = `${spectrumEndpoints.masters}/${def.path}`

  return {
    kind,
    label: def.label,

    async search(companyNo: number): Promise<LocationMasterRow[]> {
      assertCompanyNo(companyNo)
      const response = await http.get<SpectrumResponse<Raw[] | null>>(withQuery(`${base}/search-data`, { companyNo }))
      assertSuccess(response)
      return (response.data ?? []).map((raw) => locationMasterRow(kind, raw)).filter((row) => row.no > 0)
    },

    async load(no: number, companyNo: number): Promise<LocationMasterRow> {
      if (!toNo(no)) fail('VALIDATION', `${def.label} number must be a positive number.`)
      assertCompanyNo(companyNo)
      const response = await http.get<SpectrumResponse<Raw | null>>(withQuery(`${base}/load-data/${no}`, { companyNo }))
      assertSuccess(response)
      if (!response.data) fail('NOT_FOUND', `This ${def.label.toLowerCase()} no longer exists.`)
      return locationMasterRow(kind, response.data)
    },

    /** Insert when `no` is empty, update when it is > 0. Returns the record number. */
    async save(input: LocationMasterInput, companyNo: number): Promise<number> {
      const first = Object.values(locationMasterErrors(kind, input))[0]
      if (first) fail('VALIDATION', first)
      assertCompanyNo(companyNo)
      const body = saveBody(kind, input, companyNo)
      const response = await http.post<SpectrumResponse<Raw | number | null>>(`${base}/save`, body)
      assertSuccess(response)
      const data = response.data
      return toNo(typeof data === 'number' ? data : obj(data)[def.noKey]) ?? input.no ?? 0
    },

    async remove(no: number, companyNo: number): Promise<void> {
      if (!toNo(no)) fail('VALIDATION', `${def.label} number must be a positive number.`)
      // Cities delete by path; states and ports by query.
      const url = kind === 'city'
        ? withQuery(`${base}/${no}`, { companyNo })
        : withQuery(`${base}/delete`, { [def.noKey]: no })
      assertSuccess(await http.delete<SpectrumResponse<unknown>>(url))
    },
  }
}

export type LocationMasterApi = ReturnType<typeof createLocationMasterApi>

export const locationMasterApis: Record<LocationMasterKind, LocationMasterApi> = {
  state: createLocationMasterApi('state'),
  city: createLocationMasterApi('city'),
  port: createLocationMasterApi('port'),
}
