/**
 * The one place that decides how dates and times look in the app. Every screen formats through these
 * helpers, so changing a setting below changes it everywhere:
 *
 *   date        01 Oct 2026
 *   date + time 01 Oct 2026, 14:05
 *
 * Month names are fixed here (not taken from the browser locale, which varies — en-IN prints "Sept").
 * Values the parser cannot read (e.g. "Just now") are shown as they are.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** 24-hour clock (14:05); set false for 12-hour (02:05 PM). */
export const USE_24_HOUR_CLOCK = true

/** Between the date and the time. */
export const DATE_TIME_SEPARATOR = ', '

/** Shown for a missing date. */
export const EMPTY_DATE = '—'

type DateInput = string | Date | null | undefined

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Read any date the app stores or receives:
 * ISO with a zone (server), `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM` (local, from inputs),
 * `DD-MM-YYYY` / `DD-MM-YYYY HH:MM` (notes, emails), or text like "05 Sep 2024".
 */
export function parseDate(value: DateInput): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = value.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0))
  m = /^(\d{2})-(\d{2})-(\d{4})(?:[T ](\d{2}):(\d{2}))?$/.exec(text)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0))
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** True when the text carries a time of day (so a date-only value is not shown as 00:00). */
function hasTimePart(value: DateInput): boolean {
  if (value instanceof Date) return true
  return typeof value === 'string' && /\d{1,2}:\d{2}/.test(value)
}

function dateText(d: Date): string {
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function timeText(d: Date): string {
  if (USE_24_HOUR_CLOCK) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const h = d.getHours() % 12 || 12
  return `${pad(h)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

/** `01 Oct 2026`. */
export function formatDate(value: DateInput, empty = EMPTY_DATE): string {
  if (!value) return empty
  const d = parseDate(value)
  return d ? dateText(d) : String(value)
}

/** `14:05` (or `02:05 PM`). Accepts a full date-time or a bare `HH:MM`. */
export function formatTime(value: DateInput, empty = ''): string {
  if (!value) return empty
  if (typeof value === 'string') {
    const m = /^(\d{1,2}):(\d{2})/.exec(value.trim())
    if (m) return timeText(new Date(2000, 0, 1, Number(m[1]), Number(m[2])))
  }
  const d = parseDate(value)
  return d ? timeText(d) : String(value)
}

/** `01 Oct 2026, 14:05`. */
export function formatDateTime(value: DateInput, empty = EMPTY_DATE): string {
  if (!value) return empty
  const d = parseDate(value)
  return d ? `${dateText(d)}${DATE_TIME_SEPARATOR}${timeText(d)}` : String(value)
}

/** Date-time when the value has a time, else just the date. */
export function formatDateSmart(value: DateInput, empty = EMPTY_DATE): string {
  return hasTimePart(value) ? formatDateTime(value, empty) : formatDate(value, empty)
}

/** A date and an optional separate `HH:MM` (activities, meetings, emails) → one display string. */
export function formatDateParts(date: string | null | undefined, time?: string | null, empty = EMPTY_DATE): string {
  if (!date) return empty
  if (!time) return formatDateSmart(date, empty)
  return joinDateTime(formatDate(date, empty), formatTime(time))
}

/** Already-formatted date and time text → `date, time` (or just the date). */
export function joinDateTime(date: string, time?: string | null): string {
  return time ? `${date}${DATE_TIME_SEPARATOR}${time}` : date
}

/** `01 Oct 2026, 10:00 – 11:30` (meetings). */
export function formatTimeRange(date: string, start?: string | null, end?: string | null, empty = EMPTY_DATE): string {
  if (!date) return empty
  if (!start) return formatDate(date, empty)
  const range = end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start)
  return joinDateTime(formatDate(date, empty), range)
}

/** Local calendar date as `YYYY-MM-DD` (for storing a date picked or stamped today). */
export function toIsoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local time as `HH:MM` (24-hour) — for storing, independent of the display clock setting. */
export function toTimeHHMM(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Stamp stored on in-app emails / notes: `{ date: 'DD-MM-YYYY', time: 'HH:MM' }` (formatDate reads it). */
export function toStoredStamp(d: Date = new Date()): { date: string; time: string } {
  return { date: `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`, time: toTimeHHMM(d) }
}
