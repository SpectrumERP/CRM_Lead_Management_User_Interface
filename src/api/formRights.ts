/**
 * Per-form rights for the signed-in user (Spectrum menu), as in Task Management.
 *
 *   GET /api/globaldata/forms/task-management-menu
 *   → [{ formNo, formName, formCode, formCaption, moduleNo, moduleName, isOpen, isSave, isUpdate, isDelete, isReport }]
 *
 * `isOpen` shows the screen, `isSave` allows adding, `isUpdate` editing, `isDelete` deleting.
 * `moduleNo` is the Spectrum ERP module of the form (22 CRM, 26 Task Management, 27 Document
 * Management): a module with an openable form shows in the ERP app launcher.
 */
import type { AuthRole } from '../auth/types'
import { spectrumEndpoints } from './endpoints'
import { assertSuccess, type SpectrumResponse } from './fillValues'
import { toNo } from './geo'
import { http } from './http'

/** Spectrum form numbers of the screens gated by rights (shared with Task Management). */
export const FORM_NO = {
  lead: 377,
  opportunity: 380,
  businessEntity: 1550,
  businessEntityType: 1564,
  port: 1563,
  country: 14,
  state: 13,
  city: 12,
} as const

/**
 * Sales Dashboard form. Set VITE_DASHBOARD_FORM_NO to its form number in the menu once the backend
 * registers it; until then every signed-in user sees the dashboard (as before).
 */
export const DASHBOARD_FORM_NO: number | undefined = Number(import.meta.env.VITE_DASHBOARD_FORM_NO) || undefined

/** Spectrum ERP module numbers (`moduleNo` in the menu). */
export const MODULE_NO = {
  crm: 22,
  task: 26,
  documents: 27,
} as const

export interface FormRights {
  isOpen: boolean
  isSave: boolean
  isUpdate: boolean
  isDelete: boolean
  isReport: boolean
}

export type FormRightsMap = Record<number, FormRights>

/** The loaded menu: rights by form, and the modules the user can open a form in. */
export interface FormMenu {
  map: FormRightsMap
  modules: number[]
}

export const NO_RIGHTS: FormRights = { isOpen: false, isSave: false, isUpdate: false, isDelete: false, isReport: false }
export const ALL_RIGHTS: FormRights = { isOpen: true, isSave: true, isUpdate: true, isDelete: true, isReport: true }

/**
 * Where the rights came from:
 * - `server`: the menu loaded — a form it does not list has no rights.
 * - `fallback`: the menu could not be loaded, or the login has no Spectrum token (demo account) —
 *   rights follow the CRM role instead (see `fallbackRights`).
 */
export type FormRightsSource = 'server' | 'fallback'

type Raw = Record<string, unknown>

export function toFormRightsMap(rows: readonly Raw[]): FormRightsMap {
  const map: FormRightsMap = {}
  for (const row of rows) {
    const formNo = toNo(row.formNo)
    if (!formNo) continue
    map[formNo] = {
      isOpen: row.isOpen === true,
      isSave: row.isSave === true,
      isUpdate: row.isUpdate === true,
      isDelete: row.isDelete === true,
      isReport: row.isReport === true,
    }
  }
  return map
}

/** Modules with at least one form the user can open (or report on). */
export function toMenuModules(rows: readonly Raw[]): number[] {
  const modules = new Set<number>()
  for (const row of rows) {
    const moduleNo = toNo(row.moduleNo)
    if (moduleNo && (row.isOpen === true || row.isReport === true)) modules.add(moduleNo)
  }
  return [...modules]
}

export async function fetchFormRights(): Promise<FormMenu> {
  const response = await http.get<SpectrumResponse<Raw[] | null>>(spectrumEndpoints.formRights)
  assertSuccess(response)
  const rows = response.data ?? []
  return { map: toFormRightsMap(rows), modules: toMenuModules(rows) }
}

const MASTER_FORMS: readonly number[] = [
  FORM_NO.businessEntityType,
  FORM_NO.port,
  FORM_NO.country,
  FORM_NO.state,
  FORM_NO.city,
]

/** CRM screens everyone could use before they were tied to the menu. */
const OPEN_FORMS: readonly number[] = [FORM_NO.lead, FORM_NO.opportunity, ...(DASHBOARD_FORM_NO ? [DASHBOARD_FORM_NO] : [])]

/**
 * Rights when the menu is unavailable: Admin gets everything; other users keep full use of leads,
 * opportunities and the dashboard, can open, add and edit business entities but not delete them, and
 * get no master screens (Settings is Admin-only anyway).
 */
export function fallbackRights(formNo: number, role: AuthRole | undefined): FormRights {
  if (role === 'Admin') return ALL_RIGHTS
  if (MASTER_FORMS.includes(formNo)) return NO_RIGHTS
  if (OPEN_FORMS.includes(formNo)) return ALL_RIGHTS
  if (formNo === FORM_NO.businessEntity) return { ...ALL_RIGHTS, isDelete: false }
  return NO_RIGHTS
}

/** Rights for one form, from the loaded menu or the role fallback. */
export function rightsFor(
  formNo: number,
  state: { source: FormRightsSource; map: FormRightsMap },
  role: AuthRole | undefined,
): FormRights {
  if (state.source === 'fallback') return fallbackRights(formNo, role)
  return state.map[formNo] ?? NO_RIGHTS
}
