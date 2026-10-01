import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { businessEntityLocation, searchBusinessEntities, searchContactPersons, type BusinessEntityRow } from './businessEntities'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const row: BusinessEntityRow = {
  businessEntityNo: 12,
  code: 'BE0012',
  businessEntityName: 'Tata Steel Ltd',
  businessEntityTypeName: 'Customer',
  crmTimeZoneNo: 1,
  crmTimeZoneName: 'IST',
  vatgstNo: '27AAACT2727Q1ZW',
  creditInsuranceLimit: 0,
  locationNo: 3,
  locationTypeNo: 1,
  address: 'Bombay House',
  countryNo: 1,
  countryName: 'India',
  stateNo: 27,
  stateName: 'Maharashtra',
  cityNo: 400,
  cityName: 'Mumbai',
  pinCode: '400001',
  createdBy: 1,
  userName: 'edp',
  displayName: 'EDP',
  createdDate: '2026-09-29T07:29:42.839Z',
}

describe('business entity search', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('sends the keyword and page size; reads paging from the top level', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: '',
        data: [row],
        alphabets: ['T'],
        pageSize: 50,
        totalRecords: 1240,
        totalPages: 25,
        firstRowNo: 1,
        lastRowNo: 50,
      }),
    )
    const page = await searchBusinessEntities({ keywordSearch: '  tata ' })
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/master/business-entities/search/business-entity-wise')
    expect(Object.fromEntries(url.searchParams)).toEqual({ KeywordSearch: 'tata', PageSize: '50' })
    expect(page).toMatchObject({ items: [row], alphabets: ['T'], totalRecords: 1240, totalPages: 25 })
  })

  it('maps every filter and the cursor to the API parameter names', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: [] }))
    await searchBusinessEntities({
      keywordSearch: 'abcd', startsWith: 'A', code: 'BE01', businessEntityName: 'Tata', timeZone: 'IST',
      address: 'Fort', countryName: 'India', stateName: 'Maharashtra', cityName: 'Mumbai',
      direction: 'Next', cursorRowNo: 50, pageSize: 10,
    })
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(Object.fromEntries(url.searchParams)).toEqual({
      KeywordSearch: 'abcd', StartsWith: 'A', Code: 'BE01', BusinessEntityName: 'Tata', TimeZone: 'IST',
      Address: 'Fort', CountryName: 'India', StateName: 'Maharashtra', CityName: 'Mumbai',
      Direction: 'Next', CursorRowNo: '50', PageSize: '10',
    })
  })

  it('omits empty filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: [] }))
    const page = await searchBusinessEntities({ keywordSearch: '   ', cityName: '' })
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(Object.fromEntries(url.searchParams)).toEqual({ PageSize: '50' })
    // Missing paging fields fall back to the returned rows.
    expect(page).toMatchObject({ items: [], totalRecords: 0, totalPages: 1, firstRowNo: 0 })
  })

  it('surfaces the server message when success is false', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: false, message: 'Company access denied.', data: null }))
    await expect(searchBusinessEntities()).rejects.toMatchObject({ code: 'VALIDATION', message: 'Company access denied.' })
  })

  it('formats the location line', () => {
    expect(businessEntityLocation(row)).toBe('Mumbai, Maharashtra')
    expect(businessEntityLocation({ cityName: null, stateName: null, countryName: 'India' })).toBe('India')
  })

  describe('contact persons', () => {
    const contact = {
      businessEntityContactPersonDetailNo: 1,
      businessEntityNo: 3,
      contactPersonName: 'Roberto Matos da Silva',
      email: 'roberto@example.com',
      designation: 'Depto. Técnico Comercial',
      businessEntityName: 'Spraying Systems Co.',
      code: 'BE0002',
      businessEntityTypeName: 'ACB',
    }

    it('loads contacts for the entity, sending the typed keyword', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: [contact] }))
      await expect(searchContactPersons({ businessEntityNo: 3, keywordSearch: ' Roberto Matos ' })).resolves.toEqual([contact])
      const url = new URL(String(fetchMock.mock.calls[0]![0]))
      expect(url.pathname).toBe('/api/master/business-entities/contact-persons')
      expect(Object.fromEntries(url.searchParams)).toEqual({ KeywordSearch: 'Roberto Matos', BusinessEntityNo: '3' })
    })

    it('can load one contact by its detail number', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: [contact] }))
      await searchContactPersons({ businessEntityNo: 3, contactPersonDetailNo: 1 })
      const url = new URL(String(fetchMock.mock.calls[0]![0]))
      expect(Object.fromEntries(url.searchParams)).toEqual({ BusinessEntityNo: '3', BusinessEntityContactPersonDetailNo: '1' })
    })

    it('treats a null data list as empty', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: null }))
      await expect(searchContactPersons({ businessEntityNo: 3 })).resolves.toEqual([])
    })

    it('rejects a missing entity without calling the server', async () => {
      await expect(searchContactPersons({ businessEntityNo: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
