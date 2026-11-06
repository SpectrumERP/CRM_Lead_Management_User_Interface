/**
 * Pre-upload check of the Business Entity bulk import workbook. It confirms the file has the agreed
 * layout (see public/templates/Business_Entity_Bulk_Import_Template.xlsx) before it is sent:
 *
 *   sheet "Business Entities" · row 1 = the column names below, in this order
 *   row 2 = the template's rules row (skipped when present) · data from the next row
 *
 * Only the format is checked here. Names that must exist in the masters (type, country, state, city,
 * time zone …) are resolved by the server, which reports the rows it rejects.
 */
import { isEmail } from './sanitize'

export const IMPORT_SHEET_NAME = 'Business Entities'
export const IMPORT_MAX_ROWS = 500
export const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024
export const IMPORT_TEMPLATE_FILE = 'Business_Entity_Bulk_Import_Template.xlsx'

type Kind = 'text' | 'number' | 'email'

interface ImportColumn {
  header: string
  required?: boolean
  max?: number
  kind?: Kind
  min?: number
  upper?: number
}

export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  { header: 'Import Ref', required: true, max: 30 },
  { header: 'Business Entity Name', required: true, max: 100 },
  { header: 'Business Entity Type', required: true },
  { header: 'Contact Source' },
  { header: 'Website', max: 2000 },
  { header: 'Tax Document Type' },
  { header: 'Tax Document No', max: 30 },
  { header: 'Credit Insurance Limit', kind: 'number', min: 0 },
  { header: 'Credit Insurance Company Name', max: 100 },
  { header: 'Primary Contact Name', required: true, max: 100 },
  { header: 'Primary Contact Designation', max: 100 },
  { header: 'Primary Contact Department', max: 100 },
  { header: 'Primary Contact Phone', required: true, max: 20 },
  { header: 'Primary Contact Email', kind: 'email', max: 100 },
  { header: 'Primary Location Type', required: true },
  { header: 'Primary Address', required: true },
  { header: 'Primary Country' },
  { header: 'Primary State' },
  { header: 'Primary City' },
  { header: 'Primary Pin Code', max: 10 },
  { header: 'Primary Map URL', max: 2000 },
  { header: 'Primary Latitude', kind: 'number', min: -90, upper: 90, max: 15 },
  { header: 'Primary Longitude', kind: 'number', min: -180, upper: 180, max: 15 },
  { header: 'Primary Time Zone' },
]

export interface ImportIssue {
  /** 1-based sheet row; absent for file / sheet level problems. */
  row?: number
  column?: string
  message: string
}

export interface ImportCheck {
  issues: ImportIssue[]
  /** Data rows found (blank rows and the rules row excluded). */
  rowCount: number
  /** Issues beyond the cap are counted here, not listed. */
  hiddenIssues: number
}

export interface SheetLike {
  sheet: string
  data: readonly (readonly unknown[])[]
}

const MAX_LISTED_ISSUES = 200
const RULES_ROW = /^(required|optional|conditional)\b/i

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function isBlankRow(row: readonly unknown[]) {
  return row.every((cell) => cellText(cell) === '')
}

function cap(issues: ImportIssue[], rowCount: number): ImportCheck {
  return {
    issues: issues.slice(0, MAX_LISTED_ISSUES),
    rowCount,
    hiddenIssues: Math.max(0, issues.length - MAX_LISTED_ISSUES),
  }
}

function headerIssues(header: readonly unknown[]): ImportIssue[] {
  const found = header.map(cellText)
  while (found.length && found[found.length - 1] === '') found.pop()
  const expected = IMPORT_COLUMNS.map((c) => c.header)
  const lower = found.map((h) => h.toLowerCase())

  const issues: ImportIssue[] = []
  const missing = expected.filter((h) => !lower.includes(h.toLowerCase()))
  const extra = found.filter((h) => h && !expected.some((e) => e.toLowerCase() === h.toLowerCase()))
  if (missing.length) issues.push({ row: 1, message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` })
  if (extra.length) issues.push({ row: 1, message: `Unexpected column${extra.length > 1 ? 's' : ''}: ${extra.join(', ')}` })
  if (!missing.length && !extra.length) {
    expected.forEach((name, i) => {
      if (found[i]?.toLowerCase() !== name.toLowerCase()) {
        issues.push({ row: 1, column: name, message: `Column ${i + 1} must be "${name}" (found "${found[i] ?? ''}"). Keep the template's column order.` })
      }
    })
  }
  return issues
}

