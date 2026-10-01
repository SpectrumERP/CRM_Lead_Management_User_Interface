import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, __resetAuthForTests } from './auth'
import { __resetDb, dropServerLead, getState, replaceServerLeadChildren, upsertServerLeads } from './db'
import type { LeadDetail, LeadSearchRow } from './leads'
import { formatAuditStamp } from '../data/leads'
import {
  isServerChildId,
  leadFromDetail,
  leadFromSearchRow,
  leadNoFromId,
  serverLeadId,
} from './leadSync'

const row: LeadSearchRow = {
  leadNo: 42,
  code: 'LD0042',
  leadName: 'ERP rollout',
  description: 'Phase 2',
  leadOwner: { loginNo: 11, loginId: 'priya', printingName: 'Priya Mehta' },
  leadStageName: 'Proposal Sent',
  leadStatusName: 'In Progress',
  leadPriorityName: 'High',
  currencyNo: 1,
  currencyName: 'Rupees',
  currencyNotation: '₹',
  estimatedAmount: 250000,
  businessEntityNo: 3,
  businessEntityName: 'Spraying Systems Co.',
  createdDate: '2026-09-20T10:00:00',
  modifiedDate: '2026-09-28T12:00:00',
}

const detail: LeadDetail = {
  leadNo: 42,
  code: 'LD0042',
  leadName: 'ERP rollout',
  leadDate: '2026-09-20T00:00:00',
  leadOwner: { loginNo: 11, printingName: 'Priya Mehta' },
  leadSource: { leadSourceNo: 2, leadSourceName: 'Website' },
  leadStage: { leadStageNo: 5, leadStageName: 'Proposal Sent' },
  leadStatus: { leadStatusNo: 2, leadStatusName: 'In Progress' },
  leadPriority: { leadPriorityNo: 4, leadPriorityName: 'High' },
  currency: { currencyNo: 1, currencyName: 'Rupees', currencyNotation: '₹' },
  estimatedAmount: 250000,
  businessEntity: { businessEntityNo: 3, businessEntityName: 'Spraying Systems Co.' },
  // Current API shape: nested person / product references.
  contacts: [
    { leadContactDetailNo: 1, businessEntityContactPerson: { businessEntityContactPersonDetailNo: 9, contactPersonName: 'Other Person' }, isPrimary: false },
    { leadContactDetailNo: 2, businessEntityContactPerson: { businessEntityContactPersonDetailNo: 1, contactPersonName: 'Roberto Matos' }, isPrimary: true },
  ],
  products: [{ leadProductDetailNo: 1, crmProduct: { crmProductNo: 7, productName: 'CRM', code: 'PM0007' } }],
  notes: [{ leadNotesDetailNo: 5, originatedBy: 'EDP', notesDate: '2026-09-21T09:30:00', notesDiscussion: 'Met at expo' }],
  activities: [
    {
      leadActivityDetailNo: 8,
      activityType: { activityTypeNo: 6, activityTypeName: 'Follow Up' },
      subject: 'Call back',
      dueDate: '2026-10-01T00:00:00',
      assignTo: { loginNo: 12, printingName: 'Vikram Nair' },
      status: { statusNo: 1, statusName: 'Open' },
    },
  ],
}

describe('server lead ids', () => {
  it('round-trips the lead number', () => {
    expect(serverLeadId(42)).toBe('SL-0042')
    expect(leadNoFromId('SL-0042')).toBe(42)
    expect(leadNoFromId('LID-1001')).toBeNull()
    expect(isServerChildId('SN-5')).toBe(true)
    expect(isServerChildId('NOTE-5')).toBe(false)
  })
})

describe('mapping', () => {
  it('maps a search row, keeping detail-only fields from the stored lead', () => {
    const lead = leadFromSearchRow(row, { ...leadFromDetail(detail).lead })
    expect(lead).toMatchObject({
      id: 'SL-0042',
      leadName: 'ERP rollout',
      companyName: 'Spraying Systems Co.',
      leadStage: 'Proposal Sent',
      leadStatus: 'In Progress',
      priority: 'High',
      valueCurrency: 'INR',
      opportunityValue: 250000,
      assignedSalesperson: 'Priya Mehta',
      createdAt: '2026-09-20',
      // From the earlier detail load:
      leadSource: 'Website',
      contactPerson: 'Roberto Matos',
      productTypes: ['CRM'],
    })
    expect(lead.spectrum).toMatchObject({ leadNo: 42, ownerLoginNo: 11, businessEntityNo: 3, currencyNo: 1, productNos: [7] })
  })

  it('maps the detail with primary contact first, notes and activities', () => {
    const { lead, notes, activities } = leadFromDetail(detail)
    expect(lead.contactPerson).toBe('Roberto Matos')
    expect(lead.spectrum?.contactPersonDetailNos).toEqual([1, 9])
    expect(lead.spectrum?.detailLoaded).toBe(true)
    expect(lead.spectrum?.leadDate).toBe('2026-09-20T00:00:00')
    expect(notes).toEqual([
      expect.objectContaining({ id: 'SN-5', relatedLeadId: 'SL-0042', text: 'Met at expo', by: 'EDP' }),
    ])
    expect(activities).toEqual([
      expect.objectContaining({ id: 'SA-8', type: 'Follow-up', assignedTo: 'Vikram Nair', scheduleDate: '2026-10-01', status: 'Pending' }),
    ])
  })
})

