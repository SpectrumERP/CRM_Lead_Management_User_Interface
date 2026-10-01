import { describe, expect, it } from 'vitest'
import { contactDetailNos, fromContactEntries, toContactEntries, type EntityContactsValue } from './EntityContactsFields'

const value: EntityContactsValue = {
  entity: { id: 'SPX-BE-3', name: 'Tata consultancy Service', type: '', city: '', source: 'spectrum', businessEntityNo: 3 },
  primary: { id: 'SPX-CP-1', name: 'Manju devi', designation: 'Manager', email: 'manju@example.com', phone: '', businessEntityContactPersonDetailNo: 1 },
  secondary: [
    { id: 'SPX-CP-2', name: 'Miss Vamika Patel', designation: 'Human Resource Lead', email: '', phone: '', businessEntityContactPersonDetailNo: 2 },
    { id: 'CON-9', name: 'In-app contact', designation: '', email: 'x@example.com', phone: '+91 90000 00000' },
  ],
}

describe('entity contacts', () => {
  it('stores the primary first, flagged, then the secondary contacts', () => {
    expect(toContactEntries(value)).toEqual([
      { name: 'Manju devi', email: 'manju@example.com', phones: [], primary: true, designation: 'Manager', businessEntityContactPersonDetailNo: 1 },
      { name: 'Miss Vamika Patel', email: '', phones: [], primary: false, designation: 'Human Resource Lead', businessEntityContactPersonDetailNo: 2 },
      { name: 'In-app contact', email: 'x@example.com', phones: ['+91 90000 00000'], primary: false },
    ])
  })

  it('sends server contact numbers primary first, skipping in-app contacts', () => {
    expect(contactDetailNos(value)).toEqual([1, 2])
  })

  it('round-trips through stored contacts', () => {
    const back = fromContactEntries(toContactEntries(value))
    expect(back.primary?.name).toBe('Manju devi')
    expect(back.primary?.businessEntityContactPersonDetailNo).toBe(1)
    expect(back.secondary.map((c) => c.name)).toEqual(['Miss Vamika Patel', 'In-app contact'])
  })

  it('uses the flagged primary even when it is not first, else the first contact', () => {
    const flagged = fromContactEntries([
      { name: 'A', email: '', phones: [], primary: false },
      { name: 'B', email: '', phones: [], primary: true },
    ])
    expect(flagged.primary?.name).toBe('B')
    expect(flagged.secondary.map((c) => c.name)).toEqual(['A'])
    expect(fromContactEntries([{ name: 'Only', email: '', phones: [], primary: false }]).primary?.name).toBe('Only')
    expect(fromContactEntries(undefined)).toEqual({ primary: null, secondary: [] })
  })
})
