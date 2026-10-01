import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import leadSample from './fixtures/lead-form-fill-values.json'
import oppSample from './fixtures/opportunity-form-fill-values.json'

vi.mock('./spectrumCompany', () => ({
  resolveSpectrumCompany: vi.fn(async () => ({ companies: [], companyNo: 1, headOfficeNo: 2 })),
}))
vi.mock('./opportunityFormFillValues', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./opportunityFormFillValues')>()),
  getOpportunityFillValues: vi.fn(async () => oppSample.data),
}))
vi.mock('./leadFormFillValues', () => ({ getLeadFillValues: vi.fn(async () => ({ ...leadSample.data, users: [] })) }))
vi.mock('./users', () => ({
  searchUsers: vi.fn(async () => [{ loginNo: 12, loginId: 'vikram', printingName: 'Vikram Nair', email: null }]),
  userDisplayName: (u: { printingName?: string; loginId: string }) => u.printingName?.trim() || u.loginId,
}))
const store = { opportunities: [] as { id: string }[], leads: [] as { id: string }[] }
vi.mock('./db', () => ({
  getState: () => ({ ...store, notes: [], activities: [] }),
  upsertServerOpportunities: vi.fn((items: { id: string }[]) => { store.opportunities = items }),
  replaceServerOpportunityActivities: vi.fn(),
  dropServerOpportunity: vi.fn(),
  upsertServerLeads: vi.fn((items: { id: string }[]) => { store.leads = items }),
  replaceServerLeadChildren: vi.fn(),
  dropServerLead: vi.fn(),
}))

const db = await import('./db')
const { getLeadFillValues } = await import('./leadFormFillValues')
const { refreshServerOpportunity, saveServerOpportunityActivity } = await import('./opportunitySync')
const { refreshServerLead } = await import('./leadSync')

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const detail = {
  opportunityNo: 27,
  code: 'OP0027',
  opportunityName: 'Demo Lead Creation',
  lead: { leadNo: 13 },
  opportunityStage: { opportunityStageNo: 1, opportunityStageName: 'Qualification' },
  activities: [
    {
      opportunityActivityDetailNo: 4,
      activityType: { activityTypeNo: 2, activityTypeName: 'Phone Call' },
      subject: 'Pricing call',
      dueDate: '2026-10-05T00:00:00',
      assignedTo: { loginNo: 12, printingName: 'Vikram Nair' },
      status: { statusNo: 1, statusName: 'Open' },
    },
  ],
}

describe('opportunity view and activities', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(getLeadFillValues).mockClear()
    vi.mocked(db.replaceServerOpportunityActivities).mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('loads the opportunity once for simultaneous calls, with its own activities and no lead request', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ success: true, message: '', data: detail }))
    const [a, b] = await Promise.all([refreshServerOpportunity(27), refreshServerOpportunity(27)])
    expect(a).toBe(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new URL(String(fetchMock.mock.calls[0]![0])).pathname).toBe('/api/crm/opportunities/load-data/27')
    expect(getLeadFillValues).not.toHaveBeenCalled()
    const [, activities] = vi.mocked(db.replaceServerOpportunityActivities).mock.calls[0]!
    expect(activities).toEqual([
      expect.objectContaining({ id: 'SOA-4', opportunityId: 'SO-0027', leadId: 'SL-0013', type: 'Phone Call', assignedTo: 'Vikram Nair', scheduleDate: '2026-10-05', status: 'Pending' }),
    ])
  })

  it('refreshing a lead does not load lead fill values', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ success: true, message: '', data: { leadNo: 13 } }))
    await refreshServerLead(13)
    expect(getLeadFillValues).not.toHaveBeenCalled()
    expect(new URL(String(fetchMock.mock.calls[0]![0])).pathname).toBe('/api/crm/leads/load-data/13')
  })

  it('saves an opportunity activity through the opportunity API', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      jsonResponse(new URL(url).pathname.endsWith('save-activity-detail') ? { success: true, message: '', data: true } : { success: true, message: '', data: detail }),
    )
    await saveServerOpportunityActivity({
      id: 'ACT-1', type: 'Follow-up', subject: ' Send quote ', leadId: 'SL-0013', opportunityId: 'SO-0027', leadName: '', contactPerson: '',
      assignedTo: 'Vikram Nair', scheduleDate: '2026-10-06', scheduleTime: '', reminder: 'None', notes: '', status: 'Pending',
      outcome: '', completeDate: '', completeTime: '', hasAttachment: false,
    })
    const call = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname === '/api/crm/opportunities/save-activity-detail')!
    expect(JSON.parse(String(call[1].body))).toEqual({
      opportunityNo: 27,
      activityTypeNo: 6,
      subject: 'Send quote',
      dueDate: new Date('2026-10-06T00:00:00').toISOString(),
      assignedToNo: 12,
      statusNo: 1,
    })
  })
})