function cellIssues(column: ImportColumn, raw: unknown, row: number): ImportIssue[] {
  const text = cellText(raw)
  const at = (message: string): ImportIssue[] => [{ row, column: column.header, message }]
  if (!text) return column.required ? at('is required') : []
  if (column.max && text.length > column.max) return at(`must be ${column.max} characters or fewer`)
  if (column.kind === 'number') {
    const value = typeof raw === 'number' ? raw : Number(text.replace(/,/g, ''))
    if (!Number.isFinite(value)) return at('must be a number')
    if (column.min !== undefined && value < column.min) return at(column.upper === undefined ? `must be ${column.min} or more` : `must be between ${column.min} and ${column.upper}`)
    if (column.upper !== undefined && value > column.upper) return at(`must be between ${column.min} and ${column.upper}`)
  }
  if (column.kind === 'email' && !isEmail(text)) return at('is not a valid email address')
  return []
}

/** Check the sheets read from the uploaded workbook. An empty `issues` list means it can be uploaded. */
export function checkImportSheets(sheets: readonly SheetLike[]): ImportCheck {
  const sheet = sheets.find((s) => s.sheet.trim().toLowerCase() === IMPORT_SHEET_NAME.toLowerCase())
  if (!sheet) {
    const names = sheets.map((s) => `"${s.sheet}"`).join(', ')
    return cap([{ message: `Sheet "${IMPORT_SHEET_NAME}" not found${names ? ` (this file has ${names})` : ''}. Use the template.` }], 0)
  }

  const [header = [], ...rest] = sheet.data
  const issues = headerIssues(header)
  if (issues.length) return cap(issues, 0)

  const index = new Map(IMPORT_COLUMNS.map((c, i) => [c.header, i]))
  const refRows = new Map<string, number>()
  let rowCount = 0

  rest.forEach((cells, offset) => {
    const row = offset + 2
    if (isBlankRow(cells)) return
    if (offset === 0 && RULES_ROW.test(cellText(cells[0]))) return
    rowCount += 1
    if (rowCount > IMPORT_MAX_ROWS) return

    for (const column of IMPORT_COLUMNS) issues.push(...cellIssues(column, cells[index.get(column.header)!], row))

    const taxType = cellText(cells[index.get('Tax Document Type')!])
    if (taxType && !cellText(cells[index.get('Tax Document No')!])) {
      issues.push({ row, column: 'Tax Document No', message: 'is required when Tax Document Type is filled' })
    }

    const ref = cellText(cells[0]).toLowerCase()
    if (ref) {
      const first = refRows.get(ref)
      if (first) issues.push({ row, column: 'Import Ref', message: `"${cellText(cells[0])}" is already used in row ${first}` })
      else refRows.set(ref, row)
    }
  })

  if (rowCount === 0) issues.push({ message: 'The sheet has no data rows. Fill the template from the row below the rules row.' })
  if (rowCount > IMPORT_MAX_ROWS) issues.push({ message: `The sheet has ${rowCount} rows; at most ${IMPORT_MAX_ROWS} can be imported at once. Split the file.` })
  return cap(issues, rowCount)
}

// ─── Result workbook ──────────────────────────────────────────────────────────

export interface ImportFailure {
  /** 1-based row in the uploaded sheet. */
  row: number
  importRef: string
  name: string
  reason: string
}

export interface ImportSummary {
  total: number
  imported: number
  failed: number
  failures: ImportFailure[]
}

/**
 * Count the outcome per row in the result workbook the server returns: the uploaded sheet with one
 * extra column after "Primary Time Zone" holding "Imported successfully (Business Entity No: n)." or
 * the reason the row was rejected. Returns null when the file has no such column.
 */
export function summarizeImportResult(sheets: readonly SheetLike[]): ImportSummary | null {
  const sheet = sheets.find((s) => s.sheet.trim().toLowerCase() === IMPORT_SHEET_NAME.toLowerCase()) ?? sheets[0]
  if (!sheet || sheet.data.length < 2) return null
  const first = IMPORT_COLUMNS.length
  const [header, ...rest] = sheet.data
  if (header.length <= first && !rest.some((r) => r.length > first)) return null

  const failures: ImportFailure[] = []
  let imported = 0
  let total = 0
  rest.forEach((cells, offset) => {
    const status = cells.slice(first).map(cellText).find(Boolean) ?? ''
    if (!status || (offset === 0 && RULES_ROW.test(cellText(cells[0])))) return
    total += 1
    if (/^imported successfully/i.test(status)) imported += 1
    else failures.push({ row: offset + 2, importRef: cellText(cells[0]), name: cellText(cells[1]), reason: status })
  })
  return total ? { total, imported, failed: failures.length, failures } : null
}
