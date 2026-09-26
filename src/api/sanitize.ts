const MAX_TEXT = 4000
const MAX_NAME = 200

/** Strip control chars + HTML — CRM fields are plain text only. */
export function sanitizeText(value: string, max = MAX_TEXT): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function sanitizeName(value: string): string {
  return sanitizeText(value, MAX_NAME)
}

/** Normalize email; empty string if nothing usable remains. */
export function sanitizeEmail(value: string): string {
  return sanitizeText(value, 254).toLowerCase().replace(/\s+/g, '')
}

/**
 * Practical email check (not full RFC 5322).
 * Rejects spaces, consecutive dots, and missing TLD.
 */
export function isEmail(value: string): boolean {
  if (!value || value.length > 254) return false
  if (value.includes('..') || value.startsWith('.') || value.endsWith('.')) return false
  return /^[a-z0-9](?:[a-z0-9_+.-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(
    value,
  )
}

/** 7–15 digits after stripping formatting (E.164-ish). */
export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

/** Constant-time string compare for hashes / signatures. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
