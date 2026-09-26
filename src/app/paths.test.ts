import { describe, expect, it } from 'vitest'
import { matchAppPage, paths, recordIdFromPath } from './paths'

describe('paths', () => {
  it('maps lead detail URLs', () => {
    expect(matchAppPage('/leads/LID-1001')).toBe('lead-detail')
    expect(recordIdFromPath('/leads/LID-1001')).toBe('LID-1001')
    expect(paths.lead('LID-1001')).toBe('/leads/LID-1001')
  })

  it('does not treat create routes as ids', () => {
    expect(matchAppPage('/leads/new')).toBe('create-lead')
    expect(recordIdFromPath('/leads/new')).toBeUndefined()
  })

  it('maps opportunity list URL', () => {
    expect(matchAppPage('/opportunities')).toBe('opportunities')
    expect(paths.opportunities).toBe('/opportunities')
  })

  it('maps opportunity detail and edit URLs', () => {
    expect(matchAppPage('/opportunities/OPP-1001')).toBe('opportunity-detail')
    expect(matchAppPage('/opportunities/OPP-1001/edit')).toBe('edit-opportunity')
    expect(matchAppPage('/opportunities/new')).toBe('create-opportunity')
    expect(recordIdFromPath('/opportunities/OPP-1001')).toBe('OPP-1001')
    expect(recordIdFromPath('/opportunities/OPP-1001/edit')).toBe('OPP-1001')
    expect(recordIdFromPath('/opportunities/new')).toBeUndefined()
    expect(paths.opportunity('OPP-1001')).toBe('/opportunities/OPP-1001')
    expect(paths.opportunityEdit('OPP-1001')).toBe('/opportunities/OPP-1001/edit')
    expect(paths.opportunityNew).toBe('/opportunities/new')
  })

  it('maps lead edit URLs', () => {
    expect(matchAppPage('/leads/LID-1001/edit')).toBe('edit-lead')
    expect(recordIdFromPath('/leads/LID-1001/edit')).toBe('LID-1001')
    expect(paths.leadEdit('LID-1001')).toBe('/leads/LID-1001/edit')
  })
})
