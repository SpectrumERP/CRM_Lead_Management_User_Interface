import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { forgetNoteAttachments, loadNoteAttachments, noteAttachmentBody, noteAttachmentSource } from './noteAttachments'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('lead note attachments', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    forgetNoteAttachments(['SN-7'])
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('lists a saved lead note by its number under the Lead form with detailType 1', async () => {
    expect(noteAttachmentSource({ id: 'SN-7' })).toEqual({ transactionId: 7, formNo: 377, detailType: 1 })
    // Unsaved and opportunity notes have nothing to list.
    expect(noteAttachmentSource({ id: 'N-123' })).toBeNull()
    expect(noteAttachmentSource({ id: 'SON-7' })).toBeNull()

    fetchMock.mockImplementation(async () => jsonResponse(200, { success: true, message: '', data: [{ docNo: 9, docName: 'mom.pdf' }] }))
    await expect(loadNoteAttachments({ id: 'SN-7' })).resolves.toEqual([{ id: 9, name: 'mom.pdf', size: undefined, type: undefined }])
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(Object.fromEntries(url.searchParams)).toEqual({ transactionId: '7', formNo: '377', detailType: '1' })

    await loadNoteAttachments({ id: 'SN-7' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    forgetNoteAttachments(['SN-7'])
    await loadNoteAttachments({ id: 'SN-7' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('links the files on the note save, and leaves them out when the form did not touch them', () => {
    expect(noteAttachmentBody({ attachments: [{ id: 9, name: 'mom.pdf' }] })).toEqual({ attachments: [{ docNo: 9 }] })
    expect(noteAttachmentBody({})).toEqual({})
  })
})
