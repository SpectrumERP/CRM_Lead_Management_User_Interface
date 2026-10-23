import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import {
  clearBusinessEntityFillValuesCache,
  defaultLocationTypeNo,
  getBusinessEntityFillValues,
  normaliseBusinessEntityFillValues,
} from './businessEntityFillValues'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('business entity fill values', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    clearBusinessEntityFillValuesCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('normalises each list to one shape, accepting the alternate server field names', () => {
    const fill = normaliseBusinessEntityFillValues({
      businessEntityTypes: [{ operCRMBusinessEntityTypeNo: 2, operCRMBusinessEntityTypeName: 'Customer' }],
      countries: [{ countryNo: 1, countryName: 'India' }, { countryNo: 1, countryName: 'India (dup)' }],
      ports: [{ portNo: 9, portName: 'Nhava Sheva' }],
      locationTypes: [
        { locationTypeNo: 1, locationTypeName: 'Head Office' },
        { locationTypeNo: 2, locationTypeName: 'Plant', isDefault: true },
      ],
      timeZones: [
        { crmTimeZoneNo: 5, crmTimeZoneName: 'India Standard Time', countryNo: 1 },
        { timeZoneNo: 6, timeZoneName: 'UTC', countryNo: null },
      ],
      gstinTypes: [{ id: 3, name: 'GSTIN' }, { gstinTypeNo: 0, gstinTypeName: 'bad' }],
      leadSources: [{ leadSourceNo: 7, code: 'LS007', leadSourceName: 'Exhibition' }],
    })
    expect(fill.businessEntityTypes).toEqual([{ typeNo: 2, typeName: 'Customer' }])
    // The first of a repeated number wins.
    expect(fill.countries).toEqual([{ countryNo: 1, countryName: 'India' }])
    expect(fill.ports).toEqual([{ portNo: 9, portName: 'Nhava Sheva' }])
    expect(fill.timeZones).toEqual([
      { timeZoneNo: 5, timeZoneName: 'India Standard Time', countryNo: 1 },
      { timeZoneNo: 6, timeZoneName: 'UTC', countryNo: null },
    ])
    // Rows without a usable number are dropped.
    expect(fill.gstinTypes).toEqual([{ gstinTypeNo: 3, gstinTypeName: 'GSTIN' }])
    expect(fill.leadSources).toEqual([{ leadSourceNo: 7, leadSourceName: 'Exhibition' }])
    expect(defaultLocationTypeNo(fill)).toBe(2)
  })

  it('treats missing lists as empty', () => {
    expect(normaliseBusinessEntityFillValues(null)).toEqual({
      businessEntityTypes: [],
      countries: [],
      ports: [],
      locationTypes: [],
      timeZones: [],
      gstinTypes: [],
      leadSources: [],
    })
    expect(defaultLocationTypeNo({ locationTypes: [] })).toBeNull()
  })

  it('fetches once per head office and retries after a failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { success: false, message: 'down' }))
    await expect(getBusinessEntityFillValues(3)).rejects.toBeTruthy()

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { countries: [{ countryNo: 1, countryName: 'India' }] } }))
    const first = await getBusinessEntityFillValues(3)
    const second = await getBusinessEntityFillValues(3)
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const url = new URL(String(fetchMock.mock.calls.at(-1)![0]))
    expect(url.pathname).toBe('/api/master/business-entities/fill-values')
    expect(url.searchParams.get('companyNo')).toBe('3')
  })
})
