import { useState, useEffect, type ReactNode } from 'react'
import { spectrumEntityId, useBusinessEntityOptions, type EntityOption } from '../components/useBusinessEntityOptions'
import EntityContactsFields, {
  contactDetailNos,
  fromContactEntries,
  type EntityContactsValue,
} from '../components/EntityContactsFields'
import { useLeadFormFillValues } from '../components/useLeadFormFillValues'
import { UserSelectField } from '../components/UserSelect'
import ProductPicker, { useProductCatalog } from '../components/ProductPicker'
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice'
import CurrencyAmountField from '../components/CurrencyAmountField'
import { bySequence, guessIsoCurrency } from '../api/fillValues'
import { buildLeadSaveBody, saveLead } from '../api/leads'
import { refreshServerLead } from '../api/leadSync'
import { toApiError } from '../api/errors'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'
import { useAuth } from '../auth/AuthContext'
import { saveConfirm, useConfirm } from '../contexts/ConfirmContext'
import {
  Lead,
  LeadCurrency,
  LeadPriority,
  displayLeadName,
  leadContactsOf,
  leadPriorityOf,
  leadProductList,
} from '../data/leads'
import { OptionLookupField, type LookupOption } from '../components/OptionLookupField'
import type { ActivityFormStatus } from '../data/activities'
import { productsFromLeadNames, type Product } from '../data/products'
import { matchesOperTaskType, type OperTaskType } from '../data/operTaskTypes'
import { Button, Card, ChoiceField, FormGrid, TableSearchSelectField, TextAreaField, TextField, type TableSearchColumn } from '../ui'
import { FIELD_LIMITS } from '../constants/fieldLimits'
import AttachmentsField from '../components/AttachmentsField'
import { LeadActivitiesPanel } from '../components/LeadActivities'
import { LeadNotesPanel } from '../components/LeadNotes'
import { useOptionalToast } from '../contexts/ToastContext'
import { ATTACHMENT_FORM_NO, type Attachment } from '../api/attachments'
import { formatDate, formatDateTime, toIsoDate } from '../utils/dateFormat'
import { BreadcrumbActions } from '../components/BreadcrumbActions'

const SPECTRUM_REQUIRED = 'Sign in with your Spectrum account to create or edit leads.'

const ACTIVITY_TYPE_COLUMNS: TableSearchColumn<OperTaskType>[] = [
  { header: 'Code', getValue: (t) => t.Code || '', width: '6.5rem' },
  { header: 'Activity Type', getValue: (t) => t['Task Type'], truncate: true },
]

interface CreateLeadProps {
  existing?: Lead | null
  onBack: () => void
  onSuccess: () => void
  embedded?: boolean
  prefillEntityId?: string
  prefillContactId?: string
  onCreated?: (lead: Lead) => void
}



