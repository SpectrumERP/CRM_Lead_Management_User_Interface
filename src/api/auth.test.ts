import { afterEach, describe, expect, it } from 'vitest'
import { login, logout, __resetAuthForTests } from './auth'
import { ApiError } from './errors'

function memoryStorage(): Storage {
  const mem: Record<string, string> = {}
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null),
    setItem: (key, value) => {
      mem[key] = String(value)
    },
    removeItem: (key) => {
      delete mem[key]
    },
    clear: () => {
      for (const key of Object.keys(mem)) delete mem[key]
    },
    key: (index) => Object.keys(mem)[index] ?? null,
    get length() {
      return Object.keys(mem).length
    },
  } as Storage
}

function installSessionStorage() {
  const session = memoryStorage()
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage: session },
    configurable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: session,
    configurable: true,
  })
  return session
}

describe('auth api', () => {
  afterEach(() => {
    __resetAuthForTests()
  })

  it('stores a signed session without password or role', async () => {
    const session = installSessionStorage()
    await login('priya.mehta@forceintellect.com', 'Force@123')
    const raw = session.getItem('fi-crm-session')
    expect(raw).toBeTruthy()
    const stored = JSON.parse(raw as string) as Record<string, unknown>
    expect(stored).toMatchObject({ sub: 'USR-0042' })
    expect(stored).not.toHaveProperty('password')
    expect(stored).not.toHaveProperty('passwordHash')
    expect(stored).not.toHaveProperty('role')
    expect(stored).not.toHaveProperty('email')
    expect(typeof stored.sig).toBe('string')
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

  it('clears the session on logout', async () => {
    const session = installSessionStorage()
    await login('priya.mehta@forceintellect.com', 'Force@123')
    logout()
    expect(session.getItem('fi-crm-session')).toBeNull()
  })
})
