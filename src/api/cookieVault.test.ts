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
    expect(cookieVault.has('fi-test')).toBe(true)
    expect(await cookieVault.get('fi-test')).toEqual(value)
    cookieVault.remove('fi-test')
    expect(cookieVault.has('fi-test')).toBe(false)
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

  it('with a shared domain, also removes a host-only copy that would shadow it', async () => {
    // Cookies keyed by name and Domain, like a browser: the host-only and the shared copy are separate.
    const scoped = new Map<string, string>()
    vi.stubGlobal('document', {
      get cookie() {
        return [...scoped].map(([key, v]) => `${key.split('|')[0]}=${v}`).join('; ')
      },
      set cookie(text: string) {
        const [pair, ...attrs] = text.split(';').map((part) => part.trim())
        const i = pair!.indexOf('=')
        const domain = attrs.find((a) => /^domain=/i.test(a))?.slice(7) ?? ''
        const key = `${pair!.slice(0, i)}|${domain}`
        if (attrs.some((a) => /^max-age=0$/i.test(a))) scoped.delete(key)
        else scoped.set(key, pair!.slice(i + 1))
      },
    })
    vi.stubEnv('VITE_COOKIE_DOMAIN', '.uat.example.com')
    try {
      scoped.set('fi-test|', '1')
      scoped.set('fi-test.0|', 'stale')
      const { cookieVault } = await import('./cookieVault')
      await cookieVault.set('fi-test', value, 60)
      expect(scoped.has('fi-test|.uat.example.com')).toBe(true)

      cookieVault.remove('fi-test')
      expect([...scoped.keys()]).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does not delete a shared cookie when this app cannot decrypt it', async () => {
    jar.set('fi-shared', '1')
    jar.set('fi-shared.0', 'not-a-valid-ciphertext')
    const { cookieVault } = await import('./cookieVault')

    expect(await cookieVault.get('fi-shared')).toBeNull()
    expect(cookieVault.has('fi-shared')).toBe(true)
  })
})
