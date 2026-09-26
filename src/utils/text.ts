/** First 1–2 name parts as uppercase initials (e.g. "Priya Mehta" → "PM"). */
export function personInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

/** Case-insensitive substring check. */
export function includesIgnoreCase(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

/**
 * True when `query` is empty, or any of `values` contains the needle
 * (case-insensitive). Skips null/undefined/empty values.
 */
export function matchesAny(
  values: Array<string | null | undefined>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return values.some((value) => Boolean(value) && value!.toLowerCase().includes(needle))
}
