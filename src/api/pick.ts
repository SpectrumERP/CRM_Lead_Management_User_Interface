/**
 * Pick only allowlisted keys from a patch object.
 * Prevents mass-assignment of immutable or privileged fields (id, createdAt, etc.).
 */
export function pickAllowlisted<T extends object, K extends keyof T>(
  patch: Partial<T>,
  keys: readonly K[],
): Pick<Partial<T>, K> {
  const next = {} as Pick<Partial<T>, K>
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
      next[key] = patch[key] as T[K]
    }
  }
  return next
}
