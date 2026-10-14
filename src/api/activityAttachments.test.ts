import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activityAttachmentBody, activityAttachmentSource, forgetActivityAttachments, loadActivityAttachments, rememberActivityAttachments } from './activityAttachments'
import { __resetAuthStoreForTests } from './authStore'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const LIST = { success: true, message: '', data: [{ docNo: 5, docName: 'minutes.pdf', docType: 'pdf', docSize: 10 }] }

describe('activity attachments from the document store', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    forgetActivityAttachments(['SA-11', 'SOA-21'])
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('links the files on the activity save, and leaves them out when the form did not touch them', () => {
    expect(activityAttachmentBody({ attachments: [{ id: 91, name: 'a.pdf' }, { id: 0, name: 'b.pdf' }] })).toEqual({ attachments: [{ docNo: 91 }] })
    expect(activityAttachmentBody({ attachments: [] })).toEqual({ attachments: [] })
    expect(activityAttachmentBody({})).toEqual({})
  })

  it('queries by the activity number, its parent form and detailType (lead 2, opportunity 3)', () => {
    expect(activityAttachmentSource({ id: 'SA-11' })).toEqual({ transactionId: 11, formNo: 377, detailType: 2 })
    expect(activityAttachmentSource({ id: 'SOA-21' })).toEqual({ transactionId: 21, formNo: 380, detailType: 3 })
    expect(activityAttachmentSource({ id: 'SOA-21', serverDetailNo: 22 })?.transactionId).toBe(22)
    expect(activityAttachmentSource({ id: 'act-123' })).toBeNull()
  })

  it('lists once per activity until it is saved again', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, LIST))
    await expect(loadActivityAttachments({ id: 'SOA-21' })).resolves.toEqual([{ id: 5, name: 'minutes.pdf', size: 10, type: 'pdf' }])
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/document-attachments')
    expect(Object.fromEntries(url.searchParams)).toEqual({ transactionId: '21', formNo: '380', detailType: '3' })

    await loadActivityAttachments({ id: 'SOA-21' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    rememberActivityAttachments('SOA-21', undefined)
    await loadActivityAttachments({ id: 'SOA-21' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not keep a failed list, and skips unsaved activities', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: false, message: 'Down', data: null }))
    await expect(loadActivityAttachments({ id: 'SA-11' })).rejects.toMatchObject({ message: 'Down' })
    fetchMock.mockResolvedValueOnce(jsonResponse(200, LIST))
    await expect(loadActivityAttachments({ id: 'SA-11' })).resolves.toHaveLength(1)

    await expect(loadActivityAttachments({ id: 'act-1' })).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
