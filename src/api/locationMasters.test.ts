import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { fetchCitiesByState, fetchStatesByCountry, searchCities } from './geo'
import { locationMasterApis, locationMasterErrors } from './locationMasters'
import { masterApis } from './masters'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return { url: new URL(String(url)), init: init as RequestInit }
}

const ok = (data: unknown) => jsonResponse(200, { success: true, message: '', data })

describe('geography lookups', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('loads states by country from an envelope or a bare array', async () => {
    fetchMock.mockResolvedValue(ok([{ stateNo: 27, stateName: 'Maharashtra' }]))
    await expect(fetchStatesByCountry(1)).resolves.toEqual([{ stateNo: 27, stateName: 'Maharashtra' }])
    expect(lastCall(fetchMock).url.pathname).toBe('/api/master/states/by-country/1')

    fetchMock.mockResolvedValue(jsonResponse(200, [{ cityNo: 400, cityName: 'Mumbai' }]))
    await expect(fetchCitiesByState(27)).resolves.toEqual([{ cityNo: 400, cityName: 'Mumbai' }])
    expect(lastCall(fetchMock).url.pathname).toBe('/api/master/cities/by-state/27')
  })

  it('does not call the server without a parent or keyword', async () => {
    await expect(fetchStatesByCountry(0)).resolves.toEqual([])
    await expect(searchCities('  ')).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('searches cities by keyword, narrowed to a state', async () => {
    fetchMock.mockResolvedValue(ok([{ cityNo: 400, cityName: 'Mumbai', stateNo: 27, stateName: 'Maharashtra', countryNo: 1, countryName: 'India' }]))
    const rows = await searchCities(' mum ', 27)
    const { url } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/cities/fill-city-combo')
    expect(Object.fromEntries(url.searchParams)).toEqual({ KeywordSearch: 'mum', StateNo: '27' })
    expect(rows).toEqual([{ cityNo: 400, cityName: 'Mumbai', stateNo: 27, stateName: 'Maharashtra', countryNo: 1, countryName: 'India' }])
  })
})

describe('location masters', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('normalises search rows, including nested parents and object creators', async () => {
    fetchMock.mockResolvedValue(
      ok([{ portNo: 9, code: 'PT09', portName: 'Nhava Sheva', portAlias: 'INNSA', country: { countryNo: 1, countryName: 'India' }, stateNo: 27, stateName: 'Maharashtra', cityNo: 400, cityName: 'Mumbai', createdBy: { printingName: 'EDP' } }]),
    )
    const rows = await locationMasterApis.port.search(3)
    expect(lastCall(fetchMock).url.pathname).toBe('/api/master/ports/search-data')
    expect(rows[0]).toMatchObject({ no: 9, code: 'PT09', name: 'Nhava Sheva', alias: 'INNSA', countryNo: 1, countryName: 'India', stateNo: 27, cityName: 'Mumbai', createdBy: 'EDP' })
  })

  it('sends each master’s own save body', async () => {
    fetchMock.mockResolvedValue(ok({ stateNo: 27 }))
    await expect(locationMasterApis.state.save({ name: ' Goa ', countryNo: 1, gstStateCode: '30', isUnionTerritory: false }, 3)).resolves.toBe(27)
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
      stateNo: null, stateName: 'Goa', gstStateCode: '30', isUnionTerritory: false, countryNo: 1, companyNo: 3,
    })

    fetchMock.mockResolvedValue(ok({ cityNo: 401 }))
    await locationMasterApis.city.save({ no: 401, name: 'Pune', countryNo: 1, stateNo: 27 }, 3)
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ cityNo: 401, cityName: 'Pune', stateNo: 27, companyNo: 3 })

    fetchMock.mockResolvedValue(ok({ portNo: 9 }))
    await locationMasterApis.port.save({ name: 'Nhava Sheva', alias: 'INNSA', countryNo: 1, stateNo: 27, cityNo: 400 }, 3)
    const { url, init } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/ports/save')
    expect(JSON.parse(String(init.body))).toEqual({ portNo: null, portName: 'Nhava Sheva', portAlias: 'INNSA', countryNo: 1, stateNo: 27, cityNo: 400 })
  })

  it('validates required parents before calling the server', async () => {
    expect(locationMasterErrors('port', { name: '', countryNo: 1 })).toEqual({
      name: 'Port name is required',
      stateNo: 'State is required',
      alias: 'Port alias is required',
      cityNo: 'City is required',
    })
    expect(locationMasterErrors('state', { name: 'Goa', countryNo: 1, gstStateCode: 'AB' })).toEqual({
      gstStateCode: 'GST state code is up to two digits',
    })
    await expect(locationMasterApis.city.save({ name: 'Pune', countryNo: 1 }, 3)).rejects.toMatchObject({ message: 'State is required' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deletes cities by path and the others by query', async () => {
    fetchMock.mockImplementation(async () => ok(true))
    await locationMasterApis.city.remove(401, 3)
    let call = lastCall(fetchMock)
    expect(call.init.method).toBe('DELETE')
    expect(call.url.pathname).toBe('/api/master/cities/401')
    expect(call.url.searchParams.get('companyNo')).toBe('3')

    await locationMasterApis.state.remove(27, 3)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/states/delete')
    expect(call.url.searchParams.get('stateNo')).toBe('27')
  })
})

