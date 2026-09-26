import type { AuthRole, AuthUser } from './types'
import { isEmail, safeEqual, sanitizeEmail, sha256Hex } from '../api/sanitize'

interface CredentialRecord extends AuthUser {
  passwordHash: string
}

/** Password hashes only — never store or export plaintext passwords. */
const CREDENTIALS: CredentialRecord[] = [
  {
    id: 'USR-0042',
    name: 'Priya Mehta',
    email: 'priya.mehta@forceintellect.com',
    role: 'Sales Manager',
    jobTitle: 'Sales Manager',
    initials: 'PM',
    passwordHash: '83adcf16d163c788f4f997ef7d57b22ca9a218cbc0ec39be43c8752d5537c02c',
  },
  {
    id: 'USR-0001',
    name: 'Rajiv Anand',
    email: 'rajiv.anand@forceintellect.com',
    role: 'Admin',
    jobTitle: 'VP – Sales',
    initials: 'RA',
    passwordHash: 'e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7',
  },
]

function toPublicUser(record: CredentialRecord): AuthUser {
  const { passwordHash: _hash, ...user } = record
  return user
}

export function isAdmin(role: AuthRole | undefined) {
  return role === 'Admin'
}

export function findUserById(id: string): AuthUser | null {
  const record = CREDENTIALS.find((user) => user.id === id)
  return record ? toPublicUser(record) : null
}

export async function verifyLogin(email: string, password: string): Promise<AuthUser | null> {
  const normalized = sanitizeEmail(email)
  if (!isEmail(normalized) || password.length < 8 || password.length > 128) return null
  const record = CREDENTIALS.find((user) => user.email === normalized)
  const hash = await sha256Hex(password)
  if (!record) {
    await sha256Hex('timing-guard')
    return null
  }
  if (!safeEqual(record.passwordHash, hash)) return null
  return toPublicUser(record)
}
