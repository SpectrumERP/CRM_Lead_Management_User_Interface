import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, logout, me, __resetAuthForTests } from './auth'
import { __resetAuthStoreForTests, getAuthToken, loadAuth } from './authStore'
import { ApiError } from './errors'
import { http } from './http'

/** Minimal `document.cookie` jar: set one cookie per write, read all as "a=1; b=2". */
function installCookieJar() {
  const jar = new Map<string, string>()
  const doc = {
    get cookie() {
      return Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ')
    },
    set cookie(raw: string) {
      const [pair, ...attrs] = raw.split(';')
      const eq = pair!.indexOf('=')
      const name = pair!.slice(0, eq).trim()
      const value = pair!.slice(eq + 1)
      const maxAge = attrs.map((a) => a.trim()).find((a) => a.startsWith('Max-Age='))
      if (maxAge && Number(maxAge.slice('Max-Age='.length)) <= 0) jar.delete(name)
      else jar.set(name, value)
    },
  }
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true })
  return jar
}

function jwt(payload: Record<string, unknown>) {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.sig`
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const spectrumBody = (token: string) => ({
  token,
  company: [
    {
      CompanyNo: 1,
      CompanyCode: 'CM0001',
      CompanyName: 'Head Office',
      HeadOfficeNo: 1,
      BaseCurrencyNo: 1,
      BaseCurrencyName: 'Rupees',
      GSTINNo: '22AAICS9601A1ZT',
      IsThreadOn: true,
    },
  ],
  user: {
    LoginNo: 1,
    LoginID: 'edp',
    EmpNo: null,
    UserType: '1',
    Email: 'tasks@steelmont.ae',
    PhoneNo: null,
    PrintingName: 'EDP',
    LastLoginCompanyNo: 4,
    LastLoginModule: 1,
    RecentDocument: '<DocumentElement>…</DocumentElement>',
  },
})

describe('auth api', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    // Default: Spectrum rejects the credentials, so the demo-account fallback runs.
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => jsonResponse(401, { message: 'Invalid login' }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    __resetAuthForTests()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(globalThis, 'document')
  })

  it('stores the demo session encrypted in cookies', async () => {
    const jar = installCookieJar()
    await login('priya.mehta@forceintellect.com', 'Force@123')
    expect(jar.get('fi-crm-session')).toBe('1')
    const encrypted = jar.get('fi-crm-session.0') ?? ''
    expect(encrypted.length).toBeGreaterThan(0)
    expect(encrypted).not.toContain('priya')
    expect(encrypted).not.toContain('Force@123')
    expect(await me()).toMatchObject({ id: 'USR-0042' })
  })

  it('logs in through Spectrum and keeps the JWT in the encrypted auth cookie', async () => {
    const jar = installCookieJar()
    const token = jwt({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 })
    fetchMock.mockImplementation(async () => jsonResponse(200, spectrumBody(token)))

    const user = await login('edp', 'edp')

    expect(user).toMatchObject({ id: 'SPX-1', name: 'EDP', role: 'Admin', email: 'tasks@steelmont.ae' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/api\/Auth\/login$/)
    expect(JSON.parse(init.body)).toEqual({ loginId: 'edp', password: 'edp' })
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(jar.get('fi-crm-auth.0')).not.toContain(token)

    __resetAuthStoreForTests()
    expect(await getAuthToken()).toBe(token)
    const auth = await loadAuth()
    expect(auth?.companies[0]).not.toHaveProperty('IsThreadOn')
    expect(auth?.user).not.toHaveProperty('RecentDocument')
  })

  it('attaches the stored token to later http calls', async () => {
    installCookieJar()
    const token = jwt({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 })
    fetchMock.mockImplementation(async () => jsonResponse(200, spectrumBody(token)))
    await login('edp', 'edp')

    fetchMock.mockImplementation(async () => jsonResponse(200, { ok: true }))
    await http.get('/api/Something')
    const [, init] = fetchMock.mock.calls[1]!
    expect(init.headers.Authorization).toBe(`Bearer ${token}`)
  })

  it('reports an outage instead of wrong credentials when Spectrum is unreachable', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(login('edp', 'edp')).rejects.toMatchObject({ code: 'NETWORK' })
  })

  it('rejects an unknown account without leaking which field failed', async () => {
    try {
      await login('nobody@forceintellect.com', 'NotARealPass1')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe('INVALID_CREDENTIALS')
    }
  })

  it('rate-limits repeated failures', async () => {
    const email = 'flood@forceintellect.com'
    for (let i = 0; i < 5; i += 1) {
      await expect(login(email, 'NotARealPass1')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    }
    await expect(login(email, 'NotARealPass1')).rejects.toMatchObject({ code: 'RATE_LIMIT' })
  })

  it('clears session and auth cookies on logout', async () => {
    const jar = installCookieJar()
    const token = jwt({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 })
    fetchMock.mockImplementation(async () => jsonResponse(200, spectrumBody(token)))
    await login('edp', 'edp')
    logout()
    expect(jar.size).toBe(0)
    expect(await getAuthToken()).toBeNull()
  })
})