describe('business entity type and country masters', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('saves an entity type with its description, null when cleared', async () => {
    fetchMock.mockResolvedValue(ok({ operCRMBusinessEntityTypeNo: 2 }))
    await expect(masterApis.businessEntityTypes.save({ no: 2, name: 'Customer', description: '  ' })).resolves.toBe(2)
    const { url, init } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/business-entity-types/save')
    expect(JSON.parse(String(init.body))).toEqual({ operCRMBusinessEntityTypeNo: 2, operCRMBusinessEntityTypeName: 'Customer', description: null })
    await expect(masterApis.businessEntityTypes.save({ name: 'X', description: 'd'.repeat(501) })).rejects.toMatchObject({
      message: 'Description is too long — keep it to 500 characters or fewer.',
    })
  })

  it('searches, saves and deletes business entity location types with their Default flag', async () => {
    fetchMock.mockResolvedValue(ok([{ locationTypeNo: 4, code: 'LT004', locationTypeName: 'Head Office', isDefault: true, inactive: false }]))
    const [row] = await masterApis.businessEntityLocationTypes.search(3, { name: 'Head' })
    expect(row).toMatchObject({ no: 4, code: 'LT004', name: 'Head Office', flags: { isDefault: true } })
    let call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/location-types/search-data')
    expect(call.url.searchParams.get('locationTypeName')).toBe('Head')

    fetchMock.mockResolvedValue(ok({ locationTypeNo: 5 }))
    await expect(masterApis.businessEntityLocationTypes.save({ name: ' Plant ', flags: { isDefault: false } })).resolves.toBe(5)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/location-types/save')
    expect(JSON.parse(String(call.init.body))).toEqual({ locationTypeNo: null, locationTypeName: 'Plant', isDefault: false })

    fetchMock.mockResolvedValue(ok(true))
    await masterApis.businessEntityLocationTypes.remove(5)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/location-types/delete')
    expect(call.url.searchParams.get('locationTypeNo')).toBe('5')
  })

  it('saves a country with the head office as companyNo', async () => {
    fetchMock.mockResolvedValue(ok({ countryNo: 1 }))
    await masterApis.countries.save({ name: 'India', companyNo: 3 })
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ countryNo: null, countryName: 'India', companyNo: 3 })
    await expect(masterApis.countries.save({ name: 'India' })).rejects.toMatchObject({ message: 'Company must be a positive number.' })
  })

  it('deletes an entity type by its own number field', async () => {
    fetchMock.mockResolvedValue(ok(true))
    await masterApis.businessEntityTypes.remove(2)
    const { url } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/business-entity-types/delete')
    expect(url.searchParams.get('operCRMBusinessEntityTypeNo')).toBe('2')
  })
})
