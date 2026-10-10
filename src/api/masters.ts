/**
 * Spectrum master APIs (Save / Load Data / Search / Delete) under /api/master/*, called through `http`.
 * Every master shares one contract that differs by route, field names and a few extra fields
 * (lead stage colour, opportunity status flags), so one factory builds them all.
 */
import { spectrumEndpoints } from './endpoints'
import { fail, serverErrorMessage } from './errors'
import { http } from './http'
import { PENDING_API_MODE } from './pendingApiStore'
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
  description?: string
  /** Hex colour (lead stages); load-data only — search rows do not carry it. */
  colorCoding?: string
  /** Yes / no fields (opportunity statuses); load-data only. */
  flags?: Record<string, boolean>
  /** Optional whole-number fields (opportunity stages: weightage). */
  numbers?: Record<string, number | undefined>
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
  description?: string
  colorCoding?: string
  flags?: Record<string, boolean>
  numbers?: Record<string, number | undefined>
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
  /** Head office the record belongs to — sent only by masters with `sendCompanyNo` (countries). */
  companyNo?: number | null
  name: string
  sequence?: number
  description?: string
  colorCoding?: string
  flags?: Record<string, boolean>
  numbers?: Record<string, number | undefined>
}

export interface MasterSearchFilters {
  name?: string
  code?: string
}

export interface MasterDefinition {
  /** Route segment under `root`, e.g. `lead-stages`. */
  path: string
  /** API root; default `/api/master`. */
  root?: string
  /** Field prefix, e.g. `leadStage` → `leadStageNo` / `leadStageName`. */
  field: string
  /** Name field when it does not follow the prefix (products: `productName`). */
  nameField?: string
  /** Longest name the server accepts; default NAME_MAX (products: 50). */
  nameMax?: number
  hasSequence: boolean
  /** Has a free-text `description`. */
  hasDescription?: boolean
  /** Longest description the server accepts (business entity types: 500). */
  descriptionMax?: number
  /** Save sends the head office as `companyNo` (countries). */
  sendCompanyNo?: boolean
  /** Has a `colorCoding` hex colour (lead stages). */
  hasColor?: boolean
  /**
   * Required yes / no fields sent on save (opportunity statuses: isFirstActivity / isLastActivity).
   * `pending`: a field the backend does not have yet — in mock mode it is not sent; the Settings form keeps it
   * in the browser instead (see statusRecord).
   */
  flags?: readonly { key: string; label: string; hint?: string; pending?: boolean }[]
  /** Lead / opportunity status master: its pending flags are the status rules of api/statusChange.ts. */
  statusRecord?: 'Lead' | 'Opportunity'
  /**
   * Optional whole-number fields (opportunity stages: weightage %). `inList`: search-data returns it,
   * so the list shows it as a column.
   */
  numbers?: readonly { key: string; label: string; min?: number; max?: number; suffix?: string; hint?: string; inList?: boolean }[]
  /** `search-data` accepts name / code filters (products take only CompanyNo). Default true. */
  searchFilters?: boolean
  label: string
}

/** Fields only load-data returns: editing must load the record first so saving keeps them. */
export function needsDetailForEdit(def: MasterDefinition): boolean {
  return Boolean(def.hasColor || def.flags?.length)
}

export const NAME_MAX = 100
export const CODE_MAX = 6
const SMALLINT_MAX = 32767

type RawRecord = Record<string, unknown>

function unwrap<T>(envelope: Envelope<T>): T {
  if (!envelope || envelope.success === false) fail('VALIDATION', serverErrorMessage(envelope))
  return envelope.data
}

