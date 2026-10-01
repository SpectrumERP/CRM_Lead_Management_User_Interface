import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sample from './fixtures/opportunity-form-fill-values.json'

vi.mock('./spectrumCompany', () => ({
  resolveSpectrumCompany: vi.fn(async () => ({ companies: [], companyNo: 1, headOfficeNo: 2 })),
}))
vi.mock('./opportunityFormFillValues', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./opportunityFormFillValues')>()),
  getOpportunityFillValues: vi.fn(async () => sample.data),
}))
vi.mock('./leadSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./leadSync')>()),
  refreshServerLead: vi.fn(async () => ({
    id: 'SL-0042',
    leadName: 'ERP rollout',
    spectrum: {
      leadNo: 42,
      ownerLoginNo: 11,
      businessEntityNo: 3,
      contactPersonDetailNos: [1, 9],
      currencyNo: 1,
      productNos: [7],
      detailLoaded: true,
    },
  })),
}))
vi.mock('./opportunities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./opportunities')>()),
  loadOpportunity: vi.fn(async (opportunityNo: number) => ({ opportunityNo })),
}))
vi.mock('./db', () => ({
  getState: () => ({ opportunities: [{ id: 'SO-0099' }], leads: [] }),
  upsertServerOpportunities: vi.fn(),
  replaceServerOpportunityActivities: vi.fn(),
  dropServerOpportunity: vi.fn(),
}))

const { convertServerLead } = await import('./opportunitySync')

describe('convertServerLead', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ success: true, message: '', data: { opportunityNo: 99 } }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('converts through the lead convert-to-opportunity API', async () => {
    const created = await convertServerLead('SL-0042', { dealValue: 500000, valueCurrency: 'USD', closingDate: '2026-12-31' })
    expect(created.id).toBe('SO-0099')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(new URL(String(url)).pathname).toBe('/api/crm/leads/convert-to-opportunity')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      leadNo: 42,
      // USD picked in the dialog → the server's US Dollar.
      currencyNo: 2,
      opportunityValue: 500000,
      expectedClosureDate: '2026-12-31T00:00:00.000Z',
    })
  })

  it('sends the currency picked in the dialog as is', async () => {
    await convertServerLead('SL-0042', { dealValue: 10, valueCurrency: 'INR', closingDate: '2026-12-31', currencyNo: 7 })
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body)).currencyNo).toBe(7)
  })

  it('refuses in-app leads', async () => {
    await expect(convertServerLead('LID-1001', { dealValue: 1, valueCurrency: 'INR', closingDate: '2026-12-31' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
