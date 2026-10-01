import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { guessIsoCurrency } from './fillValues'
import sample from './fixtures/lead-form-fill-values.json'
import { fetchLeadFormFillValues, type LeadFormFillValues } from './leadFormFillValues'
import { buildLeadSaveBody, saveLead, type LeadFormDraft } from './leads'
import { __resetServerMasterValues, allowServerMasterValues, assertLeadStage } from './validate'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const fill = { ...sample.data, users: [] } as LeadFormFillValues

function draft(overrides: Partial<LeadFormDraft> = {}): LeadFormDraft {
  return {
    companyNo: 1,
    leadName: ' ERP rollout ',
    description: '',
    leadDate: new Date('2026-09-29T10:00:00.000Z'),
    ownerLoginNo: 11,
    sourceName: 'Website',
    stageName: 'New',
    statusName: 'Open',
    priorityName: 'Medium',
    salesOrganizationNo: 2,
    currencyNo: 1,
    estimatedAmount: 250000,
    businessEntityNo: 3,
    contactPersonDetailNo: 1,
    productNos: [7, -1, 5],
    notes: [],
    ...overrides,
  }
}

describe('buildLeadSaveBody', () => {
  it('maps names to server numbers and builds the save body', () => {
    const { body } = buildLeadSaveBody(draft(), fill)
    expect(body).toEqual({
      companyNo: 1,
      leadName: 'ERP rollout',
      description: undefined,
      leadDate: '2026-09-29T10:00:00.000Z',
      leadOwnerNo: 11,
      leadSourceNo: 2,
      leadStageNo: 2,
      leadStatusNo: 1,
      leadPriorityNo: 3,
      salesOrganizationNo: 2,
      businessEntityNo: 3,
      currencyNo: 1,
      estimatedAmount: 250000,
      contacts: [{ businessEntityContactPersonDetailNo: 1, isPrimary: true }],
      // Custom (negative id) products are not server products.
      products: [{ crmProductNo: 7 }, { crmProductNo: 5 }],
      activities: undefined,
      notes: undefined,
    })
  })

  it('links uploaded attachments by docNo', () => {
    expect(buildLeadSaveBody(draft({ attachmentNos: [91, 0, 92] }), fill).body?.attachments).toEqual([{ docNo: 91 }, { docNo: 92 }])
    expect(buildLeadSaveBody(draft(), fill).body).not.toHaveProperty('attachments')
  })

  it('includes the activity with a date-only due date kept on the same day', () => {
    const { body } = buildLeadSaveBody(
      draft({
        activities: [{ typeNo: 2, subject: ' Intro call ', dueDate: '2026-10-05', assignToLoginNo: 12, notesOutcome: '', statusName: 'Open' }],
        notes: [{ originatedBy: 'EDP', notesDate: new Date('2026-09-29T09:30:00.000Z'), notesDiscussion: ' Met at expo ' }],
      }),
      fill,
    )
    expect(body?.activities).toEqual([
      { activityTypeNo: 2, subject: 'Intro call', dueDate: '2026-10-05T00:00:00.000Z', assignToLoginNo: 12, notesOutcome: undefined, statusNo: 1 },
    ])
    expect(body?.notes).toEqual([{ originatedBy: 'EDP', notesDate: '2026-09-29T09:30:00.000Z', notesDiscussion: 'Met at expo' }])
  })

  it('sends several activities with the new lead', () => {
    const { body } = buildLeadSaveBody(
      draft({
        activities: [
          { typeNo: 2, subject: 'Intro call', dueDate: '2026-10-05', assignToLoginNo: 12, notesOutcome: '', statusName: 'Open' },
          { typeNo: 1, subject: 'Send brochure', dueDate: '2026-10-07', assignToLoginNo: 11, notesOutcome: 'PDF', statusName: 'Open' },
        ],
      }),
      fill,
    )
    expect(body?.activities).toHaveLength(2)
    expect(body?.activities?.[1]).toMatchObject({ activityTypeNo: 1, subject: 'Send brochure', assignToLoginNo: 11, notesOutcome: 'PDF' })
  })

  it('names the activity that needs fixing when there are several', () => {
    const { errors } = buildLeadSaveBody(
      draft({
        activities: [
          { typeNo: 2, subject: 'Intro call', dueDate: '2026-10-05', assignToLoginNo: 12, notesOutcome: '', statusName: 'Open' },
          { typeNo: 2, subject: 'Demo', dueDate: '2026-10-07', notesOutcome: '', statusName: 'Open' },
        ],
      }),
      fill,
    )
    expect(errors?.assignedTo).toBe('Activity "Demo": Select the assignee from the list')
  })

  it('requires a sales organization (the server column is not nullable)', () => {
    const { errors } = buildLeadSaveBody(draft({ salesOrganizationNo: undefined }), fill)
    expect(errors?.salesOrganization).toBe('Select a sales organization')
  })

  it('reports every field the server needs but the draft cannot supply', () => {
    const result = buildLeadSaveBody(
      draft({
        ownerLoginNo: undefined,
        sourceName: '',
        stageName: 'Nope',
        businessEntityNo: undefined,
        contactPersonDetailNo: undefined,
        activities: [{ typeNo: undefined, subject: 'x', dueDate: '2026-10-05', notesOutcome: '', statusName: 'Closed' }],
      }),
      fill,
    )
    expect(result.body).toBeUndefined()
    expect(Object.keys(result.errors ?? {}).sort()).toEqual(
      ['activityStatus', 'activityType', 'assignedTo', 'contact', 'entity', 'owner', 'source', 'stage'].sort(),
    )
    // The captured server data has no "Closed" activity status.
    expect(result.errors?.activityStatus).toContain('Closed')
  })

  it('matches master names case-insensitively', () => {
    expect(buildLeadSaveBody(draft({ stageName: 'proposal sent' }), fill).body?.leadStageNo).toBe(5)
  })
})

