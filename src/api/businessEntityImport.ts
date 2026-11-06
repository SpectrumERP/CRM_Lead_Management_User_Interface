/**
 * Business Entity bulk import (Spectrum).
 *
 *   POST /api/master/business-entities/bulk-import   multipart: File (.xlsx), CompanyNo
 *
 * 200 answers with the result workbook itself (or the JSON envelope); 400 with the envelope
 * `{ success, message, errors[], data: { content (base64 workbook), fileName, contentType,
 * totalRows, importedCount, failedCount } }`. Both come back as one `BulkImportResult`.
 */
import { getAuthToken } from './authStore'
import { spectrumOrigin } from './config'
import { spectrumEndpoints } from './endpoints'
import { asTransportError, errorFromResponse, isApiError, serverErrorMessage, unauthenticated } from './errors'
import type { ImportFailure } from './businessEntityImportSheet'
import { assertCompanyNo } from './fillValues'
import { notifySessionExpired } from './sessionExpiry'

export interface BulkImportResult {
  /** The server accepted the whole file. */
  success: boolean
  message: string
  totalRows: number | null
  importedCount: number | null
  failedCount: number | null
  /** Server messages for the rows or the file it rejected. */
  errors: string[]
  /** Result workbook (per-row outcome / errors) to download. */
  file: { blob: Blob; fileName: string } | null
  /** The rows that were rejected and why, read from the result workbook. */
  failures: ImportFailure[]
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const RESULT_FILE_NAME = 'Business_Entity_Import_Result.xlsx'

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function blobFromBase64(content: string, type: string): Blob | null {
  try {
    const binary = atob(content)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type })
  } catch {
    return null
  }
}

function errorMessages(envelope: Record<string, unknown>): string[] {
  const list = Array.isArray(envelope.errors) ? envelope.errors : []
  const messages = list.map((item) => {
    if (typeof item === 'string') return item.trim()
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return text(row.errorMessage) || text(row.message)
  })
  return [...new Set(messages.filter(Boolean))]
}

function fromEnvelope(envelope: Record<string, unknown>, ok: boolean): BulkImportResult {
  const data = (envelope.data && typeof envelope.data === 'object' ? envelope.data : {}) as Record<string, unknown>
  const content = text(data.content)
  const blob = content ? blobFromBase64(content, text(data.contentType) || XLSX_TYPE) : null
  const failedCount = count(data.failedCount)
  const errors = errorMessages(envelope)
  const message = text(envelope.message) || serverErrorMessage(envelope) || ''
  return {
    success: ok && envelope.success !== false && !failedCount,
    message,
    totalRows: count(data.totalRows),
    importedCount: count(data.importedCount),
    failedCount,
    errors: errors.length ? errors : !ok && message ? [message] : [],
    file: blob ? { blob, fileName: text(data.fileName) || RESULT_FILE_NAME } : null,
    failures: [],
  }
}

function fileNameFrom(disposition: string | null): string {
  const match = disposition ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition) : null
  try {
    return match ? decodeURIComponent(match[1]) : RESULT_FILE_NAME
  } catch {
    return RESULT_FILE_NAME
  }
}

/** Fill the counts and failed rows from the result workbook when the server did not send them. */
async function withSummary(result: BulkImportResult): Promise<BulkImportResult> {
  if (!result.file) return result
  try {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const { summarizeImportResult } = await import('./businessEntityImportSheet')
    const summary = summarizeImportResult(await readXlsxFile(result.file.blob))
    if (!summary) return result
    return {
      ...result,
      success: result.success && summary.failed === 0,
      totalRows: result.totalRows ?? summary.total,
      importedCount: result.importedCount ?? summary.imported,
      failedCount: result.failedCount ?? summary.failed,
      failures: summary.failures,
    }
  } catch {
    return result
  }
}

/** Upload the workbook. Resolves with the outcome; rejects only when the call itself failed (network, session, 5xx). */
export async function bulkImportBusinessEntities(file: File, companyNo: number, signal?: AbortSignal): Promise<BulkImportResult> {
  assertCompanyNo(companyNo)
  const body = new FormData()
  body.append('File', file, file.name)
  body.append('CompanyNo', String(companyNo))

  const token = await getAuthToken()
  let response: Response
  try {
    response = await fetch(`${spectrumOrigin()}${spectrumEndpoints.businessEntities.bulkImport}`, {
      method: 'POST',
      headers: { Accept: `${XLSX_TYPE}, application/json`, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body,
      signal,
    })
  } catch (error) {
    if (isApiError(error)) throw error
    asTransportError(error)
  }

  if (response.status === 401) {
    notifySessionExpired('rejected')
    unauthenticated()
  }

  const type = response.headers.get('content-type') ?? ''
  if (response.ok && type.includes('spreadsheetml')) {
    return withSummary({
      success: true,
      message: '',
      totalRows: null,
      importedCount: null,
      failedCount: null,
      errors: [],
      file: { blob: await response.blob(), fileName: fileNameFrom(response.headers.get('content-disposition')) },
      failures: [],
    })
  }

  const raw = await response.text()
  let parsed: unknown = raw
  try {
    parsed = raw ? JSON.parse(raw) : undefined
  } catch {
    // not JSON: handled below
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    // 400 carries the per-row outcome; anything else that failed is a call failure.
    if (response.ok || response.status === 400) return withSummary(fromEnvelope(parsed as Record<string, unknown>, response.ok))
  }
  if (!response.ok) errorFromResponse(response.status, { message: serverErrorMessage(parsed) })
  return { success: true, message: '', totalRows: null, importedCount: null, failedCount: null, errors: [], file: null, failures: [] }
}
