/**
 * Spectrum master APIs (Save / Load Data / Search / Delete) under /api/master/*, called through `http`.
 * Every master shares one contract that differs by route, field names and a few extra fields
 * (lead stage colour, status flags and status type), so one factory builds them all.
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
  /** The `lookup` pick (status type number); null when none. */
  lookupNo?: number | null
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
  /** The `lookup` pick (status type number); empty sends null. */
  lookupNo?: number | null
}

/** One option of a master's `fill-values` list (e.g. a status type). */
export interface MasterLookupOption {
  no: number
  name: string
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
   * Required yes / no fields sent on save (lead / opportunity statuses: isRemarkRequired; opportunity statuses
   * also isOpportunityValueRequired).
   * `pending`: a field the backend does not have yet — in mock mode it is not sent; the Settings form keeps it
   * in the browser instead (see statusRecord).
   */
  flags?: readonly {
    key: string
    label: string
    hint?: string
    pending?: boolean
    /** Not shown on the form: set from the picked `lookup` option's name (true when it matches). */
    fromLookupName?: RegExp
    /** search-data returns it too, so the list shows it as a column (location types: Default). */
    inList?: boolean
  }[]
  /** Lead / opportunity status master: its pending flags are the status rules of api/statusChange.ts. */
  statusRecord?: 'Lead' | 'Opportunity'
  /**
   * Optional whole-number fields (opportunity stages: weightage %). `inList`: search-data returns it,
   * so the list shows it as a column.
   */
  numbers?: readonly { key: string; label: string; min?: number; max?: number; suffix?: string; hint?: string; inList?: boolean }[]
  /**
   * A pick from the master's own `fill-values?companyNo=` (lead / opportunity status type): the options are
   * `data[listKey]` rows with `noKey` / `nameKey`; saved as `saveKey`, read back from load-data's `loadKey` object.
   * Optional (the save takes null).
   */
  lookup?: { label: string; listKey: string; noKey: string; nameKey: string; saveKey: string; loadKey: string }
  /** `search-data` accepts name / code filters (products take only CompanyNo). Default true. */
  searchFilters?: boolean
  label: string
}

/**
 * The flags to save: `flags` plus those set from the picked lookup option's name (`fromLookupName`, e.g. a Won
 * status type → opportunity value required). `lookupName`: null = no option picked (false); undefined = the
 * picked option's name is unknown, so the value in `flags` (loaded with the record) is kept.
 */
export function withLookupFlags(
  def: MasterDefinition,
  flags: Record<string, boolean>,
  lookupName: string | null | undefined,
): Record<string, boolean> {
  const next = { ...flags }
  for (const flag of def.flags ?? []) {
    if (!flag.fromLookupName) continue
    next[flag.key] = lookupName === undefined ? flags[flag.key] === true : lookupName !== null && flag.fromLookupName.test(lookupName)
  }
  return next
}

/** Fields only load-data returns: editing must load the record first so saving keeps them. */
export function needsDetailForEdit(def: MasterDefinition): boolean {
  return Boolean(def.hasColor || def.flags?.length || def.lookup)
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

  function lookupNoOf(raw: RawRecord): number | null | undefined {
    if (!def.lookup) return undefined
    const picked = raw[def.lookup.loadKey] as RawRecord | null | undefined
    const no = Number(picked?.[def.lookup.noKey] ?? raw[def.lookup.saveKey])
    return Number.isInteger(no) && no > 0 ? no : null
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
      lookupNo: lookupNoOf(raw),
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

    /** The `lookup` options from `fill-values` ([] for masters without one). */
    async lookupOptions(companyNo: number): Promise<MasterLookupOption[]> {
      const lookup = def.lookup
      if (!lookup) return []
      assertPositive(companyNo, 'Company')
      const data = unwrap(await http.get<Envelope<RawRecord | null>>(withQuery(`${base}/fill-values`, { companyNo })))
      const list = Array.isArray(data?.[lookup.listKey]) ? (data![lookup.listKey] as RawRecord[]) : []
      return list
        .map((row) => ({ no: Number(row[lookup.noKey]), name: text(row[lookup.nameKey]) ?? '' }))
        .filter((option) => Number.isInteger(option.no) && option.no > 0)
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
      if (def.lookup) body[def.lookup.saveKey] = input.lookupNo && input.lookupNo > 0 ? input.lookupNo : null
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
    lookup: {
      label: 'Status Type',
      listKey: 'leadStatusTypes',
      noKey: 'leadStatusTypeNo',
      nameKey: 'leadStatusTypeName',
      saveKey: 'leadStatusTypeNo',
      loadKey: 'leadStatusType',
    },
    flags: [
      { key: 'isRemarkRequired', label: 'Remark required', hint: 'A remark is required when a lead moves to this status' },
      // { key: 'isRemarkMandatory', label: 'Remark mandatory', hint: 'A remark is required when a lead moves to this status', pending: true },
    ],
    statusRecord: 'Lead',
    label: 'Lead status',
  }),
  opportunityStatuses: createMasterApi({
    path: 'opportunity-statuses',
    field: 'opportunityStatus',
    hasSequence: true,
    lookup: {
      label: 'Status Type',
      listKey: 'oppStatusTypes',
      noKey: 'oppStatusTypeNo',
      nameKey: 'oppStatusTypeName',
      saveKey: 'oppStatusTypeNo',
      loadKey: 'oppStatusType',
    },
    flags: [
      { key: 'isRemarkRequired', label: 'Remark required', hint: 'A remark is required when an opportunity moves to this status' },
      // Set from the status type: a Won type requires the opportunity value.
      { key: 'isOpportunityValueRequired', label: 'Opportunity value required', fromLookupName: /\bwon\b/i },
      // { key: 'isRemarkMandatory', label: 'Remark mandatory', hint: 'A remark is required when an opportunity moves to this status', pending: true },
      // { key: 'isWon', label: 'Won (Order Value + Order Date required)', hint: 'Order Value and Order Date are required for this status', pending: true },
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
  businessEntityLocationTypes: createMasterApi({
    path: 'location-types',
    field: 'locationType',
    hasSequence: false,
    flags: [{ key: 'isDefault', label: 'Default', hint: 'Selected first for a new business entity address', inList: true }],
    label: 'Location type',
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
