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
  replaceServerOpportunityNotes: vi.fn(),
  dropServerOpportunity: vi.fn(),
  upsertServerLeads: vi.fn((items: { id: string }[]) => { store.leads = items }),
  replaceServerLeadChildren: vi.fn(),
  dropServerLead: vi.fn(),
}))

const db = await import('./db')
const { getLeadFillValues } = await import('./leadFormFillValues')
const { deleteServerOpportunityNote, refreshServerOpportunity, saveServerOpportunityActivity, saveServerOpportunityNote } = await import('./opportunitySync')
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
  notes: [
    {
      opportunityNotesDetailNo: 9,
      originatedBy: 'Vikram Nair',
      notesDate: '2026-10-05T10:30:00',
      notesDiscussion: 'Client asked for revised pricing',
    },
  ],
}

describe('opportunity view and activities', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(getLeadFillValues).mockClear()
    vi.mocked(db.replaceServerOpportunityActivities).mockClear()
    vi.mocked(db.replaceServerOpportunityNotes).mockClear()
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

  it('updates against the dashboard lastActivity number (serverDetailNo) and the row opportunityNo', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      jsonResponse(new URL(url).pathname.endsWith('save-activity-detail') ? { success: true, message: '', data: true } : { success: true, message: '', data: detail }),
    )
    await saveServerOpportunityActivity({
      id: 'SOA-4', serverDetailNo: 31, type: 'Phone Call', subject: 'Pricing call', leadId: 'SL-0013', opportunityId: 'SO-0027', leadName: '', contactPerson: '',
      assignedTo: 'Vikram Nair', scheduleDate: '2026-10-05', scheduleTime: '', reminder: 'None', notes: '', status: 'Pending',
      outcome: '', completeDate: '', completeTime: '', hasAttachment: false,
    })
    const call = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname === '/api/crm/opportunities/save-activity-detail')!
    expect(JSON.parse(String(call[1].body))).toMatchObject({ opportunityNo: 27, opportunityActivityDetailNo: 31 })
  })

  it('loads the opportunity internal notes from load-data', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ success: true, message: '', data: detail }))
    await refreshServerOpportunity(27)
    const [id, notes] = vi.mocked(db.replaceServerOpportunityNotes).mock.calls[0]!
    expect(id).toBe('SO-0027')
    expect(notes).toEqual([
      expect.objectContaining({ id: 'SON-9', relatedLeadId: 'SO-0027', by: 'Vikram Nair', text: 'Client asked for revised pricing', date: '05-10-2026 10:30' }),
    ])
  })

  it('adds, updates and deletes an opportunity note through the opportunity notes API', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      jsonResponse(/notes-detail/.test(new URL(url).pathname) ? { success: true, message: '', data: true } : { success: true, message: '', data: detail }),
    )
    const note = { id: 'N-1', title: 'Internal note', text: ' Follow up next week ', relatedLeadId: 'SO-0027', relatedLeadName: '', date: '06-10-2026 09:15', by: 'Vikram Nair' }
    await saveServerOpportunityNote(note)
    await saveServerOpportunityNote({ ...note, id: 'SON-9' })
    await deleteServerOpportunityNote({ id: 'SON-9', relatedLeadId: 'SO-0027' })
    const saves = fetchMock.mock.calls.filter(([url]) => new URL(String(url)).pathname === '/api/crm/opportunities/save-notes-detail')
    expect(JSON.parse(String(saves[0]![1].body))).toEqual({
      opportunityNo: 27,
      opportunityNotesDetailNo: null,
      originatedBy: 'Vikram Nair',
      notesDate: new Date('2026-10-06T09:15:00').toISOString(),
      notesDiscussion: 'Follow up next week',
    })
    expect(JSON.parse(String(saves[1]![1].body))).toMatchObject({ opportunityNo: 27, opportunityNotesDetailNo: 9 })
    const del = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname === '/api/crm/opportunities/delete-notes-detail')!
    expect(new URL(String(del[0])).search).toBe('?opportunityNotesDetailNos=9')
  })
})
