import { describe, expect, it } from 'vitest'
import { searchAll } from './search'
import { LEADS } from './leads'

describe('searchAll', () => {
  const catalog = {
    leads: LEADS,
    contacts: [],
    entities: [],
    activities: [],
    meetings: [],
    documents: [],
  }

  it('returns no groups for a short query', () => {
    expect(searchAll('t', catalog)).toEqual([])
  })

  it('finds a live lead by company name', () => {
    const groups = searchAll('Tata', catalog)
    expect(groups[0]?.type).toBe('lead')
    expect(groups[0]?.results.some((r) => r.navigateId === 'LID-1001')).toBe(true)
  })
})
