/**
 * Business Entities list: the three server searches (entity-, contact-, attachment-wise) mapped to
 * rows for the five views, plus local search ranking, A–Z grouping and the CSV export columns.
 */
import {
  businessEntityCode,
  type BusinessEntityAttachmentRow,
  type BusinessEntityContactRow,
  type BusinessEntityRow,
} from '../../api/businessEntities'

export type ListViewMode = 'list' | 'album' | 'contact-list' | 'contact-album' | 'attachment'
export type ListSource = 'entity' | 'contact' | 'attachment'

export function sourceOf(mode: ListViewMode): ListSource {
  if (mode === 'contact-list' || mode === 'contact-album') return 'contact'
  if (mode === 'attachment') return 'attachment'
  return 'entity'
}

export interface EntityListRow {
  /** Unique within the view. */
  key: string
  /** Every row edits its entity — also contact and attachment rows. */
  businessEntityNo: number
  code: string
  name: string
  typeName: string
  address: string
  city: string
  state: string
  country: string
  pinCode: string
  vatGst: string
  creditLimit: number | null
  createdBy: string
  createdDate: string | null
}

export interface ContactListRow {
  key: string
  businessEntityNo: number
  code: string
  entityName: string
  typeName: string
  contactNo: number
  name: string
  designation: string
  department: string
  phone: string
  email: string
  status: string
  city: string
  state: string
  country: string
}

export interface AttachmentListRow {
  key: string
  businessEntityNo: number
  code: string
  entityName: string
  typeName: string
  attachmentNo: number
  fileName: string
  fileSize: number | null
  fileType: string
  status: string
}

export type AnyListRow = EntityListRow | ContactListRow | AttachmentListRow

const s = (value: string | null | undefined) => (value ?? '').trim()

export function entityListRow(row: BusinessEntityRow, typeNameByNo?: ReadonlyMap<number, string>): EntityListRow {
  const typeNo = (row as { crmBusinessEntityTypeNo?: number }).crmBusinessEntityTypeNo
  return {
    key: `E${row.businessEntityNo}`,
    businessEntityNo: row.businessEntityNo,
    code: businessEntityCode(row.businessEntityNo, row.code),
    name: s(row.businessEntityName),
    // The search sends the type name; older rows may only carry its number.
    typeName: s(row.businessEntityTypeName) || (typeNo ? (typeNameByNo?.get(typeNo) ?? '') : ''),
    address: s(row.address),
    city: s(row.cityName),
    state: s(row.stateName),
    country: s(row.countryName),
    pinCode: s(row.pinCode),
    vatGst: s(row.vatgstNo),
    creditLimit: typeof row.creditInsuranceLimit === 'number' ? row.creditInsuranceLimit : null,
    createdBy: s(row.displayName) || s(row.userName),
    createdDate: row.createdDate,
  }
}

export function contactListRow(row: BusinessEntityContactRow): ContactListRow {
  return {
    key: `C${row.businessEntityContactPersonDetailNo}`,
    businessEntityNo: row.businessEntityNo,
    code: businessEntityCode(row.businessEntityNo, row.code),
    entityName: s(row.businessEntityName),
    typeName: s(row.businessEntityTypeName),
    contactNo: row.businessEntityContactPersonDetailNo,
    name: s(row.contactPersonName),
    designation: s(row.designation),
    department: s(row.department),
    phone: s(row.phoneNo),
    email: s(row.email),
    status: s(row.status) || 'Active',
    city: s(row.cityName),
    state: s(row.stateName),
    country: s(row.countryName),
  }
}

export function attachmentListRow(row: BusinessEntityAttachmentRow): AttachmentListRow {
  return {
    key: `A${row.attachmentNo}`,
    businessEntityNo: row.businessEntityNo,
    code: businessEntityCode(row.businessEntityNo, row.code),
    entityName: s(row.businessEntityName),
    typeName: s(row.businessEntityTypeName),
    attachmentNo: row.attachmentNo,
    fileName: s(row.fileName) || 'attachment',
    fileSize: typeof row.fileSize === 'number' ? row.fileSize : null,
    fileType: s(row.fileType),
    status: s(row.status) || 'Active',
  }
}

/** The entity name a row belongs to (the name in entity rows). */
export function rowEntityName(row: AnyListRow): string {
  return 'entityName' in row ? row.entityName : row.name
}

