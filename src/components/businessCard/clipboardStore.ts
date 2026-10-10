/**
 * Business card clipboard (Task Management's `useClipboardStore`): every card read is kept here for
 * the session so its text can be pasted into any reviewed field. In memory only, newest first.
 */
import { useSyncExternalStore } from 'react'
import type { BusinessCardData } from '../../api/businessCard'

export interface ClipboardEntry {
  id: string
  /** ISO string. */
  timestamp: string
  source: 'BusinessCard'
  data: BusinessCardData
  /** The reader's raw text: the server's JSON, or the on-device OCR text. */
  formattedText: string
}

/** Keep the last 50 entries. */
const LIMIT = 50

let entries: ClipboardEntry[] = []
const listeners = new Set<() => void>()

function emit(next: ClipboardEntry[]) {
  entries = next
  listeners.forEach((listener) => listener())
}

function newId() {
  // randomUUID needs a secure context (HTTPS / localhost); plain-HTTP hosts fall back.
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function addClipboardEntry(entry: Omit<ClipboardEntry, 'id' | 'timestamp'>) {
  emit([{ ...entry, id: newId(), timestamp: new Date().toISOString() }, ...entries].slice(0, LIMIT))
}

export function removeClipboardEntry(id: string) {
  emit(entries.filter((entry) => entry.id !== id))
}

export function clearClipboardEntries() {
  emit([])
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useClipboardEntries(): ClipboardEntry[] {
  return useSyncExternalStore(subscribe, () => entries)
}

/** Every value of a JSON entry, in order; otherwise its non-empty lines. */
export function entryLines(formattedText: string): string[] {
  const text = formattedText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const values = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.map((item) => String(item))
        if (value && typeof value === 'object') return Object.values(value).flatMap(values)
        return value === null || value === undefined || String(value).trim() === '' ? [] : [String(value)]
      }
      return values(JSON.parse(text)).filter((line) => line.trim() !== '')
    } catch {
      // Not JSON after all — fall back to lines.
    }
  }
  return formattedText.split('\n').map((line) => line.trim()).filter(Boolean)
}

/** "less than a minute ago", "5 minutes ago", "about 2 hours ago" — as date-fns `formatDistanceToNow`. */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000)
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  let distance: string
  if (minutes < 1) distance = 'less than a minute'
  else if (minutes < 45) distance = plural(minutes, 'minute')
  else if (minutes < 90) distance = 'about 1 hour'
  else if (minutes < 1440) distance = `about ${plural(Math.round(minutes / 60), 'hour')}`
  else if (minutes < 2520) distance = '1 day'
  else if (minutes < 43200) distance = plural(Math.round(minutes / 1440), 'day')
  else distance = plural(Math.round(minutes / 43200), 'month')
  return `${distance} ago`
}
