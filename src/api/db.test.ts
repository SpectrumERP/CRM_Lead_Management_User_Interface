import { beforeEach, describe, expect, it } from 'vitest'
import { addEmail, addLead, addOpportunity, convertLeadToOpportunity, getState, patchActivity, patchLead, patchOpportunity, removeLead, removeOpportunity, __resetDb } from './db'
import { login, __resetAuthForTests } from './auth'
import { ApiError } from './errors'
import type { Lead } from '../data/leads'

const sampleLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'LID-TEST',
  leadName: 'LID-TEST',
  companyName: 'Test Co',
  contactPerson: 'A',
  email: 'a@test.com',
  phone: '9876543210',
  leadSource: 'Website',
  leadStage: 'New',
  leadStatus: 'Open',
  productsRequired: 'ERP',
  opportunityValue: 1,
  expectedClosureDate: '2024-12-31',
  assignedSalesperson: 'Priya Mehta',
  lastActivity: 'now',
  createdAt: '2024-09-18',
  ...overrides,
})

describe('crm db', () => {
  beforeEach(() => {
    __resetDb()
    __resetAuthForTests()
  })

  it('rejects mutations without a session', () => {
    expect(() => addLead(sampleLead())).toThrow(ApiError)
  })

  it('appends a lead and an audit row for admins', async () => {
    await login('rajiv.anand@forceintellect.com', 'Admin@123')
    const before = getState().leads.length
    addLead(sampleLead())
    expect(getState().leads[0]?.id).toBe('LID-TEST')
    expect(getState().leads.length).toBe(before + 1)
    expect(getState().audit[0]?.recordId).toBe('LID-TEST')
    expect(getState().audit[0]?.user).toBe('Rajiv Anand')
  })

  it('hides audit from non-admin readers', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    addLead(sampleLead({ id: 'LID-SALES' }))
    expect(getState().leads[0]?.id).toBe('LID-SALES')
    expect(getState().audit).toEqual([])
  })

  it('strips markup from lead fields', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    addLead(sampleLead({ companyName: '<script>alert(1)</script>Safe Co' }))
    expect(getState().leads[0]?.companyName).toBe('Safe Co')
  })

  it('returns a stable snapshot until data changes', async () => {
    await login('rajiv.anand@forceintellect.com', 'Admin@123')
    const first = getState()
    expect(getState()).toBe(first)
    const entities = first.entities
    addLead(sampleLead({ id: 'LID-SNAP' }))
    const next = getState()
    expect(next).not.toBe(first)
    expect(next.entities).toBe(entities)
  })

  it('rejects a duplicate lead id as CONFLICT', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    addLead(sampleLead({ id: 'LID-DUP' }))
    expect(() => addLead(sampleLead({ id: 'LID-DUP' }))).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    )
  })

  it('removes a lead and its related records', async () => {
    await login('rajiv.anand@forceintellect.com', 'Admin@123')
    addLead(sampleLead({ id: 'LID-DEL' }))
    addEmail({
      id: 'EM-DEL',
      leadId: 'LID-DEL',
      leadName: 'Test Co',
      to: 'a@test.com',
      from: 'sales@test.com',
      subject: 'Hi',
      body: 'Hello',
      date: '22-09-2026',
      time: '10:00',
      by: 'Rajiv Anand',
      direction: 'out',
    })
    const before = getState().leads.length
    removeLead('LID-DEL')
    expect(getState().leads.some((item) => item.id === 'LID-DEL')).toBe(false)
    expect(getState().leads.length).toBe(before - 1)
    expect(getState().emails.some((item) => item.leadId === 'LID-DEL')).toBe(false)
    expect(getState().audit[0]?.action).toBe('Deleted')
  })

  it('converts a lead into an opportunity', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    addLead(sampleLead({ id: 'LID-CONV' }))
    convertLeadToOpportunity('LID-CONV', {
      dealValue: 500000,
      valueCurrency: 'INR',
      closingDate: '2026-03-31',
    })
    const opp = getState().opportunities.find((item) => item.leadId === 'LID-CONV')
    expect(opp?.dealValue).toBe(500000)
    expect(opp?.closingDate).toBe('2026-03-31')
    expect(opp?.leadId).toBe('LID-CONV')
    expect(opp?.status).toBe('Open')
    expect(opp?.createdBy).toBeTruthy()
    expect(opp?.convertedBy).toBeTruthy()
    expect(opp?.convertedAt).toBeTruthy()
    expect(getState().leads.find((item) => item.id === 'LID-CONV')?.leadStage).toBe(
      'Converted to Opportunity',
    )
  })

  it('rejects a missing activity patch as NOT_FOUND', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    expect(() => patchActivity('ACT-MISSING', { status: 'Completed' })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('stores an outbound email against a lead', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    addLead(sampleLead({ id: 'LID-MAIL' }))
    addEmail({
      id: 'EM-TEST',
      leadId: 'LID-MAIL',
      leadName: 'Test Co',
      to: 'a@test.com',
      from: 'priya.mehta@forceintellect.com',
      subject: 'Discovery follow-up',
      body: 'Sharing next steps.',
      date: '21-09-2026',
      time: '10:15',
      by: 'Priya Mehta',
      direction: 'out',
    })
    expect(getState().emails[0]?.id).toBe('EM-TEST')
    expect(getState().emails[0]?.subject).toBe('Discovery follow-up')
    expect(getState().emails[0]?.to).toBe('a@test.com')
  })

  it('ignores mass-assignment of lead id on patch', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    addLead(sampleLead({ id: 'LID-PATCH' }))
    patchLead('LID-PATCH', { companyName: 'Patched Co', id: 'LID-HACKED' } as Partial<Lead>)
    expect(getState().leads.find((item) => item.id === 'LID-PATCH')?.companyName).toBe('Patched Co')
    expect(getState().leads.some((item) => item.id === 'LID-HACKED')).toBe(false)
  })

  it('rejects an invalid conversion payload', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    addLead(sampleLead({ id: 'LID-BADCONV' }))
    expect(() =>
      convertLeadToOpportunity('LID-BADCONV', {
        dealValue: -5,
        valueCurrency: 'INR',
        closingDate: '2026-03-31',
      }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('patches and removes an opportunity', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    addLead(sampleLead({ id: 'LID-OPP' }))
    const created = convertLeadToOpportunity('LID-OPP', {
      dealValue: 100000,
      valueCurrency: 'INR',
      closingDate: '2026-06-30',
    })
    patchOpportunity(created.id, { dealStage: 'Proposal', dealValue: 250000 })
    const patched = getState().opportunities.find((item) => item.id === created.id)
    expect(patched?.dealStage).toBe('Proposal')
    expect(patched?.dealValue).toBe(250000)
    expect(patched?.weightPercent).toBe(40)
    expect(patched?.weightedValue).toBe(100000)
    removeOpportunity(created.id)
    expect(getState().opportunities.some((item) => item.id === created.id)).toBe(false)
  })

  it('creates an opportunity directly without a reference lead', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    const created = addOpportunity({
      id: 'OPP-DIRECT',
      name: 'Direct Deal',
      companyName: 'Acme Corp',
      contactPerson: 'Jane Doe',
      email: 'jane@acme.com',
      phone: '9876543210',
      productsRequired: 'ERP',
      dealValue: 750000,
      valueCurrency: 'INR',
      dealStage: 'Qualification',
      status: 'Open',
      weightPercent: 20,
      weightedValue: 150000,
      closingDate: '2026-12-31',
      owner: 'Priya Mehta',
      leadSource: 'Inbound',
      lastActivity: 'Just now',
      createdAt: '2026-09-23',
      createdBy: 'Priya Mehta',
    })
    expect(created.leadId).toBeUndefined()
    expect(created.status).toBe('Open')
    expect(created.createdBy).toBe('Priya Mehta')
    expect(getState().opportunities.some((item) => item.id === 'OPP-DIRECT')).toBe(true)
  })
})
