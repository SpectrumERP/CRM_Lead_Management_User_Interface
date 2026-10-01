import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { searchUsers, userDisplayName } from './users'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const user = { loginNo: 11, loginId: 'priya.mehta', printingName: 'Priya Mehta', email: 'priya@example.com' }

describe('user search', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('sends the typed text as keywordSearch', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: [user] }))
    await expect(searchUsers('  priya ')).resolves.toEqual([user])
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/security/users')
    expect(Object.fromEntries(url.searchParams)).toEqual({ keywordSearch: 'priya' })
  })

  it('sends keywordSearch=a when nothing is typed (the API rejects an empty keyword)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: null }))
    await expect(searchUsers('  ')).resolves.toEqual([])
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(Object.fromEntries(url.searchParams)).toEqual({ keywordSearch: 'a' })
  })

  it('surfaces the first field error when success is false', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: false,
        message: 'Failed',
        data: null,
        error: 'Validation failed.',
        errors: [{ propertyName: 'keywordSearch', errorMessage: 'Keyword is too long.', errorCode: 'MAX_LENGTH' }],
        traceId: 't1',
      }),
    )
    await expect(searchUsers('x')).rejects.toMatchObject({ code: 'VALIDATION', message: 'Keyword is too long.' })
  })

  it('shows the printing name, falling back to the login id', () => {
    expect(userDisplayName(user)).toBe('Priya Mehta')
    expect(userDisplayName({ printingName: '  ', loginId: 'edp' })).toBe('edp')
    expect(userDisplayName({ printingName: null as unknown as string, loginId: 'edp' })).toBe('edp')
  })
})
