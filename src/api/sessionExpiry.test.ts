import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests, loadAuth, saveAuth } from './authStore'
import { http } from './http'
import { clearSession, createSession, getSessionSync } from './session'
import { __resetSessionExpiryForTests, isSessionEnded, notifySessionExpired, onSessionExpired, resetSessionExpiry } from './sessionExpiry'

const spectrumUser = { id: 'SPX-1', name: 'EDP TEMP', email: '', role: 'Admin' as const, jobTitle: 'Administrator', initials: 'ET' }

async function signIn(expiresAt: number) {
  await saveAuth({
    token: 'header.payload.sig',
    expiresAt,
    companies: [],
    user: { LoginNo: 1, LoginID: 'edp', EmpNo: null, UserType: '1', Email: null, PhoneNo: null, PrintingName: 'EDP TEMP', LastLoginCompanyNo: null, LastLoginModule: null },
  })
  await createSession(spectrumUser, expiresAt)
}

describe('session expiry', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    __resetSessionExpiryForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
    clearSession()
    __resetSessionExpiryForTests()
  })

  it('ends the session once: wipes the token and session, then tells the listeners', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    notifySessionExpired('rejected')
    notifySessionExpired('expired')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('rejected')
    expect(await loadAuth()).toBeNull()
    expect(getSessionSync()).toBeNull()
    expect(isSessionEnded()).toBe(true)
    // A new sign-in starts over.
    resetSessionExpiry()
    expect(isSessionEnded()).toBe(false)
  })

  it('never sends an expired token: the request is stopped and the session ends', async () => {
    await signIn(Date.now() - 1_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    await expect(http.get('/api/crm/leads/search-data')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(listener).toHaveBeenCalledWith('expired')
  })

  it('a 401 from the server ends the session', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }))
    await expect(http.get('/api/crm/leads/search-data')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('rejected')
    expect(await loadAuth()).toBeNull()
  })

  it('a 401 hidden by CORS (network failure) ends the session when the server answers an anonymous call', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    // The call and the token check are blocked; the anonymous login check gets its 400.
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/Auth/login')) return new Response('{}', { status: 400 })
      throw new TypeError('Failed to fetch')
    })
    await expect(http.get('/api/crm/leads/search-data')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(listener).toHaveBeenCalledWith('rejected')
    expect(await loadAuth()).toBeNull()
  })

  it('a network failure stays a network failure when the token is still accepted', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/security/users')) return new Response('{}', { status: 400 })
      throw new TypeError('Failed to fetch')
    })
    await expect(http.get('/api/crm/leads/search-data')).rejects.toMatchObject({ code: 'NETWORK' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('a network failure stays a network failure when the server is unreachable', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(http.get('/api/crm/leads/search-data')).rejects.toMatchObject({ code: 'NETWORK' })
    expect(listener).not.toHaveBeenCalled()
    expect(await loadAuth()).not.toBeNull()
  })

  it('calls failing together share one token check', async () => {
    await signIn(Date.now() + 60_000)
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/Auth/login')) return new Response('{}', { status: 400 })
      throw new TypeError('Failed to fetch')
    })
    await Promise.allSettled([http.get('/api/a'), http.get('/api/b'), http.get('/api/c')])
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.filter((url) => url.includes('/api/security/users'))).toHaveLength(1)
    expect(urls.filter((url) => url.endsWith('/api/Auth/login'))).toHaveLength(1)
  })

  it('a valid token is sent as a bearer token and nothing ends', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }))
    await http.get('/api/crm/leads/search-data')
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer header.payload.sig')
    expect(listener).not.toHaveBeenCalled()
  })
})
