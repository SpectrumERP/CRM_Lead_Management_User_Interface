import { describe, expect, it } from 'vitest'
import { withoutCreateEntries } from './RecordTimeline'
import type { LeadTimelineEntry } from '../data/leads'

const at = (min: number) => new Date(Date.UTC(2026, 9, 7, 11, 57 + min)).toISOString()
const e = (type: string, title: string, minute: number, description = ''): LeadTimelineEntry =>
  ({ type, title, description, at: at(minute), by: 'EDP' }) as LeadTimelineEntry

describe('withoutCreateEntries', () => {
  it('a new lead shows only "Lead Created" (initial status and stage are hidden)', () => {
    const rows = [e('LeadStage', 'Lead Stage', 0, 'Contacted'), e('LeadStatus', 'Lead Status', 0, 'Open'), e('LeadCreated', 'Lead Created', 0)]
    expect(withoutCreateEntries(rows).map((r) => r.title)).toEqual(['Lead Created'])
  })

  it('keeps later status / stage changes, even soon after the create', () => {
    const rows = [
      e('LeadCreated', 'Lead Created', 0),
      e('LeadStatus', 'Lead Status', 0, 'Open'),
      e('LeadStage', 'Lead Stage', 0, 'New'),
      e('LeadStage', 'Lead Stage', 2, 'Contacted'),
      e('LeadStatus', 'Lead Status', 30, 'On Hold'),
    ]
    expect(withoutCreateEntries(rows).map((r) => `${r.title}:${r.description}`)).toEqual([
      'Lead Created:',
      'Lead Stage:Contacted',
      'Lead Status:On Hold',
    ])
  })

  it('works for opportunities and title-only types', () => {
    const rows = [e('', 'Opportunity Created', 0), e('', 'Opportunity Stage', 1, 'Proposal'), e('OpportunityStatusChanged', 'Status', 1, 'Open')]
    expect(withoutCreateEntries(rows).map((r) => r.title)).toEqual(['Opportunity Created'])
  })

  it('leaves the timeline alone when the create entry is not loaded yet', () => {
    const rows = [e('LeadStage', 'Lead Stage', 90, 'Qualified')]
    expect(withoutCreateEntries(rows)).toHaveLength(1)
  })
})

describe('withoutDuplicates', () => {
  it('shows an entry that came twice only once', async () => {
    const { withoutDuplicates } = await import('./RecordTimeline')
    const a = e('Activity', 'Activity', 5, 'Email - Connect with purchase team')
    const later = e('Activity', 'Activity', 90, 'Email - Connect with purchase team')
    expect(withoutDuplicates([later, a, { ...a }])).toHaveLength(2)
  })
})
