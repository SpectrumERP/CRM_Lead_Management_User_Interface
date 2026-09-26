import { describe, expect, it } from 'vitest'
import { sortAlpha, sortByLabel, toOptions } from './options'

describe('form options', () => {
  it('turns string lists into A–Z value/label pairs', () => {
    expect(toOptions(['Open', 'Closed'])).toEqual([
      { value: 'Closed', label: 'Closed' },
      { value: 'Open', label: 'Open' },
    ])
  })

  it('sorts labels A–Z and keeps empty values first', () => {
    expect(sortAlpha(['Vikram', 'Arjun', 'Priya'])).toEqual(['Arjun', 'Priya', 'Vikram'])
    expect(
      sortByLabel([
        { value: 'b', label: 'Zebra' },
        { value: '', label: 'All' },
        { value: 'a', label: 'Apple' },
      ]),
    ).toEqual([
      { value: '', label: 'All' },
      { value: 'a', label: 'Apple' },
      { value: 'b', label: 'Zebra' },
    ])
  })
})
