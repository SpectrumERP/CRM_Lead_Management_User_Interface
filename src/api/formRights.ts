/**
 * Per-form rights for the signed-in user (Spectrum menu), as in Task Management.
 *
 *   GET /api/globaldata/forms/task-management-menu
 *   → [{ formNo, formName, formCode, formCaption, isOpen, isSave, isUpdate, isDelete, isReport }]
 *
 * `isOpen` shows the screen, `isSave` allows adding, `isUpdate` editing, `isDelete` deleting.
 */
import type { AuthRole } from '../auth/types'
import { spectrumEndpoints } from './endpoints'
import { assertSuccess, type SpectrumResponse } from './fillValues'
import { toNo } from './geo'
import { http } from './http'

/** Spectrum form numbers of the screens gated by rights (shared with Task Management). */
export const FORM_NO = {
  businessEntity: 1550,
  businessEntityType: 1564,
  port: 1563,
  country: 14,
  state: 13,
  city: 12,
} as const

export interface FormRights {
  isOpen: boolean
  isSave: boolean
  isUpdate: boolean
  isDelete: boolean
  isReport: boolean
}

export type FormRightsMap = Record<number, FormRights>

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

export async function fetchFormRights(): Promise<FormRightsMap> {
  const response = await http.get<SpectrumResponse<Raw[] | null>>(spectrumEndpoints.formRights)
  assertSuccess(response)
  return toFormRightsMap(response.data ?? [])
}

const MASTER_FORMS: readonly number[] = [
  FORM_NO.businessEntityType,
  FORM_NO.port,
  FORM_NO.country,
  FORM_NO.state,
  FORM_NO.city,
]

/**
 * Rights when the menu is unavailable: Admin gets everything; other users can open, add and edit
 * business entities but not delete them, and get no master screens (Settings is Admin-only anyway).
 */
export function fallbackRights(formNo: number, role: AuthRole | undefined): FormRights {
  if (role === 'Admin') return ALL_RIGHTS
  if (MASTER_FORMS.includes(formNo)) return NO_RIGHTS
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
