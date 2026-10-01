import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sample from './fixtures/lead-form-fill-values.json'
import type { Activity } from '../data/activities'

vi.mock('./spectrumCompany', () => ({
  resolveSpectrumCompany: vi.fn(async () => ({ companies: [], companyNo: 1, headOfficeNo: 2 })),
}))
vi.mock('./leadFormFillValues', () => ({
  // Captured server data with the three activity statuses the server now sends.
  getLeadFillValues: vi.fn(async () => ({
    ...sample.data,
    users: [],
    activityStatuses: [
      { statusNo: 1, statusName: 'Open', isDefault: false },
      { statusNo: 2, statusName: 'Closed', isDefault: false },
      { statusNo: 3, statusName: 'Completed', isDefault: false },
    ],
  })),
}))
vi.mock('./opportunityFormFillValues', () => ({
  getOpportunityFillValues: vi.fn(async () => ({ activityStatuses: [{ statusNo: 1, statusName: 'Open' }, { statusNo: 2, statusName: 'Closed' }, { statusNo: 3, statusName: 'Completed' }] })),
}))
vi.mock('./users', () => ({
  searchUsers: vi.fn(async () => [{ loginNo: 12, loginId: 'vikram', printingName: 'Vikram Nair', email: null }]),
  userDisplayName: (u: { printingName?: string; loginId: string }) => u.printingName?.trim() || u.loginId,
}))
// The reload after saving is covered elsewhere; here only the request bodies matter.
vi.mock('./leads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./leads')>()),
  loadLead: vi.fn(async (leadNo: number) => ({ leadNo })),
}))
const store = vi.hoisted(() => ({ leads: [] as unknown[] }))
vi.mock('./db', () => ({
  getState: () => ({ leads: store.leads, notes: [], activities: [] }),
  upsertServerLeads: vi.fn(),
  replaceServerLeadChildren: vi.fn(),
  dropServerLead: vi.fn(),
}))

const { deleteServerLead, deleteServerLeadActivity, deleteServerLeadNote, saveServerLeadActivity, saveServerLeadNote, syncServerLeads } = await import('./leadSync')

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const activity: Activity = {
  id: 'ACT-1',
  type: 'Follow-up',
  subject: ' Call back ',
  leadId: 'SL-0042',
  leadName: 'ERP rollout',
  contactPerson: 'Roberto',
  assignedTo: 'Vikram Nair',
  scheduleDate: '2026-10-01',
  scheduleTime: '',
  reminder: 'None',
  notes: 'Discuss pricing',
  status: 'Pending',
  outcome: '',
  completeDate: '',
  completeTime: '',
  hasAttachment: false,
}

