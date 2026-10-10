import { describe, expect, it } from 'vitest'
import { entryLines, timeAgo } from './clipboardStore'

describe('entryLines', () => {
  it('lists every value of the server JSON, arrays flattened', () => {
    const json = '```json\n{"full_name":"Prasen Ganguly","phone_numbers":["+971 585909880"],"email":"","nested":{"city":"Ajman"}}\n```'
    expect(entryLines(json)).toEqual(['Prasen Ganguly', '+971 585909880', 'Ajman'])
  })

  it('splits OCR text into non-empty lines', () => {
    expect(entryLines('Prasen Ganguly\n\n  Sr. Manager \n')).toEqual(['Prasen Ganguly', 'Sr. Manager'])
  })
})

describe('timeAgo', () => {
  const now = Date.parse('2026-10-10T12:00:00Z')
  const ago = (ms: number) => timeAgo(new Date(now - ms).toISOString(), now)

  it('reads like date-fns formatDistanceToNow', () => {
    expect(ago(10_000)).toBe('less than a minute ago')
    expect(ago(60_000)).toBe('1 minute ago')
    expect(ago(5 * 60_000)).toBe('5 minutes ago')
    expect(ago(60 * 60_000)).toBe('about 1 hour ago')
    expect(ago(3 * 3600_000)).toBe('about 3 hours ago')
    expect(ago(30 * 3600_000)).toBe('1 day ago')
  })
})