function assertPositive(value: number, label: string, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 1 || value > max) fail('VALIDATION', `${label} must be a positive number.`)
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function createMasterApi(def: MasterDefinition) {
  const base = `${def.root ?? spectrumEndpoints.masters}/${def.path}`
  const noKey = `${def.field}No`
  const nameKey = def.nameField ?? `${def.field}Name`

  function flagsOf(raw: RawRecord): Record<string, boolean> | undefined {
    if (!def.flags?.length) return undefined
    return Object.fromEntries(def.flags.map((f) => [f.key, raw[f.key] === true]))
  }

  function numbersOf(raw: RawRecord): Record<string, number | undefined> | undefined {
    if (!def.numbers?.length) return undefined
    return Object.fromEntries(def.numbers.map((n) => [n.key, typeof raw[n.key] === 'number' ? (raw[n.key] as number) : undefined]))
  }

  function toRow(raw: RawRecord): MasterRow {
    return {
      no: Number(raw[noKey]),
      code: text(raw.code) ?? '',
      name: text(raw[nameKey]) ?? '',
      sequence: def.hasSequence && typeof raw.sequence === 'number' ? raw.sequence : undefined,
      description: def.hasDescription ? (text(raw.description) ?? '') : undefined,
      colorCoding: def.hasColor ? (text(raw.colorCoding) ?? undefined) : undefined,
      flags: flagsOf(raw),
      numbers: numbersOf(raw),
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
      description: def.hasDescription ? (text(raw.description) ?? '') : undefined,
      colorCoding: def.hasColor ? (text(raw.colorCoding) ?? undefined) : undefined,
      flags: flagsOf(raw),
      numbers: numbersOf(raw),
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
        ...(def.searchFilters === false
          ? {}
          : { [nameKey]: filters.name?.trim().slice(0, NAME_MAX), code: filters.code?.trim().slice(0, CODE_MAX) }),
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
      const max = def.nameMax ?? NAME_MAX
      if (name.length > max) fail('VALIDATION', `${def.label} name cannot exceed ${max} characters.`)
      const body: RawRecord = { [noKey]: input.no && input.no > 0 ? input.no : null, [nameKey]: name }
      // Required (non-nullable) on sequenced masters (lead stages / priorities, opportunity statuses).
      if (def.hasSequence) {
        if (input.sequence === undefined) fail('VALIDATION', 'Sequence is required.')
        assertPositive(input.sequence, 'Sequence')
        body.sequence = input.sequence
      }
      if (def.hasDescription) {
        const description = input.description?.trim() ?? ''
        if (def.descriptionMax && description.length > def.descriptionMax) {
          fail('VALIDATION', `Description is too long — keep it to ${def.descriptionMax} characters or fewer.`)
        }
        // Sent as null when cleared, so an update removes the old text.
        body.description = description || null
      }
      if (def.sendCompanyNo) {
        assertPositive(input.companyNo ?? 0, 'Company')
        body.companyNo = input.companyNo
      }
      if (def.hasColor) body.colorCoding = input.colorCoding?.trim() || undefined
      // Required booleans: always sent (false when not ticked). Pending ones only once the backend has them.
      for (const flag of def.flags ?? []) {
        if (flag.pending && PENDING_API_MODE !== 'server') continue
        body[flag.key] = input.flags?.[flag.key] === true
      }
      // Optional whole numbers: sent when given, within their range.
      for (const field of def.numbers ?? []) {
        const value = input.numbers?.[field.key]
        if (value === undefined) continue
        const min = field.min ?? 0
        const max = field.max ?? Number.MAX_SAFE_INTEGER
        if (!Number.isInteger(value) || value < min || value > max) {
          fail('VALIDATION', `${field.label} must be a whole number from ${min} to ${max}.`)
        }
        body[field.key] = value
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
  leadStages: createMasterApi({ path: 'lead-stages', field: 'leadStage', hasSequence: true, hasColor: true, label: 'Lead stage' }),
  leadSources: createMasterApi({ path: 'lead-sources', field: 'leadSource', hasSequence: false, label: 'Lead source' }),
  leadPriorities: createMasterApi({ path: 'lead-priorities', field: 'leadPriority', hasSequence: true, label: 'Lead priority' }),
  leadActivityTypes: createMasterApi({
    path: 'lead-activity-types',
    field: 'leadActivityType',
    hasSequence: false,
    label: 'Lead activity type',
  }),
  leadStatuses: createMasterApi({
    path: 'lead-statuses',
    field: 'leadStatus',
    hasSequence: false,
    flags: [
      { key: 'isFirstActivity', label: 'First activity', hint: 'Status a new lead starts with' },
      { key: 'isLastActivity', label: 'Last activity', hint: 'Status that closes the lead' },
      { key: 'isRemarkMandatory', label: 'Remark mandatory', hint: 'A remark is required when a lead moves to this status', pending: true },
    ],
    statusRecord: 'Lead',
    label: 'Lead status',
  }),
  opportunityStatuses: createMasterApi({
    path: 'opportunity-statuses',
    field: 'opportunityStatus',
    hasSequence: true,
    flags: [
      { key: 'isFirstActivity', label: 'First activity', hint: 'Status a new opportunity starts with' },
      { key: 'isLastActivity', label: 'Last activity', hint: 'Status that closes the opportunity' },
      { key: 'isRemarkMandatory', label: 'Remark mandatory', hint: 'A remark is required when an opportunity moves to this status', pending: true },
      { key: 'isWon', label: 'Won (Order Value + Order Date required)', hint: 'Order Value and Order Date are required for this status', pending: true },
    ],
    statusRecord: 'Opportunity',
    label: 'Opportunity status',
  }),
  opportunityStages: createMasterApi({
    path: 'opportunity-stages',
    field: 'opportunityStage',
    hasSequence: true,
    hasColor: true,
    numbers: [
      { key: 'weightage', label: 'Weightage', min: 0, max: 100, suffix: '%', hint: 'Win probability at this stage', inList: true },
    ],
    label: 'Opportunity stage',
  }),
  crmProducts: createMasterApi({
    path: 'crm-products',
    field: 'crmProduct',
    nameField: 'productName',
    // The server rejects longer names ("must be 50 characters or fewer").
    nameMax: 50,
    hasSequence: false,
    searchFilters: false,
    label: 'Product',
  }),
  businessEntityTypes: createMasterApi({
    path: 'business-entity-types',
    field: 'operCRMBusinessEntityType',
    nameMax: 50,
    hasSequence: false,
    hasDescription: true,
    descriptionMax: 500,
    searchFilters: false,
    label: 'Business entity type',
  }),
  countries: createMasterApi({
    path: 'countries',
    field: 'country',
    nameMax: 50,
    hasSequence: false,
    sendCompanyNo: true,
    searchFilters: false,
    label: 'Country',
  }),
}

export type MasterKey = keyof typeof masterApis
