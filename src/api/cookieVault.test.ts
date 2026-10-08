import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Minimal `document.cookie` jar (Max-Age=0 deletes). */
function stubCookies() {
  const jar = new Map<string, string>()
  vi.stubGlobal('document', {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    set cookie(text: string) {
      const [pair, ...attrs] = text.split(';')
      const i = pair!.indexOf('=')
      const name = pair!.slice(0, i).trim()
      if (attrs.some((a) => /max-age=0\b/i.test(a.trim()))) jar.delete(name)
      else jar.set(name, pair!.slice(i + 1))
    },
  })
  vi.stubGlobal('location', { protocol: 'http:' })
  return jar
}

const value = { token: 'abc.def.ghi', user: { LoginNo: 7, PrintingName: 'EDP – ₹ ü' } }

describe('cookieVault', () => {
  let jar: Map<string, string>

  beforeEach(() => {
    vi.resetModules()
    jar = stubCookies()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('encrypts with Web Crypto when it is available', async () => {
    const { cookieVault } = await import('./cookieVault')
    await cookieVault.set('fi-test', value, 60)
    expect(jar.get('fi-test.0')!.startsWith('p.')).toBe(false)
    expect(await cookieVault.get('fi-test')).toEqual(value)
  })

  it('still works on a plain-HTTP page, where crypto.subtle does not exist', async () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
    const { cookieVault } = await import('./cookieVault')
    await cookieVault.set('fi-test', value, 60)
    expect(jar.get('fi-test.0')!.startsWith('p.')).toBe(true)
    expect(await cookieVault.get('fi-test')).toEqual(value)
  })

  it('reads a plain value later even where Web Crypto is available', async () => {
    vi.stubGlobal('crypto', {})
    const plain = await import('./cookieVault')
    await plain.cookieVault.set('fi-test', value, 60)
    // Same cookies, now on a page that has Web Crypto.
    const saved = new Map(jar)
    vi.unstubAllGlobals()
    vi.resetModules()
    jar = stubCookies()
    saved.forEach((v, k) => jar.set(k, v))
    const { cookieVault } = await import('./cookieVault')
    expect(await cookieVault.get('fi-test')).toEqual(value)
  })
})
