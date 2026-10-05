import { describe, expect, it } from 'vitest'
import type { Activity } from './activities'
import type { Lead } from './leads'
import type { Opportunity } from './opportunities'
import {
  attentionReasons,
  closuresThisMonth,
  currentMonthRange,
  groupActivities,
  lastSixMonthsSales,
  leadPipeline,
  leadsRequiringAttention,
  opportunitiesRequiringAttention,
  opportunityPipeline,
  summarizeActivities,
} from './dashboard'

const TODAY = new Date(2026, 9, 3) // 03 Oct 2026

function lead(id: string, patch: Partial<Lead> = {}): Lead {
  return {
    id,
    leadName: id,
    companyName: 'Acme',
    contactPerson: '',
    email: '',
    phone: '',
    leadSource: 'Website',
    leadStage: 'New',
    leadStatus: 'Open',
    productsRequired: '',
    opportunityValue: 0,
    assignedSalesperson: 'Asha',
    lastActivity: '',
    createdAt: '2026-10-01',
    audit: { createdBy: '', createdAt: '2026-10-01', modifiedBy: '', modifiedAt: '2026-10-01' },
    ...patch,
  }
}

function opp(id: string, patch: Partial<Opportunity> = {}): Opportunity {
  return {
    id,
    name: id,
    companyName: 'Acme',
    contactPerson: '',
    email: '',
    phone: '',
    productsRequired: '',
    dealValue: 1000,
    valueCurrency: 'INR',
    dealStage: 'Proposal',
    status: 'Open',
    weightPercent: 40,
    weightedValue: 400,
    closingDate: '2026-10-20',
    owner: 'Asha',
    leadSource: '',
    lastActivity: '',
    createdAt: '2026-10-01',
    createdBy: '',
    audit: { createdBy: '', createdAt: '2026-10-01', modifiedBy: '', modifiedAt: '2026-10-01' },
    ...patch,
  }
}

function activity(id: string, patch: Partial<Activity> = {}): Activity {
  return {
    id,
    type: 'Task',
    subject: id,
    leadId: 'L1',
    leadName: 'L1',
    contactPerson: '',
    assignedTo: '',
    scheduleDate: '2026-10-10',
    scheduleTime: '',
    reminder: 'None',
    notes: '',
    status: 'Pending',
    outcome: '',
    completeDate: '',
    completeTime: '',
    hasAttachment: false,
    ...patch,
  }
}

