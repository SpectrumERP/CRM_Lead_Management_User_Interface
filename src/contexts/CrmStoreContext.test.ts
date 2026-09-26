import { describe, expect, it } from 'vitest'
import { sameList, shallowEqual } from './CrmStoreContext'

describe('store equality', () => {
  it('keeps object identity when slice references match', () => {
    const leads: string[] = []
    const left = { leads, notes: [] as string[] }
    const right = { leads, notes: [] as string[] }
    expect(shallowEqual(left, right)).toBe(false)
    expect(shallowEqual(left, { leads, notes: left.notes })).toBe(true)
  })

  it('treats lists as equal when item references match', () => {
    const item = { id: '1' }
    expect(sameList([item], [item])).toBe(true)
    expect(sameList([item], [{ id: '1' }])).toBe(false)
  })
})
