import { describe, expect, it } from 'vitest'
import { clampMoneyInput, FIELD_LIMITS } from './fieldLimits'

describe('field limits', () => {
  it('matches the CRM database design', () => {
    expect(FIELD_LIMITS).toMatchObject({
      leadName: 200,
      leadDescription: 1000,
      opportunityName: 200,
      activitySubject: 200,
      activityNotesOutcome: 1000,
      noteDiscussion: 1000,
      noteOriginatedBy: 200,
    })
  })

  it('keeps amounts within the money column (15 whole digits, 2 decimals)', () => {
    expect(clampMoneyInput('12000000')).toBe('12000000')
    expect(clampMoneyInput('1234567890123456789')).toBe('123456789012345')
    expect(clampMoneyInput('99.9999')).toBe('99.99')
    expect(clampMoneyInput('10.')).toBe('10.')
    expect(clampMoneyInput('')).toBe('')
  })
})
