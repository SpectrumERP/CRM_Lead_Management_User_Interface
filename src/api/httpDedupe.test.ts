import { afterEach, describe, expect, it, vi } from 'vitest'
import { http } from './http'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('http.get de-duplication', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends one request for the same GET asked twice at once; each caller gets its own copy', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ rows: [1, 2] }))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([http.get<{ rows: number[] }>('/api/x?PageNo=1'), http.get<{ rows: number[] }>('/api/x?PageNo=1')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })

  it('calls again once the first request has finished (refresh), and keeps different URLs apart', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await http.get('/api/x?PageNo=1')
    await http.get('/api/x?PageNo=1')
    await Promise.all([http.get('/api/x?PageNo=1'), http.get('/api/x?PageNo=2')])
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('never merges POSTs', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await Promise.all([http.post('/api/save', { a: 1 }), http.post('/api/save', { a: 1 })])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
