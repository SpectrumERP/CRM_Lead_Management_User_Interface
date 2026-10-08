import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ATTACHMENT_FORM_NO,
  attachmentLinks,
  deleteAttachment,
  fetchAttachmentBlob,
  listAttachments,
  renameAttachment,
  uploadAttachment,
} from './attachments'
import { __resetAuthStoreForTests } from './authStore'
import { validateUploadFile } from './uploadFiles'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function file(name: string, size = 10, type = '') {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateUploadFile', () => {
  it('accepts the Task Management file types up to 10 MB', () => {
    expect(validateUploadFile(file('quote.pdf', 10, 'application/pdf'))).toEqual({ ok: true })
    expect(validateUploadFile(file('sheet.XLSX'))).toEqual({ ok: true })
  })

  it('rejects other types, bad MIME types and big files', () => {
    expect(validateUploadFile(file('deck.pptx'))).toMatchObject({ ok: false, reason: expect.stringContaining('Unsupported file type') })
    expect(validateUploadFile(file('a.pdf', 10, 'application/x-msdownload'))).toMatchObject({ ok: false, reason: expect.stringContaining('content type') })
    expect(validateUploadFile(file('big.pdf', 10 * 1024 * 1024 + 1))).toMatchObject({ ok: false, reason: 'File size exceeds the 10MB limit.' })
  })
})

describe('attachment API', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('uploads in three steps: entry, multipart file, status', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { success: true, message: '', data: [{ id: 91, name: 'quote.pdf' }] }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, message: '', data: true }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, message: '', data: [{ docNo: 91, statusNo: 1 }] }))

    const picked = file('quote.pdf', 20, 'application/pdf')
    await expect(uploadAttachment(picked, 1, 1600)).resolves.toMatchObject({ id: 91, name: 'quote.pdf', size: 20 })

    const [entryUrl, entry] = fetchMock.mock.calls[0]!
    expect(new URL(String(entryUrl)).pathname).toBe('/api/document-attachments')
    expect(entry.method).toBe('POST')
    expect(JSON.parse(entry.body)).toEqual([{ fileName: 'quote.pdf', companyNo: 1, formNo: 1600 }])

    const [, upload] = fetchMock.mock.calls[1]!
    expect(upload.method).toBe('PUT')
    expect(upload.body).toBeInstanceOf(FormData)
    // Multipart: the browser sets the boundary, so no JSON content type.
    expect(upload.headers['Content-Type']).toBeUndefined()
    const form = upload.body as FormData
    expect(form.get('id')).toBe('91')
    expect(form.get('Attachment[0].id')).toBe('91')
    expect((form.get('Attachment[0].file') as File).name).toBe('quote.pdf')

    const statusUrl = new URL(String(fetchMock.mock.calls[2]![0]))
    expect(statusUrl.pathname).toBe('/api/document-attachments/status')
    expect(statusUrl.searchParams.get('DocNo')).toBe('91')
  })

  it('stops when the entry cannot be created', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: false, message: 'Company not found', data: null }))
    await expect(uploadAttachment(file('a.pdf'), 1, 1600)).rejects.toMatchObject({ message: 'Company not found' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lists, renames and deletes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      success: true, message: '', data: [{ docNo: 5, docName: 'nda.pdf', docType: 'pdf', docSize: 2048, status: { statusNo: 1 } }],
    }))
    await expect(listAttachments(42, 1600)).resolves.toEqual([{ id: 5, name: 'nda.pdf', size: 2048, type: 'pdf' }])
    const listUrl = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(listUrl.searchParams.get('transactionId')).toBe('42')
    expect(listUrl.searchParams.get('formNo')).toBe('1600')

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, message: '', data: true }))
    await renameAttachment(5, 'nda-signed.pdf', 1600)
    const [renameUrl, rename] = fetchMock.mock.calls[1]!
    expect(new URL(String(renameUrl)).pathname).toBe('/api/document-attachments/rename')
    expect(rename.method).toBe('PUT')
    expect(JSON.parse(rename.body)).toEqual({ docNo: 5, docName: 'nda-signed.pdf', formNo: 1600 })

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, message: '', data: true }))
    await deleteAttachment(5)
    const deleteUrl = new URL(String(fetchMock.mock.calls[2]![0]))
    expect(deleteUrl.pathname).toBe('/api/document-attachments/delete')
    expect(deleteUrl.searchParams.get('docNo')).toBe('5')
    expect(fetchMock.mock.calls[2]![1].method).toBe('DELETE')
  })

  it('downloads as a blob typed from the file name', async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    const blob = await fetchAttachmentBlob(5, 'photo.PNG')
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(3)
    expect(new URL(String(fetchMock.mock.calls[0]![0])).pathname).toBe('/api/document-attachments/5/download')
  })

  it('files lead attachments under form 377, opportunity under 380 and business entity under 1550', () => {
    expect(ATTACHMENT_FORM_NO).toEqual({ lead: 377, opportunity: 380, businessEntity: 1550 })
  })

  it('builds the link rows for a parent save', () => {
    expect(attachmentLinks([{ id: 5, name: 'a' }, { id: 0, name: 'b' }])).toEqual([{ docNo: 5 }])
  })
})
