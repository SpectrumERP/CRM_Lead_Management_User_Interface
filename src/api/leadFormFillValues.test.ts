import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import sample from './fixtures/lead-form-fill-values.json'
import {
  bySequence,
  defaultOption,
  fetchLeadFormFillValues,
  type LeadFormFillValues,
  type SpectrumResponse,
} from './leadFormFillValues'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Compile-time check that the captured server response matches the contract (it has no `users` yet).
const typedSample: SpectrumResponse<Omit<LeadFormFillValues, 'users'>> = sample

describe('lead form fill values', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('loads every dropdown list for the company', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, typedSample))
    const values = await fetchLeadFormFillValues(4)
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/crm/leads/fill-values')
    expect(url.searchParams.get('companyNo')).toBe('4')
    expect(values.leadSources).toEqual(typedSample.data.leadSources)
    expect(values.leadStages).toEqual(typedSample.data.leadStages)
    // Not sent by the server → empty rather than undefined.
    expect(values.users).toEqual([])
  })

  it('drops repeated rows the server sends', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, typedSample))
    const values = await fetchLeadFormFillValues(1)
    expect(typedSample.data.activityStatuses).toHaveLength(2)
    expect(values.activityStatuses).toEqual([{ statusNo: 1, statusName: 'Open', isDefault: false }])
  })

  it('fills in missing lists as empty arrays', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...typedSample, data: { leadSources: typedSample.data.leadSources } }))
    const values = await fetchLeadFormFillValues(1)
    expect(values.leadSources).toHaveLength(typedSample.data.leadSources.length)
    expect(values.leadStages).toEqual([])
    expect(values.activityStatuses).toEqual([])
  })

  it('surfaces the first field error when success is false', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: false,
        message: 'Request failed.',
        data: null,
        error: 'Validation failed.',
        errors: [{ propertyName: 'companyNo', errorMessage: 'Company is not assigned to this user.', errorCode: 'COMPANY_ACCESS' }],
        traceId: 'abc',
      }),
    )
    await expect(fetchLeadFormFillValues(1)).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Company is not assigned to this user.',
    })
  })

  it('rejects a bad company without calling the server', async () => {
    await expect(fetchLeadFormFillValues(0)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('orders by sequence and falls back to the first item when no default is flagged', () => {
    const stages = bySequence(typedSample.data.leadStages)
    expect(stages.map((s) => s.leadStageName)).toEqual(['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Converted', 'Lost'])
    expect(defaultOption(stages)?.leadStageName).toBe('New')
    expect(defaultOption([{ isDefault: false, id: 'a' }, { isDefault: true, id: 'b' }])?.id).toBe('b')
  })
})
