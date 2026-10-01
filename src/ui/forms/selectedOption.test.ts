import { describe, expect, it } from 'vitest'
import { initialFocusIndex } from './selectedOption'

const items = ['Cold', 'Converted', 'Dropped/Lost', 'On Hold', 'Open']
const key = (item: string) => item

describe('initialFocusIndex', () => {
  it('opens on the selected option', () => {
    expect(initialFocusIndex(items, 'Open', key, false)).toBe(4)
  })

  it('starts at the first row with nothing selected, a stale value, or while searching', () => {
    expect(initialFocusIndex(items, null, key, false)).toBe(0)
    expect(initialFocusIndex(items, 'Gone', key, false)).toBe(0)
    expect(initialFocusIndex(items, 'Open', key, true)).toBe(0)
  })
})
