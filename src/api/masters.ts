/**
 * Spectrum master APIs (Save / Load Data / Search / Delete), called through `http`.
 * Lead Stage, Lead Source, Lead Priority and Lead Activity Type share one contract that
 * differs only by route and field names, so one factory builds all four.
 */
import { spectrumEndpoints } from './endpoints'
import { fail } from './errors'
import { http } from './http'
import { withQuery } from './query'

/** Every master endpoint wraps its payload the same way. */
interface Envelope<T> {
  success: boolean
  message: string
  data: T
}

export interface MasterUserRef {
  loginNo: number
  loginId: string
  printingName: string | null
  email: string | null
}

export interface MasterCompanyLink {
  company: { companyNo: number; companyCode: string; companyName: string }
  inactive: boolean
}

/** Row from `search-data`, normalised across masters. */
export interface MasterRow {
  no: number
  code: string
  name: string
  sequence?: number
  createdBy: string | null
  modifiedBy: string | null
  createdDate: string | null
  modifiedDate: string | null
  inactive: boolean
}

/** Record from `load-data/{id}`, normalised across masters. */
export interface MasterDetail {
  no: number
  code: string
  name: string
  sequence?: number
  documentStatus: { documentStatusNo: number; documentStatusName: string } | null
  companies: MasterCompanyLink[]
  createdBy: MasterUserRef | null
  createdDate: string | null
  modifiedBy: MasterUserRef | null
  modifiedDate: string | null
  authorizedBy: MasterUserRef | null
  authorizedDate: string | null
}

export interface MasterSaveInput {
  /** Omit or null to insert; > 0 to update. */
  no?: number | null
  name: string
  sequence?: number
}

export interface MasterSearchFilters {
  name?: string
  code?: string
}

export interface MasterDefinition {
  /** Route segment under `/api/master/`. */
  path: string
  /** Field prefix, e.g. `leadStage` → `leadStageNo` / `leadStageName`. */
  field: string
  hasSequence: boolean
  label: string
}

export const NAME_MAX = 100
export const CODE_MAX = 6
const SMALLINT_MAX = 32767

type RawRecord = Record<string, unknown>

function unwrap<T>(envelope: Envelope<T>): T {
  if (!envelope || envelope.success === false) fail('VALIDATION', envelope?.message)
  return envelope.data
}

function assertPositive(value: number, label: string, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 1 || value > max) fail('VALIDATION', `${label} must be a positive number.`)
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function createMasterApi(def: MasterDefinition) {
  const base = `${spectrumEndpoints.masters}/${def.path}`
  const noKey = `${def.field}No`
  const nameKey = `${def.field}Name`

  function toRow(raw: RawRecord): MasterRow {
    return {
      no: Number(raw[noKey]),
      code: text(raw.code) ?? '',
      name: text(raw[nameKey]) ?? '',
      sequence: def.hasSequence && typeof raw.sequence === 'number' ? raw.sequence : undefined,
      createdBy: text(raw.createdBy),
      modifiedBy: text(raw.modifiedBy),
      createdDate: text(raw.createdDate),
      modifiedDate: text(raw.modifiedDate),
      inactive: raw.inactive === true,
    }
  }

  function toDetail(raw: RawRecord): MasterDetail {
    return {
      no: Number(raw[noKey]),
      code: text(raw.code) ?? '',
      name: text(raw[nameKey]) ?? '',
      sequence: def.hasSequence && typeof raw.sequence === 'number' ? raw.sequence : undefined,
      documentStatus: (raw.documentStatus as MasterDetail['documentStatus']) ?? null,
      companies: Array.isArray(raw.companies) ? (raw.companies as MasterCompanyLink[]) : [],
      createdBy: (raw.createdBy as MasterUserRef) ?? null,
      createdDate: text(raw.createdDate),
      modifiedBy: (raw.modifiedBy as MasterUserRef) ?? null,
      modifiedDate: text(raw.modifiedDate),
      authorizedBy: (raw.authorizedBy as MasterUserRef) ?? null,
      authorizedDate: text(raw.authorizedDate),
    }
  }

  return {
    definition: def,

    async search(companyNo: number, filters: MasterSearchFilters = {}): Promise<MasterRow[]> {
      assertPositive(companyNo, 'Company')
      const url = withQuery(`${base}/search-data`, {
        companyNo,
        [nameKey]: filters.name?.trim().slice(0, NAME_MAX),
        code: filters.code?.trim().slice(0, CODE_MAX),
      })
      const data = unwrap(await http.get<Envelope<RawRecord[] | null>>(url))
      return (data ?? []).map(toRow)
    },

    async load(id: number, companyNo: number): Promise<MasterDetail> {
      assertPositive(id, `${def.label} number`, SMALLINT_MAX)
      assertPositive(companyNo, 'Company')
      const url = withQuery(`${base}/load-data/${id}`, { companyNo })
      return toDetail(unwrap(await http.get<Envelope<RawRecord>>(url)))
    },

    /** Insert when `no` is empty, update when it is > 0. Returns the record number. */
    async save(input: MasterSaveInput): Promise<number> {
      const name = input.name.trim()
      if (!name) fail('VALIDATION', `${def.label} name is required.`)
      if (name.length > NAME_MAX) fail('VALIDATION', `${def.label} name cannot exceed ${NAME_MAX} characters.`)
      const body: RawRecord = { [noKey]: input.no && input.no > 0 ? input.no : null, [nameKey]: name }
      if (def.hasSequence && input.sequence !== undefined) {
        assertPositive(input.sequence, 'Sequence')
        body.sequence = input.sequence
      }
      const data = unwrap(await http.post<Envelope<RawRecord>>(`${base}/save`, body))
      return Number(data?.[noKey] ?? input.no)
    },

    async remove(no: number): Promise<boolean> {
      assertPositive(no, `${def.label} number`, SMALLINT_MAX)
      const url = withQuery(`${base}/delete`, { [noKey]: no })
      return unwrap(await http.delete<Envelope<boolean>>(url)) !== false
    },
  }
}

export type MasterApi = ReturnType<typeof createMasterApi>

export const masterApis = {
  leadStages: createMasterApi({ path: 'lead-stages', field: 'leadStage', hasSequence: true, label: 'Lead stage' }),
  leadSources: createMasterApi({ path: 'lead-sources', field: 'leadSource', hasSequence: false, label: 'Lead source' }),
  leadPriorities: createMasterApi({ path: 'lead-priorities', field: 'leadPriority', hasSequence: true, label: 'Lead priority' }),
  leadActivityTypes: createMasterApi({
    path: 'lead-activity-types',
    field: 'leadActivityType',
    hasSequence: false,
    label: 'Lead activity type',
  }),
}

export type MasterKey = keyof typeof masterApis
