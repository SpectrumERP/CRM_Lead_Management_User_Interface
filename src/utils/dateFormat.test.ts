import { describe, expect, it } from 'vitest'
import { formatDate, formatDateParts, formatDateSmart, formatDateTime, formatTime, formatTimeRange, parseDate } from './dateFormat'

describe('display dates (one format everywhere)', () => {
  it('formats every stored / received shape the same way', () => {
    const local = new Date(2026, 9, 1, 14, 5)
    expect(formatDate('2026-10-01')).toBe('01 Oct 2026')
    expect(formatDate('01-10-2026')).toBe('01 Oct 2026')
    expect(formatDate('1 Oct 2026')).toBe('01 Oct 2026')
    expect(formatDate(local.toISOString())).toBe('01 Oct 2026')
    expect(formatDateTime(local.toISOString())).toBe('01 Oct 2026, 14:05')
    expect(formatDateTime('2026-10-01T14:05')).toBe('01 Oct 2026, 14:05')
    expect(formatDateTime('01-10-2026 14:05')).toBe('01 Oct 2026, 14:05')
  })

  it('uses a fixed month name (no locale "Sept")', () => {
    expect(formatDate('2026-09-30')).toBe('30 Sep 2026')
  })

  it('shows a date-only value without a time, and joins separate date and time parts', () => {
    expect(formatDateSmart('2026-10-01')).toBe('01 Oct 2026')
    expect(formatDateSmart('01-10-2026 09:30')).toBe('01 Oct 2026, 09:30')
    expect(formatDateParts('2026-10-01', '09:30')).toBe('01 Oct 2026, 09:30')
    expect(formatDateParts('2026-10-01', '')).toBe('01 Oct 2026')
    expect(formatTimeRange('2026-10-01', '10:00', '11:30')).toBe('01 Oct 2026, 10:00 – 11:30')
    expect(formatTime('9:05')).toBe('09:05')
  })

  it('keeps empty and unreadable values readable', () => {
    expect(formatDate('')).toBe('—')
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
    expect(formatDate('Just now')).toBe('Just now')
    expect(parseDate('not a date')).toBeNull()
  })
})
