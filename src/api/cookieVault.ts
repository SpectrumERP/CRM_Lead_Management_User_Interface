/**
 * Encrypted cookie storage (AES-GCM via Web Crypto).
 * Values are JSON → encrypted → base64url, split across chunks when they exceed the per-cookie limit.
 * The key ships in the bundle, so this hides data from casual inspection; it is not a substitute
 * for server-set httpOnly cookies.
 *
 * Web Crypto exists only in secure contexts (HTTPS, localhost). On a plain-HTTP host (e.g. a LAN IP)
 * values are stored as `p.` + base64url JSON instead — encoded, not encrypted. Serve over HTTPS to keep
 * the encryption. Task Management's `src/lib/crmSso.ts` reads both formats; keep the two in step.
 */

const DEFAULT_SECRET = 'fi-crm-cookie-v1'
const KEY_SALT = 'fi-crm-cookie-salt'
const CHUNK_CHARS = 3500
const MAX_CHUNKS = 10
/** Marks a value stored without encryption (no Web Crypto). base64url never contains '.'. */
const PLAIN_PREFIX = 'p.'

function canEncrypt(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
}

let keyPromise: Promise<CryptoKey> | null = null

function secret(): string {
  const raw = import.meta.env.VITE_COOKIE_SECRET
  return typeof raw === 'string' && raw.length > 0 ? raw : DEFAULT_SECRET
}

function cryptoKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const encoder = new TextEncoder()
    keyPromise = crypto.subtle
      .importKey('raw', encoder.encode(secret()), 'PBKDF2', false, ['deriveKey'])
      .then((base) =>
        crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: encoder.encode(KEY_SALT), iterations: 100_000, hash: 'SHA-256' },
          base,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        ),
      )
  }
  return keyPromise
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function encrypt(value: unknown): Promise<string> {
  if (!canEncrypt()) return PLAIN_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(value))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(), plain))
  const packed = new Uint8Array(iv.length + cipher.length)
  packed.set(iv)
  packed.set(cipher, iv.length)
  return toBase64Url(packed)
}

async function decrypt<T>(value: string): Promise<T> {
  if (value.startsWith(PLAIN_PREFIX)) {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value.slice(PLAIN_PREFIX.length)))) as T
  }
  const packed = fromBase64Url(value)
  const iv = packed.slice(0, 12)
  const cipher = packed.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await cryptoKey(), cipher)
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

function canUseCookies() {
  return typeof document !== 'undefined' && typeof document.cookie === 'string'
}

function readRaw(name: string): string | null {
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length)
  }
  return null
}

function writeRaw(name: string, value: string, maxAgeSeconds: number) {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  const domain = String(import.meta.env.VITE_COOKIE_DOMAIN ?? '').trim()
  const sharedDomain = domain ? `; Domain=${domain}` : ''
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Strict${sharedDomain}${secure}`
}

function expireRaw(name: string) {
  writeRaw(name, '', 0)
  // Also a host-only copy left from before the shared domain was configured, which would shadow it.
  if (String(import.meta.env.VITE_COOKIE_DOMAIN ?? '').trim()) document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict`
}

function removeChunks(name: string) {
  for (let i = 0; i < MAX_CHUNKS; i += 1) {
    if (readRaw(`${name}.${i}`) === null) break
    expireRaw(`${name}.${i}`)
  }
}

export const cookieVault = {
  available: canUseCookies,

  has(name: string): boolean {
    if (!canUseCookies()) return false
    const count = Number(readRaw(name))
    if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return false
    for (let i = 0; i < count; i += 1) {
      if (readRaw(`${name}.${i}`) === null) return false
    }
    return true
  },

  async set(name: string, value: unknown, maxAgeSeconds: number): Promise<void> {
    if (!canUseCookies()) return
    const encoded = await encrypt(value)
    const chunks: string[] = []
    for (let i = 0; i < encoded.length; i += CHUNK_CHARS) chunks.push(encoded.slice(i, i + CHUNK_CHARS))
    if (chunks.length > MAX_CHUNKS) throw new Error(`Cookie "${name}" is too large to store.`)
    removeChunks(name)
    const age = Math.max(0, Math.floor(maxAgeSeconds))
    chunks.forEach((chunk, i) => writeRaw(`${name}.${i}`, chunk, age))
    writeRaw(name, String(chunks.length), age)
  },

  async get<T>(name: string): Promise<T | null> {
    if (!canUseCookies()) return null
    const count = Number(readRaw(name))
    if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null
    let encoded = ''
    for (let i = 0; i < count; i += 1) {
      const chunk = readRaw(`${name}.${i}`)
      if (chunk === null) return null
      encoded += chunk
    }
    try {
      return await decrypt<T>(encoded)
    } catch {
      // A decrypt failure can mean this app was built with a different environment key. Do not delete
      // the shared cookie: that would make another module interpret a local read failure as logout.
      return null
    }
  },

  remove(name: string) {
    if (!canUseCookies()) return
    removeChunks(name)
    expireRaw(name)
  },
}