describe('server lead activities / notes', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => jsonResponse({ success: true, message: '', data: true }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  function lastBody(path: string) {
    const call = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname === path)
    return JSON.parse(String(call?.[1]?.body))
  }

  it('adds an activity with server numbers ("Follow-up" → "Follow Up")', async () => {
    await saveServerLeadActivity(activity)
    expect(lastBody('/api/crm/leads/save-activity-detail')).toEqual({
      leadNo: 42,
      activityTypeNo: 6,
      subject: 'Call back',
      dueDate: new Date('2026-10-01T00:00:00').toISOString(),
      assignToLoginNo: 12,
      notesOutcome: 'Discuss pricing',
      statusNo: 1,
    })
  })

  it('sends the Open status, and no closure date or remark, for an open activity', async () => {
    await saveServerLeadActivity({ ...activity, id: 'SA-8' })
    const body = lastBody('/api/crm/leads/save-activity-detail')
    expect(body).toMatchObject({ leadActivityDetailNo: 8, statusNo: 1, notesOutcome: 'Discuss pricing' })
    expect(body.closureDate).toBeUndefined()
    expect(body.completionRemark).toBeUndefined()
  })

  it('sends Closed with the closure date', async () => {
    await saveServerLeadActivity({ ...activity, id: 'SA-8', status: 'Closed', closureDate: '2026-10-02' })
    const body = lastBody('/api/crm/leads/save-activity-detail')
    expect(body).toMatchObject({ leadActivityDetailNo: 8, statusNo: 2 })
    expect(new Date(body.closureDate).toISOString().slice(0, 10)).toBe(new Date('2026-10-02T00:00:00').toISOString().slice(0, 10))
    expect(body.completionRemark).toBeUndefined()
  })

  it('sends Completed with the completion remark (Mark Complete), keeping the notes', async () => {
    await saveServerLeadActivity({ ...activity, id: 'SA-8', status: 'Completed', outcome: ' Agreed ' })
    const body = lastBody('/api/crm/leads/save-activity-detail')
    expect(body).toMatchObject({ leadActivityDetailNo: 8, statusNo: 3, completionRemark: 'Agreed', notesOutcome: 'Discuss pricing' })
    expect(body.closureDate).toBeUndefined()
  })

  it('uses Closed for Completed on a server without a "Completed" status', async () => {
    const { getLeadFillValues } = await import('./leadFormFillValues')
    vi.mocked(getLeadFillValues).mockResolvedValueOnce({
      ...sample.data,
      users: [],
      activityStatuses: [{ statusNo: 1, statusName: 'Open', isDefault: false }, { statusNo: 2, statusName: 'Closed', isDefault: false }],
    } as never)
    await saveServerLeadActivity({ ...activity, id: 'SA-8', status: 'Completed', outcome: 'Agreed' })
    expect(lastBody('/api/crm/leads/save-activity-detail')).toMatchObject({ statusNo: 2, completionRemark: 'Agreed' })
  })

  it('rejects an activity type the server does not have', async () => {
    await expect(saveServerLeadActivity({ ...activity, type: 'Negotiation' })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adds a note, converting the in-app dd-mm-yyyy stamp', async () => {
    await saveServerLeadNote({
      id: 'N-1',
      title: 'Internal note',
      text: ' Met at expo ',
      relatedLeadId: 'SL-0042',
      relatedLeadName: 'ERP rollout',
      date: '21-09-2026 09:30',
      by: 'EDP',
    })
    expect(lastBody('/api/crm/leads/save-notes-detail')).toEqual({
      leadNo: 42,
      originatedBy: 'EDP',
      notesDate: new Date('2026-09-21T09:30:00').toISOString(),
      notesDiscussion: 'Met at expo',
    })
  })

  it('edits a saved note by its detail number (an update, not a new note)', async () => {
    await saveServerLeadNote({
      id: 'SN-18',
      title: '',
      text: ' Revised pricing ',
      relatedLeadId: 'SL-0042',
      relatedLeadName: 'ERP rollout',
      date: '30-09-2026 16:05',
      by: 'admin',
    })
    expect(lastBody('/api/crm/leads/save-notes-detail')).toMatchObject({
      leadNo: 42,
      leadNotesDetailNo: 18,
      originatedBy: 'admin',
      notesDiscussion: 'Revised pricing',
    })
  })

  it('edits a saved activity by its detail number, keeping its fields', async () => {
    await saveServerLeadActivity({ ...activity, id: 'SA-8', subject: 'Call back (moved)', scheduleDate: '2026-10-09' })
    const body = lastBody('/api/crm/leads/save-activity-detail')
    expect(body).toMatchObject({ leadActivityDetailNo: 8, subject: 'Call back (moved)', statusNo: 1 })
    expect(body.dueDate.slice(0, 10)).toBe(new Date('2026-10-09T00:00:00').toISOString().slice(0, 10))
  })

  it('completes an activity even when the lead fill values lack the status (uses the opportunity ones)', async () => {
    const { getLeadFillValues } = await import('./leadFormFillValues')
    vi.mocked(getLeadFillValues).mockResolvedValueOnce({
      ...sample.data,
      users: [],
      activityStatuses: [{ statusNo: 1, statusName: 'Open', isDefault: false }],
    } as never)
    await saveServerLeadActivity({ ...activity, id: 'SA-8', status: 'Completed', outcome: 'Quote accepted' })
    expect(lastBody('/api/crm/leads/save-activity-detail')).toMatchObject({ leadActivityDetailNo: 8, statusNo: 3, completionRemark: 'Quote accepted' })
  })
})

describe('company number', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(jsonResponse({ success: true, message: '', data: [], totalPages: 1 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('searches leads with the head office number, as fill values do', async () => {
    await syncServerLeads()
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/crm/leads/search-data')
    expect(url.searchParams.get('CompanyNo')).toBe('2')
  })
})

describe('locked leads', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    store.leads = []
    vi.unstubAllGlobals()
  })

  it.each([
    ['converted', { leadStage: 'Converted To Opportunity', leadStatus: 'Converted', spectrum: { leadNo: 42 } }],
    ['at a completed stage', { leadStage: 'Won', leadStatus: 'Open', spectrum: { leadNo: 42, stageCompleted: true } }],
  ])('refuse activity and note changes when %s', async (_label, lead) => {
    store.leads = [{ id: 'SL-0042', ...lead }]
    await expect(saveServerLeadActivity({ ...activity, id: 'SA-8' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(saveServerLeadNote({ id: 'SN-1', title: '', text: 'x', relatedLeadId: 'SL-0042', relatedLeadName: '', date: '01-10-2026 10:00', by: 'a' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(deleteServerLeadActivity({ id: 'SA-8', leadId: 'SL-0042' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(deleteServerLeadNote({ id: 'SN-1', relatedLeadId: 'SL-0042' })).rejects.toMatchObject({ code: 'VALIDATION' })
    // The lead itself cannot be deleted either.
    await expect(deleteServerLead({ id: 'SL-0042', ...lead } as never)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
