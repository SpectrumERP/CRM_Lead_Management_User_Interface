import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { bulkImportBusinessEntities } from './businessEntityImport'

const file = new File(['x'], 'entities.xlsx')

describe('bulkImportBusinessEntities', () => {
  beforeEach(() => __resetAuthStoreForTests())
  afterEach(() => vi.unstubAllGlobals())

  it('posts File and CompanyNo as multipart', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { totalRows: 2, importedCount: 2, failedCount: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await bulkImportBusinessEntities(file, 7)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/master\/business-entities\/bulk-import$/)
    expect((init.body as FormData).get('CompanyNo')).toBe('7')
    expect((init.body as FormData).get('File')).toBeInstanceOf(File)
    expect(result).toMatchObject({ success: true, totalRows: 2, importedCount: 2, failedCount: 0 })
  })

  it('returns a 400 envelope as a result with counts, messages and the result file', async () => {
    const body = {
      success: false,
      message: 'Some rows failed',
      errors: [{ errorMessage: 'Row 4: type not found' }],
      data: { content: btoa('abc'), fileName: 'result.xlsx', totalRows: 3, importedCount: 2, failedCount: 1 },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 400, headers: { 'Content-Type': 'application/json' } })))
    const result = await bulkImportBusinessEntities(file, 7)
    expect(result).toMatchObject({ success: false, importedCount: 2, failedCount: 1, errors: ['Row 4: type not found'] })
    expect(result.file?.fileName).toBe('result.xlsx')
  })

  it('treats a workbook answer as success and keeps the file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('xlsx-bytes', { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="out.xlsx"' } })))
    const result = await bulkImportBusinessEntities(file, 7)
    expect(result.success).toBe(true)
    expect(result.file?.fileName).toBe('out.xlsx')
  })

  it('rejects when the call itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
    await expect(bulkImportBusinessEntities(file, 7)).rejects.toThrow()
  })
})