describe('audit (created / modified)', () => {
  it('reads modifiedBy from the user object the server sends (no user lookup)', () => {
    const lead = leadFromSearchRow({ ...row, createdBy: { loginNo: 1, printingName: 'EDP' }, modifiedBy: { loginNo: 12, printingName: 'Vikram Nair' } })
    expect(lead.audit).toEqual({ createdBy: 'EDP', createdAt: '2026-09-20T10:00:00', modifiedBy: 'Vikram Nair', modifiedAt: '2026-09-28T12:00:00' })
  })

  it('still copes with a bare login number: known only when it is the creator', () => {
    expect(leadFromSearchRow({ ...row, createdBy: { loginNo: 1, printingName: 'EDP' }, modifiedBy: 1 }).audit?.modifiedBy).toBe('EDP')
    expect(leadFromSearchRow({ ...row, modifiedBy: 99 }).audit?.modifiedBy).toBe('')
  })

  it('takes modifiedBy from the detail user object', () => {
    const { lead } = leadFromDetail({ ...detail, createdBy: { loginNo: 1, printingName: 'EDP' }, createdDate: '2026-09-20T10:00:00', modifiedBy: { loginNo: 12, printingName: 'Vikram Nair' }, modifiedDate: '2026-09-28T12:00:00' })
    expect(lead.audit).toMatchObject({ createdBy: 'EDP', modifiedBy: 'Vikram Nair', modifiedAt: '2026-09-28T12:00:00' })
  })

  it('formats the stamps as date and time', () => {
    expect(formatAuditStamp('2026-09-28T14:05:00')).toMatch(/28 Sept? 2026,? 14:05/)
    expect(formatAuditStamp('')).toBe('—')
  })
})

describe('API shape changes', () => {
  it('reads the nested references of the current search-data rows', () => {
    const lead = leadFromSearchRow({
      leadNo: 7,
      leadName: 'Port ERP',
      leadDate: '2026-09-01T00:00:00',
      leadSource: { leadSourceNo: 2, leadSourceName: 'Website' },
      leadStage: { leadStageNo: 3, leadStageName: 'Qualified', colorCoding: '#0EA5E9' },
      leadStatus: { leadStatusNo: 1, leadStatusName: 'Open' },
      leadPriority: { leadPriorityNo: 2, leadPriorityName: 'High' },
      businessEntity: { businessEntityNo: 5, businessEntityName: 'Acme Shipping' },
      salesOrganization: { salesOrganizationNo: 4, salesOrganizationName: 'West' },
      currency: { currencyNo: 1, currencyName: 'Indian Rupee', currencyCode: 'INR', symbol: '₹' },
      estimatedAmount: 1500,
    })
    expect(lead).toMatchObject({
      companyName: 'Acme Shipping',
      leadSource: 'Website',
      leadStage: 'Qualified',
      leadStatus: 'Open',
      priority: 'High',
      opportunityValue: 1500,
      spectrum: { leadNo: 7, businessEntityNo: 5, currencyNo: 1, salesOrganizationNo: 4, leadDate: '2026-09-01T00:00:00' },
    })
  })

  it('still reads the earlier flat contact / product rows', () => {
    const { lead } = leadFromDetail({
      ...detail,
      contacts: [{ leadContactDetailNo: 2, businessEntityContactPersonDetailNo: 1, contactPersonName: 'Roberto Matos', isPrimary: true }],
      products: [{ leadProductDetailNo: 1, crmProductNo: 7, productName: 'CRM' }],
    })
    expect(lead.contactPerson).toBe('Roberto Matos')
    expect(lead.spectrum?.contactPersonDetailNos).toEqual([1])
    expect(lead.spectrum?.productNos).toEqual([7])
    expect(lead.productTypes).toEqual(['CRM'])
  })

  it('takes contacts from search rows now that the API sends them', () => {
    const lead = leadFromSearchRow({
      ...row,
      contacts: [
        { leadContactDetailNo: 3, businessEntityContactPerson: { businessEntityContactPersonDetailNo: 4, contactPersonName: 'Manju devi' }, isPrimary: true },
        { leadContactDetailNo: 4, businessEntityContactPerson: { businessEntityContactPersonDetailNo: 5, contactPersonName: 'Vamika Patel' }, isPrimary: false },
      ],
    })
    expect(lead.contactPerson).toBe('Manju devi')
    expect(lead.contacts?.map((c) => [c.name, c.primary, c.businessEntityContactPersonDetailNo])).toEqual([
      ['Manju devi', true, 4],
      ['Vamika Patel', false, 5],
    ])
    expect(lead.spectrum?.contactPersonDetailNos).toEqual([4, 5])
  })
})

