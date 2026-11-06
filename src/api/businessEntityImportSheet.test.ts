import { describe, expect, it } from 'vitest'
import { checkImportSheets, summarizeImportResult, IMPORT_COLUMNS, IMPORT_SHEET_NAME, type SheetLike } from './businessEntityImportSheet'

const headers = IMPORT_COLUMNS.map((c) => c.header)
const rules = headers.map((_, i) => (i === 0 ? 'Required\nUnique key per entity' : 'Optional'))

function rowOf(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    'Import Ref': 'IMP-001',
    'Business Entity Name': 'Tata Steel Ltd',
    'Business Entity Type': 'Customer',
    'Tax Document Type': 'GST',
    'Tax Document No': '27AAACT2803M1Z5',
    'Credit Insurance Limit': 5000000,
    'Primary Contact Name': 'Rajesh Kumar',
    'Primary Contact Phone': '+91 9820012345',
    'Primary Contact Email': 'rajesh@tatasteel.com',
    'Primary Location Type': 'Head Office',
    'Primary Address': 'Bombay House',
    'Primary Latitude': 18.9322,
    'Primary Longitude': 72.8347,
    ...overrides,
  }
  return headers.map((h) => base[h] ?? null)
}

const sheet = (...rows: unknown[][]): SheetLike[] => [{ sheet: IMPORT_SHEET_NAME, data: [headers, ...rows] }]

describe('checkImportSheets', () => {
  it('accepts the template layout, skipping the rules row and blank rows', () => {
    const check = checkImportSheets(sheet(rules, rowOf(), headers.map(() => null), rowOf({ 'Import Ref': 'IMP-002' })))
    expect(check.issues).toEqual([])
    expect(check.rowCount).toBe(2)
  })

  it('rejects a workbook without the Business Entities sheet', () => {
    const check = checkImportSheets([{ sheet: 'Sheet1', data: [headers] }])
    expect(check.issues[0].message).toMatch(/not found/)
  })

  it('reports missing, unexpected and misordered columns', () => {
    const missing = checkImportSheets([{ sheet: IMPORT_SHEET_NAME, data: [headers.slice(1), rowOf()] }])
    expect(missing.issues[0].message).toMatch(/Missing column: Import Ref/)
    const swapped = [...headers]
    ;[swapped[1], swapped[2]] = [swapped[2], swapped[1]]
    const order = checkImportSheets([{ sheet: IMPORT_SHEET_NAME, data: [swapped, rowOf()] }])
    expect(order.issues.some((i) => /order/.test(i.message))).toBe(true)
    const extra = checkImportSheets([{ sheet: IMPORT_SHEET_NAME, data: [[...headers, 'Notes'], rowOf()] }])
    expect(extra.issues[0].message).toMatch(/Unexpected column: Notes/)
  })

  it('flags required, length, number and email problems with row and column', () => {
    const check = checkImportSheets(sheet(rowOf({
      'Business Entity Name': '',
      'Primary Contact Phone': '1'.repeat(21),
      'Credit Insurance Limit': 'lots',
      'Primary Contact Email': 'nope',
      'Primary Latitude': 120,
    })))
    const found = check.issues.map((i) => `${i.row}:${i.column}`)
    expect(found).toEqual(expect.arrayContaining([
      '2:Business Entity Name', '2:Primary Contact Phone', '2:Credit Insurance Limit', '2:Primary Contact Email', '2:Primary Latitude',
    ]))
  })

  it('requires the tax number when a tax type is given, and unique import refs', () => {
    const check = checkImportSheets(sheet(rowOf({ 'Tax Document No': '' }), rowOf()))
    expect(check.issues.map((i) => i.column)).toEqual(expect.arrayContaining(['Tax Document No', 'Import Ref']))
  })

  it('rejects a sheet with no data and one over the row limit', () => {
    expect(checkImportSheets(sheet(rules)).issues[0].message).toMatch(/no data rows/)
    const many = Array.from({ length: 501 }, (_, i) => rowOf({ 'Import Ref': `R${i}` }))
    expect(checkImportSheets(sheet(...many)).issues.some((i) => /at most 500/.test(i.message))).toBe(true)
  })
})

describe('summarizeImportResult', () => {
  const resultSheet = (...statuses: (string | null)[]): SheetLike[] => [{
    sheet: IMPORT_SHEET_NAME,
    data: [
      [...headers, 'Import Result'],
      [...rules, 'Optional'],
      ...statuses.map((s, i) => [...rowOf({ 'Import Ref': `IMP-${i}`, 'Business Entity Name': `Entity ${i}` }), s]),
    ],
  }]

  it('counts imported and failed rows and lists the failures with their sheet row', () => {
    const summary = summarizeImportResult(resultSheet(
      'Imported successfully (Business Entity No: 29).',
      "Primary City 'Gurugram' was not found in the master",
      'Imported successfully (Business Entity No: 30).',
      "Primary State 'Gujarat' was not found in the master",
    ))
    expect(summary).toMatchObject({ total: 4, imported: 2, failed: 2 })
    expect(summary?.failures[0]).toEqual({ row: 4, importRef: 'IMP-1', name: 'Entity 1', reason: "Primary City 'Gurugram' was not found in the master" })
    expect(summary?.failures[1].row).toBe(6)
  })

  it('returns null for a file without a result column', () => {
    expect(summarizeImportResult(sheet(rowOf()))).toBeNull()
  })
})