describe('currentMonthRange', () => {
  it('covers the first to the last day of the month', () => {
    expect(currentMonthRange(TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(currentMonthRange(new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('leadPipeline', () => {
  const stages = [
    { name: 'Contacted', sequence: 2 },
    { name: 'New', sequence: 1 },
    { name: 'Qualified', sequence: 3 },
  ]

  it('counts open leads only, in master order, keeping empty stages', () => {
    const rows = leadPipeline(
      [
        lead('L1', { leadStage: 'New' }),
        lead('L2', { leadStage: 'New', leadStatus: 'On Hold' }),
        lead('L3', { leadStage: 'Contacted' }),
        lead('L4', { leadStage: 'Contacted', leadStatus: 'Dropped/Lost' }),
      ],
      stages,
    )
    expect(rows).toEqual([
      { stage: 'New', count: 1 },
      { stage: 'Contacted', count: 1 },
      { stage: 'Qualified', count: 0 },
    ])
  })

  it('appends a stage the master does not list', () => {
    const rows = leadPipeline([lead('L1', { leadStage: 'Legacy' as Lead['leadStage'] })], stages)
    expect(rows.map((r) => r.stage)).toEqual(['New', 'Contacted', 'Qualified', 'Legacy'])
  })
})

describe('opportunityPipeline', () => {
  it('excludes on hold / won / lost and weights by the master stage', () => {
    const rows = opportunityPipeline(
      [
        opp('O1', { dealStage: 'Proposal', dealValue: 1000 }),
        opp('O2', { dealStage: 'Proposal', dealValue: 500, status: 'Won' }),
        opp('O3', { dealStage: 'Proposal', dealValue: 500, status: 'On Hold' }),
      ],
      [
        { name: 'Qualification', sequence: 1, weight: 20 },
        { name: 'Proposal', sequence: 2, weight: 50 },
      ],
    )
    expect(rows[0]).toMatchObject({ stage: 'Qualification', count: 0 })
    expect(rows[1]).toMatchObject({
      stage: 'Proposal',
      weight: 50,
      count: 1,
      values: [{ value: 1000, currency: 'INR' }],
      weighted: [{ value: 500, currency: 'INR' }],
    })
  })
})

describe('attention', () => {
  it('flags not started, overdue and stagnant', () => {
    const none = summarizeActivities([], TODAY)
    expect(attentionReasons(none, 3)).toEqual(['Not Started'])

    const overdue = summarizeActivities([activity('A1', { scheduleDate: '2026-10-02' })], TODAY)
    expect(attentionReasons(overdue, 16)).toEqual(['Activity Overdue', 'Stagnant'])

    const fine = summarizeActivities([activity('A1', { scheduleDate: '2026-10-03' })], TODAY)
    expect(attentionReasons(fine, 15)).toEqual([])
  })

  it('ignores finished activities when checking overdue', () => {
    const summary = summarizeActivities([activity('A1', { scheduleDate: '2026-09-01', status: 'Completed' })], TODAY)
    expect(summary.overdue).toBe(false)
    expect(summary.last?.id).toBe('A1')
  })

  it('lists open leads that need action, youngest first', () => {
    const leads = [
      lead('L1', { createdAt: '2026-09-01' }),
      lead('L2', { createdAt: '2026-10-02' }),
      lead('L3', { leadStatus: 'On Hold' }),
      lead('L4'),
    ]
    const { byLead } = groupActivities([activity('A4', { leadId: 'L4' })])
    const rows = leadsRequiringAttention(leads, byLead, TODAY)
    expect(rows.map((r) => r.lead.id)).toEqual(['L2', 'L1'])
    expect(rows[0].reasons).toEqual(['Not Started'])
  })

  it('lists open opportunities that need action', () => {
    const items = [
      opp('O1', { audit: { createdBy: '', createdAt: '', modifiedBy: '', modifiedAt: '2026-09-01' } }),
      opp('O2', { status: 'Lost' }),
    ]
    const { byOpportunity } = groupActivities([activity('A1', { opportunityId: 'O1' })])
    const rows = opportunitiesRequiringAttention(items, byOpportunity, TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].reasons).toEqual(['Stagnant'])
    expect(rows[0].daysInStage).toBe(32)
  })
})

describe('closuresThisMonth', () => {
  it('keeps open opportunities closing in the current month', () => {
    const items = [
      opp('O1', { closingDate: '2026-10-01' }),
      opp('O2', { closingDate: '2026-10-31' }),
      opp('O3', { closingDate: '2026-11-01' }),
      opp('O4', { closingDate: '2026-09-30' }),
      opp('O5', { closingDate: '2026-10-15', status: 'On Hold' }),
    ]
    const { byOpportunity } = groupActivities([
      activity('A1', { opportunityId: 'O2' }),
      activity('A2', { opportunityId: 'O2', status: 'Completed', scheduleDate: '2026-09-20' }),
    ])
    const rows = closuresThisMonth(items, byOpportunity, TODAY)
    expect(rows.map((r) => r.opportunity.id)).toEqual(['O1', 'O2'])
    expect(rows[1].pending.map((a) => a.id)).toEqual(['A1'])
    expect(rows[1].last?.id).toBe('A2')
    expect(rows[0].weighted).toBe(400)
  })
})

describe('lastSixMonthsSales', () => {
  it('returns six months ending with the current one, zero-filled', () => {
    const months = lastSixMonthsSales([], TODAY)
    expect(months.map((m) => m.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(months.every((m) => m.created === 0 && m.won === 0 && m.lost === 0)).toBe(true)
  })

  it('counts created, won and lost per month', () => {
    const months = lastSixMonthsSales(
      [
        opp('O1', { audit: { createdBy: '', createdAt: '2026-08-05', modifiedBy: '', modifiedAt: '2026-09-10' }, status: 'Won', dealValue: 700 }),
        opp('O2', { audit: { createdBy: '', createdAt: '2026-10-01', modifiedBy: '', modifiedAt: '2026-10-02' }, status: 'Lost', dealValue: 300 }),
        opp('O3', { audit: { createdBy: '', createdAt: '2025-01-01', modifiedBy: '', modifiedAt: '2025-01-01' } }),
      ],
      TODAY,
    )
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]))
    expect(byKey['2026-08'].created).toBe(1)
    expect(byKey['2026-09']).toMatchObject({ won: 1, wonValue: [{ value: 700, currency: 'INR' }] })
    expect(byKey['2026-10']).toMatchObject({ created: 1, lost: 1, lostValue: [{ value: 300, currency: 'INR' }] })
  })
})
