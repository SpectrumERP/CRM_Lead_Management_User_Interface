import { describe, expect, it } from 'vitest'
import type { BusinessEntityRow } from '../../api/businessEntities'
import { toCsv } from '../../utils/csv'
import { formatContactShareText, whatsAppNumber } from '../../utils/businessEntityShare'
import {
  attachmentListRow,
  contactListRow,
  entityListRow,
  exportRows,
  formatFileSize,
  groupByLetter,
  searchRows,
  sourceOf,
} from './listRows'

const entity = (no: number, name: string, extra: Partial<BusinessEntityRow> = {}): BusinessEntityRow => ({
  businessEntityNo: no,
  code: '',
  businessEntityName: name,
  businessEntityTypeName: 'Customer',
  crmTimeZoneNo: null,
  crmTimeZoneName: null,
  vatgstNo: null,
  creditInsuranceLimit: null,
  locationNo: null,
  locationTypeNo: null,
  address: null,
  countryNo: null,
  countryName: 'India',
  stateNo: null,
  stateName: null,
  cityNo: null,
  cityName: 'Mumbai',
  pinCode: null,
  createdBy: null,
  userName: 'edp',
  displayName: null,
  createdDate: null,
  ...extra,
})

describe('business entity list rows', () => {
  it('maps each search to rows that all edit their entity', () => {
    expect(entityListRow(entity(7, ' Tata '))).toMatchObject({ key: 'E7', businessEntityNo: 7, code: 'BE-7', name: 'Tata', createdBy: 'edp' })
    // A type number with no name is looked up; never a made-up type.
    const untyped = entity(8, 'Acme', { businessEntityTypeName: null, crmBusinessEntityTypeNo: 3 } as Partial<BusinessEntityRow>)
    expect(entityListRow(untyped, new Map([[3, 'Dealer']])).typeName).toBe('Dealer')
    expect(entityListRow(untyped).typeName).toBe('')

    const contact = contactListRow({
      businessEntityContactPersonDetailNo: 55, businessEntityNo: 7, businessEntityName: 'Tata', code: 'BE0007',
      contactPersonName: 'Ravi', designation: null, department: null, email: 'r@t.com',
    })
    expect(contact).toMatchObject({ key: 'C55', businessEntityNo: 7, contactNo: 55, status: 'Active', code: 'BE0007' })

    const file = attachmentListRow({
      attachmentNo: 90, businessEntityNo: 7, businessEntityName: 'Tata', code: null, fileName: 'card.jpg', fileSize: 2048, fileType: 'image/jpeg',
    })
    expect(file).toMatchObject({ key: 'A90', businessEntityNo: 7, attachmentNo: 90, code: 'BE-7' })
  })

  it('maps view modes to their search', () => {
    expect(sourceOf('album')).toBe('entity')
    expect(sourceOf('contact-album')).toBe('contact')
    expect(sourceOf('attachment')).toBe('attachment')
  })

  it('ranks exact name, then name, then other fields, keeping server order on ties', () => {
    const rows = [entity(1, 'Mumbai Metals'), entity(2, 'Steel'), entity(3, 'Tata Steel'), entity(4, 'Other', { cityName: 'Pune' })].map((r) => entityListRow(r))
    expect(searchRows(rows, 'steel').map((r) => r.businessEntityNo)).toEqual([2, 3])
    // City matches rank after name matches.
    expect(searchRows(rows, 'mumbai').map((r) => r.businessEntityNo)).toEqual([1, 2, 3])
    expect(searchRows(rows, '  ')).toHaveLength(4)
  })

  it('groups by first letter, with # last', () => {
    const groups = groupByLetter(['beta', '3M', 'alpha', 'Bravo'], (x) => x)
    expect(groups).toEqual([
      { letter: 'A', rows: ['alpha'] },
      { letter: 'B', rows: ['beta', 'Bravo'] },
      { letter: '#', rows: ['3M'] },
    ])
  })

  it('exports the columns of the current view', () => {
    const rows = [entityListRow(entity(7, 'Tata', { creditInsuranceLimit: 0 }))]
    const csv = exportRows('list', rows)
    expect(csv[0][0]).toBe('Sr. No.')
    expect(csv[1]).toEqual([1, 'BE-7', 'Tata', 'Customer', '-', 'Mumbai', '-', 'India', 'N/A', 'No Limit'])
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(null)).toBe('')
  })
})

describe('csv', () => {
  it('quotes separators and neutralises formulas', () => {
    expect(toCsv([['a,b', 'say "hi"', 3], ['=SUM(A1)', null, '-5']])).toBe('"a,b","say ""hi""",3\r\n\'=SUM(A1),,\'-5')
  })
})

describe('share text', () => {
  it('lists only the details given', () => {
    expect(formatContactShareText({ companyName: 'Tata', companyCode: 'BE0007', name: 'Ravi', phone: 'N/A', email: 'r@t.com' })).toBe(
      'Business Entity Contact\nCompany: Tata (BE0007)\nName: Ravi\nEmail: r@t.com',
    )
    expect(whatsAppNumber('+91 98200-00000')).toBe('919820000000')
  })
})

describe('rows of another view', () => {
  it('group and search without crashing when a name is missing', () => {
    const odd = [{ key: 'E1' }, { key: 'E2', entityName: 'Tata' }] as unknown as { key: string; entityName?: string }[]
    expect(groupByLetter(odd, (r) => r.entityName as string).map((g) => g.letter)).toEqual(['T', '#'])
    expect(searchRows(odd as never[], 'ta')).toHaveLength(0)
  })
})
