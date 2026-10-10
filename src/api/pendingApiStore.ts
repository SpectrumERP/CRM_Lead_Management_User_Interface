/**
 * Stand-in for backend APIs that are specified but not on the server yet (see docs/Point3_Point4_Backend_Schema.md):
 *
 *   status rules       remark-mandatory / Won flags on Lead and Opportunity statuses
 *   status history     every status change with its remark and Won order details
 *   opportunity orders Order Value / Order Date of a Won opportunity
 *   activity files     attachments linked to a lead / opportunity activity
 *
 * `VITE_CRM_PENDING_API_MODE=server` switches the callers to the real endpoints; anything else (the default)
 * keeps this data in the browser (localStorage), so it is per browser and for demos only.
 */
import { useSyncExternalStore } from 'react'
import type { Attachment } from './attachments'

export type PendingApiMode = 'mock' | 'server'

export const PENDING_API_MODE: PendingApiMode =
  String(import.meta.env.VITE_CRM_PENDING_API_MODE ?? '').trim().toLowerCase() === 'server' ? 'server' : 'mock'

export const isPendingApiMock = () => PENDING_API_MODE === 'mock'

export type StatusRecordType = 'Lead' | 'Opportunity'

export interface StoredStatusRule {
  isRemarkMandatory: boolean
  /** Opportunity statuses only: Order Value and Order Date are required. */
  isWon?: boolean
}

export interface StatusHistoryEntry {
  statusChangeHistoryNo: number
  recordType: StatusRecordType
  recordNo: number
  previousStatusNo?: number
  previousStatusName?: string
  newStatusNo?: number
  newStatusName: string
  remark?: string
  orderValue?: number
  /** `YYYY-MM-DD`. */
  orderDate?: string
  changedBy: { loginNo?: number; name: string }
  /** ISO date-time. */
  changedDate: string
}

export interface OpportunityOrder {
  orderValue: number
  /** `YYYY-MM-DD`. */
  orderDate: string
}

export interface PendingApiData {
  rules: { lead: Record<number, StoredStatusRule>; opportunity: Record<number, StoredStatusRule> }
  history: StatusHistoryEntry[]
  orders: Record<number, OpportunityOrder>
  /** Activity id (`SA-…` / `SOA-…`) → its files. */
  activityAttachments: Record<string, Attachment[]>
}

const STORAGE_KEY = 'crm.pendingApi.v1'

function empty(): PendingApiData {
  return { rules: { lead: {}, opportunity: {} }, history: [], orders: {}, activityAttachments: {} }
}

function read(): PendingApiData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Partial<PendingApiData>
    const base = empty()
    return {
      rules: { lead: { ...parsed.rules?.lead }, opportunity: { ...parsed.rules?.opportunity } },
      history: Array.isArray(parsed.history) ? parsed.history : base.history,
      orders: { ...parsed.orders },
      activityAttachments: { ...parsed.activityAttachments },
    }
  } catch {
    return empty()
  }
}

let current: PendingApiData = typeof window === 'undefined' ? empty() : read()
const listeners = new Set<() => void>()

export function getPendingData(): PendingApiData {
  return current
}

export function updatePendingData(change: (data: PendingApiData) => PendingApiData) {
  current = change(current)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage blocked or full: the data still applies until the page reloads.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Re-renders when the mock data changes (any part). */
export function usePendingData(): PendingApiData {
  return useSyncExternalStore(subscribe, () => current, () => current)
}

/** Tests only. */
export function __resetPendingDataForTests() {
  current = empty()
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener())
}
