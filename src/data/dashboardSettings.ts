/**
 * Dashboard settings kept in this browser (the server has no settings API yet).
 * Replace the storage with a server setting when one exists — readers only use the hook.
 */
import { useSyncExternalStore } from 'react'
import { STAGNANT_THRESHOLD_DAYS } from './dashboard'

const STORAGE_KEY = 'crm.dashboard.stagnantDays'
export const STAGNANT_DAYS_MIN = 1
export const STAGNANT_DAYS_MAX = 365

const listeners = new Set<() => void>()

function read(): number {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value >= STAGNANT_DAYS_MIN && value <= STAGNANT_DAYS_MAX
      ? value
      : STAGNANT_THRESHOLD_DAYS
  } catch {
    return STAGNANT_THRESHOLD_DAYS
  }
}

let current = read()

/** Days in one stage before a lead / opportunity is "Stagnant". */
export function setStagnantDays(days: number) {
  current = Math.min(STAGNANT_DAYS_MAX, Math.max(STAGNANT_DAYS_MIN, Math.round(days)))
  try {
    window.localStorage.setItem(STORAGE_KEY, String(current))
  } catch {
    // Storage blocked: the value still applies for this session.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStagnantDays(): number {
  return useSyncExternalStore(subscribe, () => current)
}