/** Text a row is searched by. */
function searchFields(row: AnyListRow): string[] {
  if ('contactNo' in row) {
    return [row.name, row.entityName, row.code, row.designation, row.department, row.phone, row.email, row.city, row.state, row.country]
  }
  if ('attachmentNo' in row) return [row.fileName, row.fileType, row.entityName, row.code]
  return [row.name, row.code, row.typeName, row.address, row.city, row.state, row.country, row.vatGst]
}

/**
 * Rows matching `query`, best first: exact name, then name containing it, then any other field
 * (contact rows rank by the contact's name). Ties keep the server order.
 */
export function searchRows<T extends AnyListRow>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...rows]
  const ranked: { row: T; rank: number; index: number }[] = []
  rows.forEach((row, index) => {
    const fields = searchFields(row).map((f) => (f ?? '').toLowerCase())
    if (!fields.some((f) => f.includes(q))) return
    const name = fields[0]
    ranked.push({ row, rank: name === q ? 1 : name.includes(q) ? 2 : 3, index })
  })
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map((x) => x.row)
}

/** First letter for the A–Z groups: A–Z, else `#`. */
export function letterOf(name: string | null | undefined): string {
  const first = (name ?? '').trim().charAt(0).toUpperCase()
  return /^[A-Z]$/.test(first) ? first : '#'
}

/** Rows grouped by first letter of `nameOf`, letters A–Z then `#`, names A–Z within a group. */
export function groupByLetter<T>(rows: readonly T[], nameOf: (row: T) => string): { letter: string; rows: T[] }[] {
  const groups = new Map<string, T[]>()
  // Names are read defensively: a row of another view's shape must not crash the page.
  const name = (row: T) => nameOf(row) ?? ''
  for (const row of [...rows].sort((a, b) => name(a).localeCompare(name(b)))) {
    const letter = letterOf(name(row))
    groups.set(letter, [...(groups.get(letter) ?? []), row])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, items]) => ({ letter, rows: items }))
}

/** "12.5 KB" / "1.2 MB" — '' when unknown. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Credit insurance limit as Task Management shows it (`$12,500`), or "No Limit". */
export function formatCreditLimit(limit: number | null): string {
  return limit && limit > 0 ? `$${limit.toLocaleString()}` : 'No Limit'
}

/** "No. 350, Hebbal…, Mysuru, Karnataka, India" — the list's Primary Address column. */
export function fullAddress(row: Pick<EntityListRow, 'address' | 'city' | 'state' | 'country'>): string {
  return [row.address, row.city, row.state, row.country].filter(Boolean).join(', ')
}

/** The export columns of each view (header row first), as Task Management exports them. */
export function exportRows(mode: ListViewMode, rows: readonly AnyListRow[]): (string | number)[][] {
  const source = sourceOf(mode)
  const d = (v: string) => v || '-'
  if (source === 'contact') {
    return [
      ['Sr. No.', 'Contact Person Name', 'Business Entity', 'Email', 'Phone', 'Department', 'Designation', 'Status'],
      ...(rows as ContactListRow[]).map((r, i) => [i + 1, d(r.name), d(r.entityName), d(r.email), d(r.phone), d(r.department), d(r.designation), r.status || 'Active']),
    ]
  }
  if (source === 'attachment') {
    return [
      ['Sr. No.', 'Name', 'Business Entity', 'Code', 'Size', 'Type', 'Status'],
      ...(rows as AttachmentListRow[]).map((r, i) => [
        i + 1, d(r.fileName), d(r.entityName), d(r.code), r.fileSize ? `${(r.fileSize / 1024).toFixed(2)} KB` : '-', d(r.fileType), r.status || 'Active',
      ]),
    ]
  }
  return [
    ['Sr. No.', 'Code', 'Business Entity Name', 'Type', 'Primary Address', 'City', 'State', 'Country', 'VAT/GST No.', 'Credit Limit'],
    ...(rows as EntityListRow[]).map((r, i) => [
      i + 1, d(r.code), d(r.name), d(r.typeName), d(r.address), d(r.city), d(r.state), d(r.country), r.vatGst || 'N/A',
      r.creditLimit && r.creditLimit > 0 ? r.creditLimit : 'No Limit',
    ]),
  ]
}
