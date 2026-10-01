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

  it('lead statuses and opportunity statuses use their own routes (statuses with a sequence)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { opportunityStatusNo: 3 } }))
    await masterApis.opportunityStatuses.save({ name: 'On Hold', sequence: 2 })
    let call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/opportunity-statuses/save')
    // isFirstActivity / isLastActivity are required: sent as false when not ticked.
    expect(JSON.parse(String(call.init.body))).toEqual({
      opportunityStatusNo: null, opportunityStatusName: 'On Hold', sequence: 2, isFirstActivity: false, isLastActivity: false,
    })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: [] }))
    await masterApis.leadStatuses.search(1)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/lead-statuses/search-data')
  })

  it('products: crm-products with productName, searched by company only', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: '',
        data: [{ crmProductNo: 7, code: 'PM0007', productName: 'CRM', createdBy: 'EDP', createdDate: '2026-09-01T00:00:00', inactive: false }],
      }),
    )
    const rows = await masterApis.crmProducts.search(2, { name: 'ignored' })
    let call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/crm-products/search-data')
    expect(Object.fromEntries(call.url.searchParams)).toEqual({ companyNo: '2' })
    expect(rows[0]).toMatchObject({ no: 7, code: 'PM0007', name: 'CRM', inactive: false })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { crmProductNo: 8 } }))
    await expect(masterApis.crmProducts.save({ name: ' Hot Rolled Coils ' })).resolves.toBe(8)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/crm-products/save')
    expect(JSON.parse(String(call.init.body))).toEqual({ crmProductNo: null, productName: 'Hot Rolled Coils' })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: true }))
    await masterApis.crmProducts.remove(8)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/crm-products/delete')
    expect(call.url.searchParams.get('crmProductNo')).toBe('8')
  })

  it('lead statuses save and load their first / last activity flags', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { leadStatusNo: 2 } }))
    await masterApis.leadStatuses.save({ name: 'Nurturing' })
    expect(lastCall(fetchMock).url.pathname).toBe('/api/master/lead-statuses/save')
    // Required booleans: sent as false when not ticked.
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
      leadStatusNo: null, leadStatusName: 'Nurturing', isFirstActivity: false, isLastActivity: false,
    })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { leadStatusNo: 1 } }))
    await masterApis.leadStatuses.save({ no: 1, name: 'Open', flags: { isFirstActivity: true } })
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
      leadStatusNo: 1, leadStatusName: 'Open', isFirstActivity: true, isLastActivity: false,
    })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { leadStatusNo: 5, code: 'LT0005', leadStatusName: 'Converted', isFirstActivity: false, isLastActivity: true } }))
    await expect(masterApis.leadStatuses.load(5, 2)).resolves.toMatchObject({ name: 'Converted', flags: { isFirstActivity: false, isLastActivity: true } })
  })

  it('opportunity stages: CRUD under /api/master with sequence, weightage and colour', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      success: true, message: '',
      data: [{ opportunityStageNo: 1, code: 'OG0001', opportunityStageName: 'Qualification', sequence: 1, weightage: 20, createdBy: 'EDP', createdDate: '2026-09-01T00:00:00', inactive: false }],
    }))
    const rows = await masterApis.opportunityStages.search(2)
    let call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/opportunity-stages/search-data')
    expect(rows[0]).toMatchObject({ no: 1, code: 'OG0001', name: 'Qualification', sequence: 1, numbers: { weightage: 20 } })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { opportunityStageNo: 1, opportunityStageName: 'Qualification', sequence: 1, weightage: 20, colorCoding: '#0EA5E9' } }))
    await expect(masterApis.opportunityStages.load(1, 2)).resolves.toMatchObject({ colorCoding: '#0EA5E9', numbers: { weightage: 20 } })
    expect(lastCall(fetchMock).url.pathname).toBe('/api/master/opportunity-stages/load-data/1')

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { opportunityStageNo: 7 } }))
    await expect(masterApis.opportunityStages.save({ name: 'Negotiation', sequence: 4, numbers: { weightage: 60 }, colorCoding: '#7C3AED' })).resolves.toBe(7)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/opportunity-stages/save')
    expect(JSON.parse(String(call.init.body))).toEqual({
      opportunityStageNo: null, opportunityStageName: 'Negotiation', sequence: 4, weightage: 60, colorCoding: '#7C3AED',
    })

    // Weightage is optional: left out when not given.
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { opportunityStageNo: 7 } }))
    await masterApis.opportunityStages.save({ no: 7, name: 'Negotiation', sequence: 4 })
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).not.toHaveProperty('weightage')

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: true }))
    await masterApis.opportunityStages.remove(7)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/opportunity-stages/delete')
    expect(call.url.searchParams.get('opportunityStageNo')).toBe('7')
  })

  it('rejects a weightage outside 0–100 and a missing sequence before calling the server', async () => {
    await expect(masterApis.opportunityStages.save({ name: 'X', sequence: 1, numbers: { weightage: 120 } })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(masterApis.opportunityStages.save({ name: 'X', numbers: { weightage: 10 } })).rejects.toMatchObject({ message: 'Sequence is required.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lead stages require a sequence and send it with the colour', async () => {
    await expect(masterApis.leadStages.save({ name: 'Qualified' })).rejects.toMatchObject({ code: 'VALIDATION', message: 'Sequence is required.' })
    await expect(masterApis.leadStages.save({ name: 'Qualified', sequence: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { leadStageNo: 9 } }))
    await expect(masterApis.leadStages.save({ name: 'Won', sequence: 6, colorCoding: '#16A34A' })).resolves.toBe(9)
    expect(lastCall(fetchMock).url.pathname).toBe('/api/master/lead-stages/save')
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ leadStageNo: null, leadStageName: 'Won', sequence: 6, colorCoding: '#16A34A' })
  })

  it('lead stages save and load their colour; opportunity statuses their first / last flags', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { leadStageNo: 3 } }))
    await masterApis.leadStages.save({ no: 3, name: 'Qualified', sequence: 3, colorCoding: ' #0EA5E9 ' })
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ leadStageNo: 3, leadStageName: 'Qualified', sequence: 3, colorCoding: '#0EA5E9' })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { leadStageNo: 3, code: 'LG0003', leadStageName: 'Qualified', sequence: 3, colorCoding: '#0EA5E9' } }))
    await expect(masterApis.leadStages.load(3, 2)).resolves.toMatchObject({ colorCoding: '#0EA5E9' })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { opportunityStatusNo: 1, opportunityStatusName: 'Open', sequence: 1, isFirstActivity: true, isLastActivity: false } }))
    await expect(masterApis.opportunityStatuses.load(1, 2)).resolves.toMatchObject({ flags: { isFirstActivity: true, isLastActivity: false } })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: { opportunityStatusNo: 1 } }))
    await masterApis.opportunityStatuses.save({ no: 1, name: 'Open', sequence: 1, flags: { isFirstActivity: true } })
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toMatchObject({ isFirstActivity: true, isLastActivity: false })
  })
})