describe('saveLead', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
    __resetServerMasterValues()
  })

  it('posts the body and returns the new lead number', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: 'Saved', data: { leadNo: 42 } }))
    const { body } = buildLeadSaveBody(draft(), fill)
    await expect(saveLead(body!)).resolves.toBe(42)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(new URL(String(url)).pathname).toBe('/api/crm/leads/save')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(JSON.parse(JSON.stringify(body)))
  })

  it('surfaces the server validation message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { success: false, message: 'Failed', data: null, errors: [{ propertyName: 'LeadOwnerNo', errorMessage: 'Lead owner is required.', errorCode: 'X' }] }),
    )
    await expect(saveLead(buildLeadSaveBody(draft(), fill).body!)).rejects.toMatchObject({ message: 'Lead owner is required.' })
  })

  it('lets the in-app store accept server master names once fill values load', async () => {
    expect(() => assertLeadStage('Proposal Sent')).toThrow()
    allowServerMasterValues('leadStage', ['Proposal Sent'])
    expect(assertLeadStage('Proposal Sent')).toBe('Proposal Sent')
    expect(() => assertLeadStage('Nope')).toThrow()
    // Loading fill values is what registers them in the app.
    fetchMock.mockResolvedValue(jsonResponse(200, sample))
    await fetchLeadFormFillValues(1)
  })
})

describe('guessIsoCurrency', () => {
  it('matches ISO currency names exactly before the loose rules', () => {
    expect(guessIsoCurrency({ currencyName: 'Singapore Dollar', symbol: '$' })).toBe('SGD')
    expect(guessIsoCurrency({ currencyName: 'US Dollar', symbol: '$' })).toBe('USD')
    expect(guessIsoCurrency({ currencyName: 'Euro', symbol: '' })).toBe('EUR')
  })

  it('maps the server currency names and symbols seen so far', () => {
    const iso = sample.data.currencies.map((c) => `${c.currencyName}:${guessIsoCurrency(c)}`)
    expect(iso).toEqual([
      'Dirham:AED', 'dollar:USD', 'INR:INR', 'Nepalese Rupee:NPR', 'POUND:GBP',
      'Rupees:INR', 'Temp Currency Exc:USD', 'Temp Currency Inv:USD', 'US Dollar:USD',
    ])
  })
})