/** An activity added to a new lead's list; sent with the lead save. */
interface AddedActivity {
  key: string
  typeNo: number
  typeName: string
  subject: string
  dueDate: string
  assignedTo: string
  assignToLoginNo?: number
  notesOutcome: string
  status: ActivityFormStatus
  closureDate: string
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-surface"
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

const SECTION_ICONS = {
  leadInfo: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  entity: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  classification: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  leadDetails: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  activity: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  notes: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  documents: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
} as const

/** Header tag for sections that may be left empty. */
function OptionalTag() {
  return <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-semibold text-ink-faint">Optional</span>
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <SectionIcon>{icon}</SectionIcon>
          <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  )
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function splitDateTime(value: string) {
  const trimmed = value.trim()
  if (trimmed.includes('T')) {
    const [isoDate, isoTime = ''] = trimmed.split('T')
    const [year, month, day] = isoDate.split('-')
    const date = year && month && day ? `${day}-${month}-${year}` : isoDate
    return { date, time: isoTime.slice(0, 5) }
  }
  const idx = trimmed.indexOf(' ')
  if (idx === -1) return { date: trimmed, time: '' }
  return { date: trimmed.slice(0, idx), time: trimmed.slice(idx + 1).trim() }
}

/** LeadNotesDetail.Discussion varchar(1000) */
const NOTE_DISCUSSION_MAX = FIELD_LIMITS.noteDiscussion

export default function CreateLead({ existing, onBack, onSuccess, embedded, prefillEntityId, prefillContactId, onCreated }: CreateLeadProps) {
  const isEdit = Boolean(existing)
  const confirm = useConfirm()
  const { addToast } = useOptionalToast()

  // Business entity + one primary and any number of secondary contacts (shared with the opportunity forms).
  const [entityContacts, setEntityContacts] = useState<EntityContactsValue>(() => {
    if (existing) return { entity: null, ...fromContactEntries(leadContactsOf(existing)) }
    return { entity: null, primary: null, secondary: [] }
  })
  const selectedEntity = entityContacts.entity
  /** Initial entity only (prefill / edit) — keeps the contacts already loaded. */
  const setSelectedEntity = (entity: EntityOption) => setEntityContacts((prev) => ({ ...prev, entity }))
  const entityField = useBusinessEntityOptions(selectedEntity)
  // Dropdowns come from the lead fill-values API only.
  const { values: fill } = useLeadFormFillValues()
  const spectrumCompany = useSpectrumCompany()
  // Saved through POST /api/crm/leads/save only: new leads, and edits of leads that came from the server.
  const serverRef = existing?.spectrum
  const saveToServer = Boolean(fill && spectrumCompany.headOfficeNo && (!isEdit || serverRef))
  // Numbers the server wants; the pickers report them alongside the names the form displays.
  const [ownerLoginNo, setOwnerLoginNo] = useState<number | undefined>(serverRef?.ownerLoginNo)
  const [assigneeLoginNo, setAssigneeLoginNo] = useState<number>()
  const [currencyNo, setCurrencyNo] = useState<number | undefined>(serverRef?.currencyNo)
  // Required by the lead save; the lead's own when editing, else the first from the fill values.
  const [salesOrganizationNo, setSalesOrganizationNo] = useState<number | undefined>(serverRef?.salesOrganizationNo)
  useEffect(() => {
    if (!fill || salesOrganizationNo) return
    const first = fill.salesOrganizations[0]
    if (first) setSalesOrganizationNo(first.salesOrganizationNo)
  }, [fill, salesOrganizationNo])
  // Name only in the dropdown, like source / stage / status.
  const salesOrganizationOptions: LookupOption[] = (fill?.salesOrganizations ?? []).map((x) => ({
    value: String(x.salesOrganizationNo),
    label: x.salesOrganizationName,
  }))
  const serverCurrencies = fill?.currencies ?? []
  useEffect(() => {
    // Default currency: flagged default, else the one that looks like INR, else the first.
    if (!fill || currencyNo) return
    const pick = fill.currencies.find((c) => c.isDefault)
      ?? fill.currencies.find((c) => guessIsoCurrency(c) === 'INR')
      ?? fill.currencies[0]
    if (pick) setCurrencyNo(pick.currencyNo)
  }, [fill, currencyNo])
  // Server lists only — empty until the fill values load.
  const sourceNames = fill ? fill.leadSources.map((x) => x.leadSourceName) : []
  const stageNames = fill ? bySequence(fill.leadStages).map((x) => x.leadStageName) : []
  const statusNames = fill ? fill.leadStatuses.map((x) => x.leadStatusName) : []
  // Lookup rows. Source / stage / status show the name only (no Code column); priority keeps its code.
  const sourceOptions: LookupOption[] = sourceNames.map((n) => ({ value: n, label: n }))
  const stageOptions: LookupOption[] = stageNames.map((n) => ({ value: n, label: n }))
  const statusOptions: LookupOption[] = statusNames.map((n) => ({ value: n, label: n }))
  const priorityOptions: LookupOption[] = (fill ? bySequence(fill.leadPriorities) : []).map((x) => ({
    value: x.leadPriorityName,
    label: x.leadPriorityName,
    code: x.code,
  }))
  const activityTypeOptions: OperTaskType[] = (fill?.leadActivityTypes ?? []).map((t) => ({
    OperTaskTypeNo: t.leadActivityTypeNo,
    'Task Type': t.leadActivityTypeName,
    Code: t.code,
  }))

  const [lead, setLead] = useState(() => existing ? {
    name: displayLeadName(existing),
    description: existing.description ?? existing.leadDescription ?? '',
    owner: existing.assignedSalesperson,
    priority: leadPriorityOf(existing),
    source: existing.leadSource,
    value: existing.opportunityValue ? String(existing.opportunityValue) : '',
    currency: (existing.valueCurrency ?? 'INR') as LeadCurrency,
    stage: existing.leadStage,
    status: existing.leadStatus,
  } : {
    name: '',
    description: '',
    owner: '',
    priority: 'Medium' as LeadPriority,
    source: '',
    value: '',
    currency: 'INR' as LeadCurrency,
    stage: 'New',
    status: 'Open',
  })
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(() =>
    existing ? productsFromLeadNames(leadProductList(existing)) : [],
  )
  const [selectedActivityType, setSelectedActivityType] = useState<OperTaskType | null>(null)
  const [activity, setActivity] = useState({
    subject: '',
    dueDate: '',
    assignedTo: '',
    notesOutcome: '',
    status: 'Open' as ActivityFormStatus,
    closureDate: '',
  })
  // New lead: activities added to the list (saved with the lead); the fields above hold the next one.
  const [addedActivities, setAddedActivities] = useState<AddedActivity[]>([])
  // A note starts with today's date and the logged-in user as Created By.
  const userName = useAuth().user?.name ?? ''
  const [noteDateTime, setNoteDateTime] = useState(() => toIsoDate())
  const [noteCreatedBy, setNoteCreatedBy] = useState(userName)
  const [noteDiscussion, setNoteDiscussion] = useState('')
  const [addedNotes, setAddedNotes] = useState<{ key: string; date: string; time: string; by: string; text: string; at: string }[]>([])
  // Uploaded to the document store as they are picked; the save links them by docNo.
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadsBusy, setUploadsBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selectedEntity) return
    // Editing a server lead: start from its saved entity (number + name).
    if (entityField.remote && existing?.companyName) {
      const no = existing.spectrum?.businessEntityNo
      setSelectedEntity({
        id: no ? spectrumEntityId(no) : `name:${existing.companyName}`,
        name: existing.companyName,
        type: '',
        city: '',
        source: 'spectrum',
        businessEntityNo: no,
      })
    }
  }, [existing, selectedEntity, entityField.remote])

  const productCatalog = useProductCatalog()
  // Editing with server products: swap saved names for the matching catalogue rows so they can't be added twice.
  useEffect(() => {
    if (!productCatalog.remote) return
    setSelectedProducts((prev) => {
      const next = prev.map((item) => productCatalog.products.find((p) => p.itemName === item.itemName) ?? item)
      return next.every((item, i) => item === prev[i]) ? prev : next
    })
  }, [productCatalog.remote, productCatalog.products])

  // New lead: if a default (New / Open / Medium) is not in the server lists, start on the first option.
  useEffect(() => {
    if (!fill || isEdit) return
    const stages = bySequence(fill.leadStages).map((x) => x.leadStageName)
    const statuses = fill.leadStatuses.map((x) => x.leadStatusName)
    const priorities = bySequence(fill.leadPriorities).map((x) => x.leadPriorityName)
    setLead((p) => ({
      ...p,
      stage: stages.length && !stages.includes(p.stage) ? stages[0]! : p.stage,
      status: statuses.length && !statuses.includes(p.status) ? statuses[0]! : p.status,
      priority: (priorities.length && !priorities.includes(p.priority) ? priorities[0]! : p.priority) as LeadPriority,
    }))
  }, [fill, isEdit])

  function updateLead(k: string, v: string) { setLead((p) => ({ ...p, [k]: v })); clearErr(k) }
  function clearErr(k: string) { setErrors((e) => { const n = { ...e }; delete n[k]; return n }) }

  function selectActivityType(item: OperTaskType | null) {
    setSelectedActivityType(item && item.OperTaskTypeNo !== 0 ? item : null)
    clearErr('activityType')
  }

  function updateActivity<K extends keyof typeof activity>(key: K, value: (typeof activity)[K]) {
    setActivity((prev) => ({ ...prev, [key]: value }))
    clearErr(key)
    if (key === 'status' || key === 'closureDate') clearErr('closureDate')
    if (key === 'subject') clearErr('subject')
    if (key === 'dueDate') clearErr('dueDate')
    if (key === 'assignedTo') clearErr('assignedTo')
  }

  function setActivityStatus(value: ActivityFormStatus) {
    setActivity((prev) => ({
      ...prev,
      status: value,
      closureDate: value === 'Closed' ? (prev.closureDate || todayIso()) : '',
    }))
    clearErr('status')
    clearErr('closureDate')
  }

  function activityDirty() {
    return selectedActivityType !== null
      || Boolean(activity.subject.trim())
      || Boolean(activity.dueDate)
      || Boolean(activity.assignedTo)
      || Boolean(activity.notesOutcome.trim())
      || activity.status === 'Closed'
      || Boolean(activity.closureDate)
  }

  /** Errors of the activity in the fields (type, subject, due date and assignee are needed). */
  function activityErrors(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!selectedActivityType) errs.activityType = 'Activity type is required'
    if (!activity.subject.trim()) errs.subject = 'Subject is required'
    if (!activity.dueDate) errs.dueDate = 'Due date is required'
    if (!activity.assignedTo) errs.assignedTo = 'Assigned to is required'
    if (activity.status === 'Closed' && !activity.closureDate) errs.closureDate = 'Closure date is required when status is Closed'
    return errs
  }

  function resetActivityFields() {
    setSelectedActivityType(null)
    setActivity({ subject: '', dueDate: '', assignedTo: '', notesOutcome: '', status: 'Open', closureDate: '' })
    setAssigneeLoginNo(undefined)
    for (const key of ['activityType', 'subject', 'dueDate', 'assignedTo', 'closureDate']) clearErr(key)
  }

  function addLeadActivity() {
    const errs = activityErrors()
    if (Object.keys(errs).length || !selectedActivityType) {
      setErrors((prev) => ({ ...prev, ...errs }))
      return
    }
    setAddedActivities((prev) => [
      ...prev,
      {
        key: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        typeNo: selectedActivityType.OperTaskTypeNo,
        typeName: selectedActivityType['Task Type'],
        subject: activity.subject.trim(),
        dueDate: activity.dueDate,
        assignedTo: activity.assignedTo,
        assignToLoginNo: assigneeLoginNo,
        notesOutcome: activity.notesOutcome.trim(),
        status: activity.status,
        closureDate: activity.closureDate,
      },
    ])
    resetActivityFields()
  }

  /** Move a listed activity back into the fields to change it (it is re-added with Add Activity). */
  function editLeadActivity(key: string) {
    const item = addedActivities.find((a) => a.key === key)
    if (!item) return
    if (activityDirty()) {
      addToast('info', 'Finish the current activity', 'Add or clear the activity being typed before editing another one.')
      return
    }
    setSelectedActivityType(
      activityTypeOptions.find((t) => t.OperTaskTypeNo === item.typeNo) ?? { OperTaskTypeNo: item.typeNo, 'Task Type': item.typeName, Code: '' },
    )
    setActivity({
      subject: item.subject,
      dueDate: item.dueDate,
      assignedTo: item.assignedTo,
      notesOutcome: item.notesOutcome,
      status: item.status,
      closureDate: item.closureDate,
    })
    setAssigneeLoginNo(item.assignToLoginNo)
    setAddedActivities((prev) => prev.filter((a) => a.key !== key))
  }

  function removeLeadActivity(key: string) {
    setAddedActivities((prev) => prev.filter((item) => item.key !== key))
  }

  function addLeadNote() {
    const dateTime = noteDateTime.trim()
    const by = noteCreatedBy.trim()
    const text = noteDiscussion.trim()
    const errs: Record<string, string> = {}
    if (!dateTime) errs.noteDateTime = 'Date/Time is required'
    if (!by) errs.noteCreatedBy = 'Created by is required'
    if (!text) errs.noteDiscussion = 'Note / discussion is required'
    else if (noteDiscussion.length > NOTE_DISCUSSION_MAX) {
      errs.noteDiscussion = `Note / discussion cannot exceed ${NOTE_DISCUSSION_MAX} characters`
    }
    if (Object.keys(errs).length) {
      setErrors((prev) => ({ ...prev, ...errs }))
      return
    }
    const { date, time } = splitDateTime(dateTime)
    setAddedNotes((prev) => [
      ...prev,
      {
        key: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date,
        time,
        by,
        text,
        at: dateTime,
      },
    ])
    setNoteDateTime(toIsoDate())
    setNoteCreatedBy(userName)
    setNoteDiscussion('')
    clearErr('noteDateTime')
    clearErr('noteCreatedBy')
    clearErr('noteDiscussion')
  }

  /** Move a listed note back into the fields to change it (it is re-added with Add Note). */
  function editLeadNote(key: string) {
    const item = addedNotes.find((n) => n.key === key)
    if (!item) return
    if (notesDirty()) {
      addToast('info', 'Finish the current note', 'Add or clear the note being typed before editing another one.')
      return
    }
    setNoteDateTime(item.at)
    setNoteCreatedBy(item.by)
    setNoteDiscussion(item.text)
    setAddedNotes((prev) => prev.filter((n) => n.key !== key))
  }

  function removeLeadNote(key: string) {
    setAddedNotes((prev) => prev.filter((item) => item.key !== key))
  }

  /** Date and Created By are pre-filled, so only the discussion text starts a note. */
  function notesDirty() {
    return Boolean(noteDiscussion.trim())
  }

  // Activity / notes are optional: their fields are required only once the user starts filling them.
  const activityActive = activityDirty()
  const notesActive = notesDirty()

  function validate() {
    const errs: Record<string, string> = {}
    if (!lead.name.trim()) errs.name = 'Lead name is required'
    if (!selectedEntity) errs.entity = 'Select a business entity'
    if (!entityContacts.primary?.name.trim()) errs.contact = 'Select the primary contact person'
    if (!lead.owner) errs.owner = 'Lead owner is required'
    if (!selectedProducts.length) errs.products = 'Select at least one product'
    // New lead: an activity typed in but not added yet is saved too, so it must be complete.
    // (Edit: activities are managed in the panel and saved on their own.)
    if (!isEdit && activityDirty()) Object.assign(errs, activityErrors())
    if (!isEdit && notesDirty()) {
      if (!noteDateTime.trim()) errs.noteDateTime = 'Date/Time is required'
      if (!noteCreatedBy.trim()) errs.noteCreatedBy = 'Created by is required'
      if (!noteDiscussion.trim()) errs.noteDiscussion = 'Note / discussion is required'
      else if (noteDiscussion.length > NOTE_DISCUSSION_MAX) {
        errs.noteDiscussion = `Note / discussion cannot exceed ${NOTE_DISCUSSION_MAX} characters`
      }
    }
    return errs
  }

  /** Posts the lead to the server. Returns its lead number, or null (having shown why) on failure. */
  async function saveLeadToServer(): Promise<number | null> {
    if (!fill || !spectrumCompany.headOfficeNo) return null
    const pendingNote = !isEdit && noteDateTime.trim() && noteCreatedBy.trim() && noteDiscussion.trim()
      ? [{ originatedBy: noteCreatedBy, notesDate: new Date(noteDateTime), notesDiscussion: noteDiscussion.slice(0, NOTE_DISCUSSION_MAX) }]
      : []
    const built = buildLeadSaveBody({
      leadNo: serverRef?.leadNo,
      companyNo: spectrumCompany.headOfficeNo,
      leadName: lead.name,
      description: lead.description,
      leadDate: serverRef?.leadDate ? new Date(serverRef.leadDate) : new Date(),
      ownerLoginNo,
      sourceName: lead.source,
      stageName: lead.stage,
      statusName: lead.status,
      priorityName: lead.priority,
      salesOrganizationNo,
      currencyNo,
      estimatedAmount: lead.value ? Number(lead.value) || 0 : undefined,
      businessEntityNo: selectedEntity?.businessEntityNo,
      contactPersonDetailNo: contactDetailNos(entityContacts)[0],
      otherContactPersonDetailNos: contactDetailNos(entityContacts).slice(1),
      productNos: selectedProducts.map((item) => item.id),
      activities: isEdit ? undefined : [
        ...addedActivities.map((a) => ({
          typeNo: a.typeNo,
          subject: a.subject,
          dueDate: a.dueDate,
          assignToLoginNo: a.assignToLoginNo,
          notesOutcome: a.notesOutcome,
          statusName: a.status,
          closureDate: a.status === 'Closed' ? a.closureDate : undefined,
        })),
        ...(activityDirty()
          ? [{
              typeNo: selectedActivityType?.OperTaskTypeNo,
              subject: activity.subject,
              dueDate: activity.dueDate,
              assignToLoginNo: assigneeLoginNo,
              notesOutcome: activity.notesOutcome,
              statusName: activity.status,
              closureDate: activity.status === 'Closed' ? activity.closureDate : undefined,
            }]
          : []),
      ],
      notes: [
        ...addedNotes.map((n) => ({ originatedBy: n.by, notesDate: new Date(n.at), notesDiscussion: n.text })),
        ...pendingNote,
      ],
      attachmentNos: attachments.map((a) => a.id),
    }, fill)
    if (built.errors) {
      setErrors(built.errors)
      return null
    }
    try {
      return await saveLead(built.body)
    } catch (error) {
      setErrors({ form: `Could not save the lead: ${toApiError(error).message}` })
      return null
    }
  }

  /** Server path: save (linking the uploaded attachments), then reload the lead from load-data into the store. */
  async function handleServerSave() {
    const leadNo = await saveLeadToServer()
    if (!leadNo) {
      setSaving(false)
      return
    }
    let saved
    try {
      saved = await refreshServerLead(leadNo)
    } catch (error) {
      // Saved on the server; only the reload failed — the list will pick it up on its next sync.
      setErrors({ form: `Lead saved, but it could not be reloaded: ${toApiError(error).message}` })
      setSaving(false)
      return
    }
    if (!isEdit) onCreated?.(saved)
    setTimeout(() => { setSubmitted(true); setTimeout(onSuccess, embedded ? 700 : 1600) }, 300)
  }

  async function handleSave() {
    if (saving) return
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (uploadsBusy) {
      setErrors({ form: 'Please wait for all attachments to finish uploading before saving the lead.' })
      return
    }
    if (!(await confirm(saveConfirm('Lead', isEdit)))) return
    setSaving(true)
    // Leads are saved on the server only (no in-app copies).
    if (!saveToServer) {
      setErrors({ form: SPECTRUM_REQUIRED })
      setSaving(false)
      return
    }
    await handleServerSave()
  }

  if (submitted) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-sm px-10 py-12 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="ui-title mb-1 text-lg">{isEdit ? 'Lead Updated!' : 'Lead Created!'}</h2>
          <p className="ui-subtitle mb-6 text-sm">
            {selectedEntity?.name || 'Lead'} has been {isEdit ? 'saved' : 'added to your pipeline'}.
          </p>
          <p className="text-xs text-ink-faint">Redirecting…</p>
        </Card>
          </div>
    )
  }

  return (
    <div className="bg-canvas form-labels-as-written">
      <div className="page-gutter py-4 pb-4">
        {!embedded && (
        <div className="mb-5">
          <button
            type="button"
            onClick={onBack}
              className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Leads
          </button>
            <h1 className="ui-title text-xl">{isEdit ? 'Edit Lead' : 'Create Lead'}</h1>
            <p className="ui-subtitle mt-0.5 text-xs">
              {isEdit ? `Editing ${existing?.id}` : 'Add a new sales lead to your pipeline'}
            </p>
        </div>
        )}

        <div className="space-y-5">
          <SpectrumRequiredNotice what="Leads and their lists" />
          <Section title="Lead Info" icon={SECTION_ICONS.leadInfo}>
            <FormGrid>
              <TextField
                fieldClassName="lg:col-span-2"
                label="Lead Name"
                maxLength={FIELD_LIMITS.leadName}
                required
                error={errors.name}
                value={lead.name}
                onValueChange={(v) => updateLead('name', v)}
                placeholder="Enter Lead Name"
              />
              <TextAreaField
                fieldClassName="lg:col-span-2"
                label="Lead Description"
                maxLength={FIELD_LIMITS.leadDescription}
                rows={3}
                value={lead.description}
                onValueChange={(v) => updateLead('description', v)}
                placeholder="Enter description"
              />
            </FormGrid>
          </Section>

          <Section title="Business Entity" icon={SECTION_ICONS.entity}>
            <EntityContactsFields
              value={entityContacts}
              onChange={(next) => {
                setEntityContacts(next)
                clearErr('entity')
                clearErr('contact')
              }}
              errors={{ entity: errors.entity, contact: errors.contact }}
            />
          </Section>

          <Section title="Lead Classification" icon={SECTION_ICONS.classification}>
            <FormGrid cols={4}>
              <OptionLookupField
                label="Lead Source"
                required={saveToServer}
                error={errors.source}
                placeholder="Select source"
                options={sourceOptions}
                value={lead.source}
                onValueChange={(v) => updateLead('source', v)}
              />
              <OptionLookupField
                label="Lead Stage"
                error={errors.stage}
                placeholder="Select stage"
                options={stageOptions}
                value={lead.stage}
                onValueChange={(v) => updateLead('stage', v)}
              />
              <OptionLookupField
                label="Lead Status"
                error={errors.status}
                placeholder="Select status"
                options={statusOptions}
                value={lead.status}
                onValueChange={(v) => updateLead('status', v)}
              />
              <OptionLookupField
                label="Sales Organization"
                required={saveToServer}
                error={errors.salesOrganization}
                placeholder="Select sales organization"
                options={salesOrganizationOptions}
                // Empty until the options load, so the number never shows in place of the name.
                value={salesOrganizationNo && salesOrganizationOptions.length ? String(salesOrganizationNo) : ''}
                onValueChange={(v) => { setSalesOrganizationNo(Number(v) || undefined); clearErr('salesOrganization') }}
              />
            </FormGrid>
          </Section>

          <Section title="Lead Details" icon={SECTION_ICONS.leadDetails}>
            <FormGrid cols={3}>
              <div className="lg:col-span-3">
                <ProductPicker
                  catalog={productCatalog.products}
                  showUnit={!productCatalog.remote}
                  required
                  error={errors.products}
                  selected={selectedProducts}
                  onChange={(next) => {
                    setSelectedProducts(next)
                    clearErr('products')
                  }}
                />
              </div>
              <div className="lg:col-span-1">
                <CurrencyAmountField
                  label="Estimated Value"
                  amount={lead.value}
                  onAmountChange={(v) => updateLead('value', v)}
                  currencies={serverCurrencies}
                  currencyNo={currencyNo}
                  onCurrencyNoChange={(no) => {
                    setCurrencyNo(no)
                    const picked = serverCurrencies.find((c) => c.currencyNo === no)
                    if (picked) setLead((p) => ({ ...p, currency: guessIsoCurrency(picked) }))
                  }}
                />
              </div>
              <OptionLookupField
                label="Lead Priority"
                error={errors.priority}
                placeholder="Select priority"
                options={priorityOptions}
                value={lead.priority}
                onValueChange={(v) => setLead((p) => ({ ...p, priority: v as LeadPriority }))}
              />
              <UserSelectField label="Lead Owner" required error={errors.owner} placeholder="Select owner" value={lead.owner} onValueChange={(v, no) => { updateLead('owner', v); setOwnerLoginNo(no) }} />
            </FormGrid>
          </Section>

          {isEdit && existing ? (
            // Edit: the lead's activities, managed as on the lead view (saved straight away).
            <Section title="Activities" icon={SECTION_ICONS.activity}>
              <LeadActivitiesPanel lead={existing} onToast={addToast} />
            </Section>
          ) : (
          <Section title="Activity Details" icon={SECTION_ICONS.activity}>
            <FormGrid>
              <div className="lg:col-span-1">
                <TableSearchSelectField
                  label="Type"
                  required={activityActive}
                  error={errors.activityType}
                  options={activityTypeOptions}
                  value={selectedActivityType}
                  onChange={selectActivityType}
                  getKey={(item) => String(item.OperTaskTypeNo)}
                  getLabel={(item) => item['Task Type']}
                  filterItem={matchesOperTaskType}
                  columns={ACTIVITY_TYPE_COLUMNS}
                  placeholder="Search activity type"
                  searchPlaceholder="Search"
                  emptyText="No matching types"
                />
              </div>
              <TextField
                fieldClassName="lg:col-span-1"
                label="Subject"
                maxLength={FIELD_LIMITS.activitySubject}
                required={activityActive}
                error={errors.subject}
                value={activity.subject}
                onValueChange={(v) => updateActivity('subject', v)}
                placeholder="Enter subject"
              />
              <TextField
                label="Due Date"
                required={activityActive}
                type="date"
                error={errors.dueDate}
                value={activity.dueDate}
                onValueChange={(v) => updateActivity('dueDate', v)}
              />
              <UserSelectField
                label="Assigned To"
                required={activityActive}
                error={errors.assignedTo}
                placeholder="Select assignee"
                value={activity.assignedTo}
                onValueChange={(v, no) => { updateActivity('assignedTo', v); setAssigneeLoginNo(no) }}
              />
              <TextAreaField
                fieldClassName="lg:col-span-2"
                label="Notes / Outcome"
                maxLength={FIELD_LIMITS.activityNotesOutcome}
                rows={4}
                value={activity.notesOutcome}
                onValueChange={(v) => updateActivity('notesOutcome', v)}
                placeholder="Notes, discussion, or outcome…"
              />
              <ChoiceField
                label="Status"
                name="lead-form-activity-status"
                layout="radio"
                options={['Open', 'Closed'] as const}
                value={activity.status}
                onChange={setActivityStatus}
              />
              {activity.status === 'Closed' ? (
                <TextField
                  label="Closure Date"
                  required
                  type="date"
                  error={errors.closureDate}
                  value={activity.closureDate}
                  onValueChange={(v) => updateActivity('closureDate', v)}
                />
              ) : null}
            </FormGrid>
            <div className="mt-3 flex justify-end">
              <Button variant="solid" className="!min-h-8 !px-3 !py-2 text-xs" onClick={addLeadActivity}>
                Add Activity
              </Button>
            </div>
            {addedActivities.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {addedActivities.map((item) => (
                  <Card key={item.key} className="min-w-0 !shadow-none">
                    <div className="flex items-start gap-1 bg-gray-200 p-2 pb-0.5 rounded-t-xl">
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{item.subject}</p>
                      <Button
                        variant="icon"
                        className="!h-6 !w-6 shrink-0"
                        aria-label={`Edit activity ${item.subject}`}
                        onClick={() => editLeadActivity(item.key)}
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button
                        variant="icon"
                        className="!h-6 !w-6 shrink-0"
                        aria-label={`Remove activity ${item.subject}`}
                        onClick={() => removeLeadActivity(item.key)}
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                    <div className="p-2 pt-1">
                    <p className="truncate text-xs text-ink-faint">{item.typeName} · Due {formatDate(item.dueDate)} · {item.status}</p>
                    <p className="truncate text-xs text-ink-soft">{item.assignedTo}</p>
                    {item.notesOutcome ? <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{item.notesOutcome}</p> : null}
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}
          </Section>
          )}

          {!isEdit ? (
            <Section title="Internal Notes / Observations" icon={SECTION_ICONS.notes} >
              <FormGrid>
                <TextField
                  label="Date"
                  required={notesActive}
                  type="date"
                  error={errors.noteDateTime}
                  value={noteDateTime}
                  onValueChange={(v) => { setNoteDateTime(v); clearErr('noteDateTime') }}
                />
                {/* Server users; the note's `originatedBy` is saved as the picked user's name. */}
                <UserSelectField
                  label="Created By"
                  required={notesActive}
                  error={errors.noteCreatedBy}
                  value={noteCreatedBy}
                  placeholder="Select user"
                  onValueChange={(v) => { setNoteCreatedBy(v); clearErr('noteCreatedBy') }}
                />
                <TextAreaField
                  fieldClassName="lg:col-span-2"
                  label="Note / Discussion"
                  required={notesActive}
                  error={errors.noteDiscussion}
                  rows={4}
                  maxLength={NOTE_DISCUSSION_MAX}
                  value={noteDiscussion}
                  onValueChange={(v) => { setNoteDiscussion(v.slice(0, NOTE_DISCUSSION_MAX)); clearErr('noteDiscussion') }}
                  placeholder="Enter internal discussion note"
                />
              </FormGrid>
              <div className="mt-3 flex justify-end">
                <Button variant="solid" className="!min-h-8 !px-3 !py-2 text-xs" onClick={addLeadNote}>
                  Add Note
                </Button>
              </div>
              {addedNotes.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {addedNotes.map((item) => (
                    <Card key={item.key} className="min-w-0 !shadow-none">
                      <div className="flex items-start bg-gray-200 p-2 pb-0.5 rounded-t-xl gap-1">
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{item.by}</p>
                        <Button
                          variant="icon"
                          className="!h-6 !w-6 shrink-0"
                          aria-label="Edit note"
                          onClick={() => editLeadNote(item.key)}
                        >
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        </Button>
                        <Button
                          variant="icon"
                          className="!h-6 !w-6 shrink-0"
                          aria-label="Remove note"
                          onClick={() => removeLeadNote(item.key)}
                        >
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
            </div>
                    <div className="p-2 5">
                      <p className="text-xs text-ink-faint">{formatDateTime(item.at)}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-ink-soft">{item.text}</p>
                    </div>
                    </Card>
                  ))}
                </div>
              ) : null}
          </Section>
          ) : existing ? (
            // Edit: the lead's saved notes, added and deleted straight away (as on the lead view).
            <Section title="Internal Notes / Observations" icon={SECTION_ICONS.notes}>
              <LeadNotesPanel lead={existing} onToast={addToast} />
            </Section>
          ) : null}

          <Section title="Documents / Attachments" icon={SECTION_ICONS.documents}>
            <AttachmentsField
              noun="lead"
              formNo={ATTACHMENT_FORM_NO.lead}
              companyNo={spectrumCompany.headOfficeNo}
              value={attachments}
              onChange={setAttachments}
              transactionId={serverRef?.leadNo}
              onBusyChange={setUploadsBusy}
            />
          </Section>

          {Object.keys(errors).length > 0 && (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3" role="alert">
              <p className="text-xs w-full font-bold text-accent">Please fix the following before saving:</p>
                <ul className="space-y-0.5 w-full">
                {Object.values(errors).map((item) => (
                  <li key={item} className="text-xs text-accent">• {item}</li>
                  ))}
                </ul>
            </div>
          )}

          {/* Cancel / Save at the right of the breadcrumb line (in place inside the Quick Create drawer). */}
          <BreadcrumbActions inline={embedded}>
            <Button variant="secondary" onClick={onBack}>Cancel</Button>
            <div className="flex items-center gap-2.5">
              {/* Save as Draft — hidden for now (no draft API yet).
              <Button variant="secondary">Save as Draft</Button>
              */}
              <Button variant="solid" onClick={handleSave} disabled={saving || !saveToServer}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Lead'}
              </Button>
            </div>
          </BreadcrumbActions>
        </div>
      </div>
    </div>
  )
}
