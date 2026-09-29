import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { masterApis } from './masters'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return { url: new URL(String(url)), init: init as RequestInit & { headers: Record<string, string> } }
}

describe('master apis', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('searches with companyNo and optional filters, normalising rows', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: '',
        data: [
          { leadStageNo: 3, code: 'LS0003', leadStageName: 'Qualified', sequence: 5, createdBy: 'edp', modifiedBy: null, createdDate: '2026-09-01T10:00:00', modifiedDate: null, inactive: false },
        ],
      }),
    )
    const rows = await masterApis.leadStages.search(1, { name: 'Qual' })
    const { url, init } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/lead-stages/search-data')
    expect(Object.fromEntries(url.searchParams)).toEqual({ companyNo: '1', leadStageName: 'Qual' })
    expect(init.method).toBe('GET')
    expect(rows).toEqual([
      { no: 3, code: 'LS0003', name: 'Qualified', sequence: 5, createdBy: 'edp', modifiedBy: null, createdDate: '2026-09-01T10:00:00', modifiedDate: null, inactive: false },
    ])
  })

  it('uses each master’s own route and field names', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: [] }))
    await masterApis.leadActivityTypes.search(4, { name: 'Call', code: 'LAT' })
    const { url } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/lead-activity-types/search-data')
    expect(url.searchParams.get('leadActivityTypeName')).toBe('Call')
    expect(url.searchParams.get('code')).toBe('LAT')
  })

  it('saves an insert with a null number and an update with the existing one', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: 'Saved', data: { leadPriorityNo: 7 } }))
    await expect(masterApis.leadPriorities.save({ name: '  High ', sequence: 1 })).resolves.toBe(7)
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ leadPriorityNo: null, leadPriorityName: 'High', sequence: 1 })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: 'Saved', data: { leadSourceNo: 2 } }))
    await masterApis.leadSources.save({ no: 2, name: 'Web', sequence: 9 })
    const { url, init } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/lead-sources/save')
    expect(init.method).toBe('POST')
    // Lead Source has no sequence in its contract.
    expect(JSON.parse(String(init.body))).toEqual({ leadSourceNo: 2, leadSourceName: 'Web' })
  })

  it('validates name before calling the server', async () => {
    await expect(masterApis.leadStages.save({ name: '   ' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(masterApis.leadStages.save({ name: 'x'.repeat(101) })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(masterApis.leadStages.save({ name: 'Ok', sequence: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads one record with route id and companyNo', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: '',
        data: {
          leadSourceNo: 5, code: 'LSR005', leadSourceName: 'Website',
          documentStatus: { documentStatusNo: 1, documentStatusName: 'Authorized' },
          companies: [{ company: { companyNo: 1, companyCode: 'CM0001', companyName: 'Head Office' }, inactive: false }],
          createdBy: { loginNo: 1, loginId: 'edp', printingName: 'EDP', email: null },
          createdDate: '2026-09-01T10:00:00',
        },
      }),
    )
    const detail = await masterApis.leadSources.load(5, 1)
    const { url } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/lead-sources/load-data/5')
    expect(url.searchParams.get('companyNo')).toBe('1')
    expect(detail).toMatchObject({ no: 5, code: 'LSR005', name: 'Website', companies: [{ inactive: false }] })
  })

  it('deletes by query parameter', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: 'Deleted', data: true }))
    await expect(masterApis.leadStages.remove(5)).resolves.toBe(true)
    const { url, init } = lastCall(fetchMock)
    expect(init.method).toBe('DELETE')
    expect(url.pathname).toBe('/api/master/lead-stages/delete')
    expect(url.searchParams.get('leadStageNo')).toBe('5')
  })

  it('surfaces the server message when success is false', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: false, message: 'Lead stage is in use.', data: false }))
    await expect(masterApis.leadStages.remove(5)).rejects.toMatchObject({ code: 'VALIDATION', message: 'Lead stage is in use.' })
  })

  it('maps HTTP errors (e.g. 404 while the API is not deployed)', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))
    await expect(masterApis.leadPriorities.search(1)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
