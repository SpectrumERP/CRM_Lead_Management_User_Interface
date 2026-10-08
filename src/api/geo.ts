/**
 * Geography lookups for location fields (business entity locations, State / City / Port masters).
 *
 *   GET /api/master/states/by-country/{countryNo}
 *   GET /api/master/cities/by-state/{stateNo}
 *   GET /api/master/cities/fill-city-combo?KeywordSearch=&StateNo=
 *
 * Countries come with the business entity fill values (see businessEntities.ts).
 */
import { spectrumEndpoints } from './endpoints'
import { assertSuccess, type SpectrumResponse } from './fillValues'
import { http } from './http'
import { withQuery } from './query'

export interface StateOption {
  stateNo: number
  stateName: string
}

export interface CityOption {
  cityNo: number
  cityName: string
}

/** City search row: each city with its state and country, so picking one can fill both. */
export interface CityComboRow {
  cityNo: number
  cityName: string
  stateNo: number | null
  stateName: string
  countryNo: number | null
  countryName: string
}

type Raw = Record<string, unknown>

export function toNo(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isInteger(n) && n > 0 ? n : null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Some lookups return a bare array, others the usual `{ success, data }` envelope. */
async function getRows(url: string): Promise<Raw[]> {
  const response = await http.get<SpectrumResponse<Raw[] | null> | Raw[]>(url)
  if (Array.isArray(response)) return response
  assertSuccess(response)
  return Array.isArray(response.data) ? response.data : []
}

export async function fetchStatesByCountry(countryNo: number): Promise<StateOption[]> {
  if (!toNo(countryNo)) return []
  const rows = await getRows(spectrumEndpoints.geo.statesByCountry(countryNo))
  return rows
    .map((row) => ({ stateNo: toNo(row.stateNo ?? row.id) ?? 0, stateName: str(row.stateName ?? row.name) }))
    .filter((row) => row.stateNo > 0)
}

export async function fetchCitiesByState(stateNo: number): Promise<CityOption[]> {
  if (!toNo(stateNo)) return []
  const rows = await getRows(spectrumEndpoints.geo.citiesByState(stateNo))
  return rows
    .map((row) => ({ cityNo: toNo(row.cityNo ?? row.id) ?? 0, cityName: str(row.cityName ?? row.name) }))
    .filter((row) => row.cityNo > 0)
}

export function cityComboRow(row: Raw): CityComboRow {
  return {
    cityNo: toNo(row.cityNo) ?? 0,
    cityName: str(row.cityName),
    stateNo: toNo(row.stateNo),
    stateName: str(row.stateName),
    countryNo: toNo(row.countryNo),
    countryName: str(row.countryName),
  }
}

/** Cities matching `keyword`, narrowed to one state when given. Nothing to search → empty. */
export async function searchCities(keyword: string, stateNo?: number | null): Promise<CityComboRow[]> {
  const text = keyword.trim()
  if (!text && !toNo(stateNo)) return []
  const url = withQuery(spectrumEndpoints.geo.cityCombo, {
    KeywordSearch: text || undefined,
    StateNo: toNo(stateNo) ?? undefined,
  })
  return (await getRows(url)).map(cityComboRow).filter((row) => row.cityNo > 0)
}