describe('store', () => {
  beforeEach(async () => {
    // Spectrum login refused → the demo admin account signs in (the store needs a session).
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    __resetDb()
    await login('rajiv.anand@forceintellect.com', 'Admin@123')
  })

  afterEach(() => {
    __resetDb()
    __resetAuthForTests()
    vi.unstubAllGlobals()
  })

  it('upserts server leads without dropping details or in-app leads', () => {
    const localCount = getState().leads.length
    const full = leadFromDetail(detail).lead
    upsertServerLeads([full])
    // A later search row has no contacts / products — the stored ones must survive.
    upsertServerLeads([leadFromSearchRow(row, getState().leads.find((l) => l.id === full.id))], { replaceAll: true })
    const stored = getState().leads.find((l) => l.id === 'SL-0042')
    expect(stored?.contactPerson).toBe('Roberto Matos')
    expect(stored?.spectrum?.contactPersonDetailNos).toEqual([1, 9])
    expect(getState().leads.length).toBe(localCount + 1)
  })

  it('replaceAll removes server leads the server no longer returns', () => {
    upsertServerLeads([leadFromSearchRow(row), leadFromSearchRow({ ...row, leadNo: 43 })])
    upsertServerLeads([leadFromSearchRow(row)], { replaceAll: true })
    const ids = getState().leads.filter((l) => l.spectrum).map((l) => l.id)
    expect(ids).toEqual(['SL-0042'])
  })

  it('replaces only server notes / activities of a lead', () => {
    const { lead, notes, activities } = leadFromDetail(detail)
    upsertServerLeads([lead])
    const before = getState().notes.length
    replaceServerLeadChildren(lead.id, { notes, activities }, isServerChildId)
    replaceServerLeadChildren(lead.id, { notes, activities }, isServerChildId)
    expect(getState().notes.length).toBe(before + 1)
    expect(getState().activities.filter((a) => a.leadId === lead.id)).toHaveLength(1)
    dropServerLead(lead.id)
    expect(getState().notes.some((n) => n.relatedLeadId === lead.id)).toBe(false)
  })
})

describe('activity status from load-data', () => {
  it('maps Open / Closed / Completed with the closure date, remark and notes', () => {
    const { activities } = leadFromDetail({
      ...detail,
      activities: [
        { leadActivityDetailNo: 1, subject: 'Call', status: { statusNo: 1, statusName: 'Open' }, notesOutcome: 'Ask for budget' },
        { leadActivityDetailNo: 2, subject: 'Visit', status: { statusNo: 2, statusName: 'Closed' }, closureDate: '2026-10-02T00:00:00' },
        { leadActivityDetailNo: 3, subject: 'Demo', status: { statusNo: 3, statusName: 'Completed' }, completionRemark: 'Liked it' },
      ],
    })
    expect(activities.map((a) => [a.id, a.status])).toEqual([['SA-1', 'Pending'], ['SA-2', 'Closed'], ['SA-3', 'Completed']])
    expect(activities[0]).toMatchObject({ notes: 'Ask for budget', outcome: '' })
    expect(activities[1]).toMatchObject({ closureDate: '2026-10-02' })
    expect(activities[2]).toMatchObject({ outcome: 'Liked it' })
  })
})

describe('completed lead stage', () => {
  it('reads isStagedCompleted from search-data and load-data', async () => {
    const { isLeadLocked } = await import('../data/leads')
    const open = leadFromSearchRow({ ...row, leadStage: { leadStageNo: 2, leadStageName: 'New', isStagedCompleted: false } })
    expect(open.spectrum?.stageCompleted).toBe(false)
    expect(isLeadLocked(open)).toBe(false)
    const { lead } = leadFromDetail({ ...detail, leadStage: { leadStageNo: 9, leadStageName: 'Won', isStagedCompleted: true } })
    expect(lead.spectrum?.stageCompleted).toBe(true)
    expect(isLeadLocked(lead)).toBe(true)
  })
})

describe('last activity (search-data lastActivityDate)', () => {
  it('takes the date from the search row, clears it on null, keeps it through load-data', () => {
    const withDate = leadFromSearchRow({ ...row, lastActivityDate: '2026-10-01T09:15:00Z' })
    expect(withDate.lastActivityAt).toBe('2026-10-01T09:15:00Z')
    expect(leadFromSearchRow({ ...row, lastActivityDate: null }, withDate).lastActivityAt).toBeNull()
    // An older server without the field keeps what was known.
    expect(leadFromSearchRow(row, withDate).lastActivityAt).toBe('2026-10-01T09:15:00Z')
  })
})
