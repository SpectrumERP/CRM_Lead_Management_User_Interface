import { describe, expect, it } from 'vitest'
import { contactEntriesFromRows } from './leadSync'

describe('lead / opportunity contact rows', () => {
  it('keeps the designation, email and phone the rows carry, primary first', () => {
    const entries = contactEntriesFromRows([
      { isPrimary: false, businessEntityContactPerson: { businessEntityContactPersonDetailNo: 6, contactPersonName: 'Kumar Vijay' } },
      {
        isPrimary: true,
        businessEntityContactPerson: {
          businessEntityContactPersonDetailNo: 5,
          contactPersonName: 'Sunil Lehre',
          designation: 'Manager',
          email: 'sunil.lahre@mahindra.com',
          phoneNo: '89898989898',
        },
      },
    ])
    expect(entries[0]).toEqual({
      name: 'Sunil Lehre',
      email: 'sunil.lahre@mahindra.com',
      phones: ['89898989898'],
      primary: true,
      designation: 'Manager',
      businessEntityContactPersonDetailNo: 5,
    })
    expect(entries[1]).toEqual({ name: 'Kumar Vijay', email: '', phones: [], primary: false, businessEntityContactPersonDetailNo: 6 })
  })

  it('falls back to what was already known when a row has no details', () => {
    const [entry] = contactEntriesFromRows(
      [{ isPrimary: true, businessEntityContactPerson: { businessEntityContactPersonDetailNo: 5, contactPersonName: 'Sunil Lehre' } }],
      [{ name: 'Sunil Lehre', email: 'old@x.com', phones: ['111'], primary: true, designation: 'CFO', businessEntityContactPersonDetailNo: 5 }],
    )
    expect(entry).toMatchObject({ email: 'old@x.com', phones: ['111'], designation: 'CFO' })
  })
})
