import { describe, expect, it } from 'vitest'
import { stageBadgeStyle, withAlpha } from './useOpportunityStageColors'

describe('stage colours', () => {
  it('adds alpha to 6- and 3-digit hex colours', () => {
    expect(withAlpha('#8B5CF6', 0.25)).toBe('#8B5CF640')
    expect(withAlpha('#EF4444', 1)).toBe('#EF4444ff')
    expect(withAlpha('#abc', 0)).toBe('#aabbcc00')
  })

  it('builds a tinted badge from the server colour, or nothing without one', () => {
    expect(stageBadgeStyle('#22C55E')).toEqual({ backgroundColor: '#22C55E1a', color: '#22C55E', borderColor: '#22C55E59' })
    expect(stageBadgeStyle(undefined)).toBeUndefined()
  })
})
