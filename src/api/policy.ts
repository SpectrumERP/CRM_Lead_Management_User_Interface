import { isAdmin } from '../auth/users'
import type { AuthUser } from '../auth/types'
import { forbidden, unauthenticated } from './errors'
import { getSessionSync } from './session'

export type Permission =
  | 'crm.read'
  | 'crm.write'
  | 'audit.read'
  | 'settings.write'

const POLICIES: Record<Permission, (user: AuthUser) => boolean> = {
  'crm.read': () => true,
  'crm.write': () => true,
  'audit.read': (user) => isAdmin(user.role),
  'settings.write': (user) => isAdmin(user.role),
}

export function currentUser(): AuthUser {
  const user = getSessionSync()
  if (!user) unauthenticated()
  return user
}

export function requirePermission(permission: Permission): AuthUser {
  const user = currentUser()
  if (!POLICIES[permission](user)) forbidden()
  return user
}

/**
 * Resource-level write gate.
 * Admins: all records.
 * Sales Manager: team pipeline (all leads) — matches Force Intellect sales ops.
 * Other roles: owner-only when `ownerName` is provided.
 */
export function assertCanWriteRecord(ownerName?: string): AuthUser {
  const user = requirePermission('crm.write')
  if (isAdmin(user.role) || user.role === 'Sales Manager') return user
  if (ownerName && ownerName === user.name) return user
  if (!ownerName) return user
  forbidden()
  return user
}
