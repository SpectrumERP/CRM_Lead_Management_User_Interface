import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { useMasterData } from '../contexts/MasterDataContext'
import { useCrmActions, useCrmSelector } from '../contexts/CrmStoreContext'
import { api } from '../api/crm'
import { useApiQuery } from '../api/useApiQuery'
import {
  Lead,
  LeadCurrency,
  LeadPriority,
  LeadSource,
  LeadStage,
  LeadStatus,
  LEAD_PRIORITIES,
  displayLeadName,
  leadContactsOf,
  leadPriorityOf,
  leadProductList,
} from '../data/leads'
import type { Contact } from '../data/contacts'
import { MAIN_CURRENCIES, currencyAmountPrefix, findCurrency, matchesCurrency } from '../data/currencies'
import type { DocFileType } from '../data/documents'
import {
  ACTIVITY_TYPES,
  SALESPERSONS,
  toStoredActivityStatus,
  type ActivityFormStatus,
  type ActivityType,
} from '../data/activities'
import { PRODUCTS, matchesProduct, productLine, productUnit, productsFromLeadNames, type Product } from '../data/products'
import { SELECTABLE_OPER_TASK_TYPES, matchesOperTaskType, type OperTaskType } from '../data/operTaskTypes'
import { Button, Card, ChoiceField, FormGrid, IconTooltip, SearchSelect, SearchSelectField, SelectField, TableSearchSelectField, Tag, TextAreaField, TextField, TextInput } from '../ui'

type DraftContact = {
  key: string
  name: string
  email: string
  phones: string[]
  primary: boolean
}

function emptyContact(): DraftContact {
  return { key: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: '', email: '', phones: [''], primary: true }
}

interface CreateLeadProps {
  existing?: Lead | null
  onBack: () => void
  onSuccess: () => void
  embedded?: boolean
  prefillEntityId?: string
  prefillContactId?: string
  onCreated?: (lead: Lead) => void
}

type EntityOption = { id: string; name: string; type: string; city: string }
type ContactOption = { id: string; name: string; designation: string; company: string }

interface UploadedFile { name: string; size: number; type: string }

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

function RecordRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted px-3 py-2.5">
      <p className="text-xs font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-ink-faint">{meta}</p>
    </div>
  )
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fileKind(name: string, type: string): { label: string; className: string } {
  if (type.includes('pdf') || /\.pdf$/i.test(name)) return { label: 'PDF', className: 'bg-accent-soft text-accent' }
  if (type.includes('image') || /\.(png|jpe?g|gif|webp)$/i.test(name)) return { label: 'IMG', className: 'bg-success-soft text-success' }
  if (type.includes('word') || /\.docx?$/i.test(name)) return { label: 'DOC', className: 'bg-primary-soft text-primary' }
  if (type.includes('sheet') || type.includes('excel') || /\.xlsx?$/i.test(name)) return { label: 'XLS', className: 'bg-success-soft text-success' }
  return { label: 'FILE', className: 'bg-surface-hover text-ink-soft' }
}

function toDocType(name: string): DocFileType {
  if (/\.pdf$/i.test(name)) return 'PDF'
  if (/\.docx?$/i.test(name)) return 'DOCX'
  if (/\.xlsx?$/i.test(name)) return 'XLSX'
  if (/\.pptx?$/i.test(name)) return 'PPTX'
  return 'IMG'
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

const NOTE_DISCUSSION_MAX = 1000

function mapOperTypeToActivityType(type: OperTaskType | null): ActivityType {
  const name = type?.['Task Type']
  if (name && (ACTIVITY_TYPES as readonly string[]).includes(name)) return name as ActivityType
  return 'Other'
}

export default function CreateLead({ existing, onBack, onSuccess, embedded, prefillEntityId, prefillContactId, onCreated }: CreateLeadProps) {
  const isEdit = Boolean(existing)
  const { activeLeadSourceNames, activeLeadStageNames, activeLeadStatusNames } = useMasterData()
  const { addLead, patchLead, addContact, addActivity, addNote, addDocument } = useCrmActions()
  const leadRecordId = useRef(existing?.id ?? `LID-${Date.now()}`).current
  const { data: entityPage } = useApiQuery(() => api.entities.list(), [])
  const { data: contactPage } = useApiQuery(() => api.contacts.list(), [])
  const entities = entityPage?.items ?? []
  const allContacts = contactPage?.items ?? []
  const existingEntities: EntityOption[] = entities.map((e) => ({
  id: e.id,
  name: e.name,
  type: e.type,
  city: e.locations[0]?.city ?? '',
  }))
  const existingContacts: ContactOption[] = allContacts.map((c) => ({
  id: c.id,
  name: c.name,
  designation: c.designation,
  company: c.businessEntityName,
  }))

  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(
    () => existingEntities.find((e) =>
      e.id === prefillEntityId
      || (existing ? e.name === existing.companyName : false),
    ) ?? null,
  )

  const [leadContacts, setLeadContacts] = useState<DraftContact[]>(() => {
    if (existing) {
      const primary = leadContactsOf(existing).find((item) => item.primary) ?? leadContactsOf(existing)[0]
      if (!primary) return [emptyContact()]
      return [{
        key: 'primary',
        name: primary.name,
        email: primary.email,
        phones: primary.phones.length ? primary.phones : [''],
        primary: true,
      }]
    }
    const prefill = existingContacts.find((c) => c.id === prefillContactId)
    const linked = prefill ? allContacts.find((c) => c.id === prefill.id) : undefined
    if (linked) {
      return [{
        key: linked.id,
        name: linked.name,
        email: linked.email,
        phones: linked.mobile ? [linked.mobile] : [''],
        primary: true,
      }]
    }
    return [emptyContact()]
  })

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
  const [noteDateTime, setNoteDateTime] = useState('')
  const [noteCreatedBy, setNoteCreatedBy] = useState('')
  const [noteDiscussion, setNoteDiscussion] = useState('')
  const [addedNotes, setAddedNotes] = useState<{ key: string; date: string; time: string; by: string; text: string }[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selectedEntity) return
    const found = existingEntities.find((e) =>
      e.id === prefillEntityId
      || (existing ? e.name === existing.companyName : false),
    )
    if (found) setSelectedEntity(found)
  }, [existingEntities, existing, prefillEntityId, selectedEntity])

  const storeDocuments = useCrmSelector((state) => state.documents)
  const relatedDocuments = storeDocuments.filter((item) => item.relatedId === leadRecordId)

  const contactsForEntity = selectedEntity
    ? existingContacts.filter((c) => c.company === selectedEntity.name || allContacts.find((x) => x.id === c.id)?.businessEntityId === selectedEntity.id)
    : existingContacts
  const draftContact = leadContacts[0]
  const selectedContact =
    contactsForEntity.find((c) => c.id === draftContact?.key || c.name === draftContact?.name)
    ?? (draftContact?.name
      ? { id: draftContact.key, name: draftContact.name, designation: '', company: selectedEntity?.name ?? '' }
      : null)
  const contactOptions = selectedContact && !contactsForEntity.some((c) => c.id === selectedContact.id)
    ? [selectedContact, ...contactsForEntity]
    : contactsForEntity

  const availableProducts = PRODUCTS.filter((item) => !selectedProducts.some((selected) => selected.id === item.id))

  /** Active master values, plus the lead's current value if it has since been deactivated. */
  function withCurrent(names: string[], current: string) {
    return current && !names.includes(current) ? [current, ...names] : names
  }

  function updateLead(k: string, v: string) { setLead((p) => ({ ...p, [k]: v })); clearErr(k) }
  function clearErr(k: string) { setErrors((e) => { const n = { ...e }; delete n[k]; return n }) }

  function setContact(option: ContactOption | null) {
    if (!option) {
      setLeadContacts([emptyContact()])
      return
    }
    const linked = allContacts.find((c) => c.id === option.id)
    setLeadContacts([{
      key: option.id,
      name: option.name,
      email: linked?.email ?? '',
      phones: linked?.mobile ? [linked.mobile] : [''],
      primary: true,
    }])
    clearErr('contact')
  }

  function addProduct(item: Product | null) {
    if (!item) return
    setSelectedProducts((prev) => prev.some((row) => row.id === item.id) ? prev : [...prev, item])
    clearErr('products')
  }

  function removeProduct(id: number) {
    setSelectedProducts((prev) => prev.filter((item) => item.id !== id))
  }

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

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return
    const next: UploadedFile[] = Array.from(list).map((f) => ({ name: f.name, size: f.size, type: f.type || 'application/octet-stream' }))
    setFiles((p) => [...p, ...next])
  }, [])

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
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
      },
    ])
    setNoteDateTime('')
    setNoteCreatedBy('')
    setNoteDiscussion('')
    clearErr('noteDateTime')
    clearErr('noteCreatedBy')
    clearErr('noteDiscussion')
  }

  function removeLeadNote(key: string) {
    setAddedNotes((prev) => prev.filter((item) => item.key !== key))
  }

  function notesDirty() {
    return Boolean(noteDateTime.trim() || noteCreatedBy.trim() || noteDiscussion.trim())
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!lead.name.trim()) errs.name = 'Lead name is required'
    if (!selectedEntity) errs.entity = 'Select a business entity'
    if (!draftContact?.name.trim()) errs.contact = 'Select a contact person'
    if (!lead.owner) errs.owner = 'Lead owner is required'
    if (!selectedProducts.length) errs.products = 'Select at least one product'
    if (activityDirty()) {
      if (!activity.subject.trim()) errs.subject = 'Subject is required'
      if (!activity.dueDate) errs.dueDate = 'Due date is required'
      if (!activity.assignedTo) errs.assignedTo = 'Assigned to is required'
      if (activity.status === 'Closed' && !activity.closureDate) errs.closureDate = 'Closure date is required when status is Closed'
    }
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

  function handleSave() {
    if (saving) return
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const companyName = selectedEntity?.name ?? ''
    const contacts = leadContacts
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        email: item.email.trim(),
        phones: item.phones.map((phone) => phone.trim()).filter(Boolean),
        primary: true,
      }))
    const primary = contacts[0]
    contacts.forEach((item, index) => {
      if (allContacts.some((c) => c.name === item.name && c.businessEntityName === companyName)) return
      addContact({
        id: `CON-${Date.now()}-${index}`,
        name: item.name,
        businessEntityId: selectedEntity?.id ?? '',
        businessEntityName: companyName,
        designation: '',
        department: '',
        mobile: item.phones[0] ?? '',
        email: item.email,
        locationLabel: '',
        isPrimary: true,
        status: 'Active',
        remarks: '',
        createdDate: new Date().toISOString().slice(0, 10),
        lastActivity: 'Just now',
      } satisfies Contact)
    })
    const productNames = selectedProducts.map((item) => item.itemName)
    const payload: Lead = {
      id: leadRecordId,
      leadName: lead.name.trim() || `${companyName} — ${productNames.join(', ')}`,
      companyName,
      contactPerson: primary?.name ?? '',
      email: primary?.email || '',
      phone: primary?.phones[0] ?? '',
      leadSource: (lead.source || activeLeadSourceNames[0] || 'Inbound') as LeadSource,
      leadStage: (lead.stage || 'New') as LeadStage,
      leadStatus: (lead.status || 'Open') as LeadStatus,
      productsRequired: productNames.join(', '),
      productTypes: productNames,
      contacts,
      priority: lead.priority,
      valueCurrency: lead.currency,
      opportunityValue: Number(String(lead.value).replace(/[^\d]/g, '')) || 0,
      assignedSalesperson: lead.owner || existing?.assignedSalesperson || 'Priya Mehta',
      lastActivity: existing?.lastActivity ?? 'Just now',
      createdAt: existing?.createdAt ?? new Date().toISOString().slice(0, 10),
      description: lead.description.trim() || undefined,
      leadDescription: lead.description.trim() || undefined,
    }
    files.forEach((file, index) => {
      addDocument({
        id: `DOC-${Date.now()}-${index}`,
        name: file.name,
        fileType: toDocType(file.name),
        size: formatBytes(file.size),
        relatedId: leadRecordId,
        relatedType: 'lead',
        relatedName: companyName,
        uploadedBy: payload.assignedSalesperson,
        uploadedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        category: 'General',
      })
    })
    if (activityDirty()) {
      const typeLine = selectedActivityType?.['Task Type'] ?? ''
      const notes = [typeLine ? `Type: ${typeLine}` : '', activity.notesOutcome.trim()].filter(Boolean).join('\n')
      addActivity({
        id: `ACT-${Date.now()}`,
        type: mapOperTypeToActivityType(selectedActivityType),
        subject: activity.subject.trim(),
        leadId: leadRecordId,
        leadName: payload.leadName,
        contactPerson: payload.contactPerson,
        assignedTo: activity.assignedTo,
        scheduleDate: activity.dueDate,
        scheduleTime: '',
        reminder: 'None',
        notes,
        status: toStoredActivityStatus(activity.status),
        outcome: activity.status === 'Closed' ? activity.notesOutcome.trim() : '',
        completeDate: activity.status === 'Closed' ? activity.closureDate : '',
        completeTime: '',
        hasAttachment: false,
      })
    }
    if (!isEdit) {
      const notesToSave = [...addedNotes]
      if (noteDateTime.trim() && noteCreatedBy.trim() && noteDiscussion.trim()) {
        const { date, time } = splitDateTime(noteDateTime)
        notesToSave.push({
          key: `note-save-${Date.now()}`,
          date,
          time,
          by: noteCreatedBy.trim(),
          text: noteDiscussion.trim().slice(0, NOTE_DISCUSSION_MAX),
        })
      }
      notesToSave.forEach((item, index) => {
        addNote({
          id: `NOTE-${Date.now()}-${index}`,
          title: 'Internal note',
          text: item.text,
          relatedLeadId: leadRecordId,
          relatedLeadName: payload.leadName,
          date: `${item.date} ${item.time}`,
          by: item.by,
        })
      })
    }
    if (isEdit && existing) {
      patchLead(existing.id, payload)
    } else {
      onCreated?.(payload)
      addLead(payload)
    }
    setTimeout(() => { setSubmitted(true); setTimeout(onSuccess, embedded ? 700 : 1600) }, 600)
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
    <div className="bg-canvas">
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
          <Section title="Lead Info" icon={SECTION_ICONS.leadInfo}>
            <FormGrid>
              <TextField
                fieldClassName="lg:col-span-2"
                label="Lead Name"
                required
                error={errors.name}
                value={lead.name}
                onValueChange={(v) => updateLead('name', v)}
                placeholder="Each lead will have a name"
              />
              <TextAreaField
                fieldClassName="lg:col-span-2"
                label="Lead Description"
                rows={3}
                value={lead.description}
                onValueChange={(v) => updateLead('description', v)}
                placeholder="Short description of this lead…"
              />
            </FormGrid>
          </Section>

          <Section title="Business Entity" icon={SECTION_ICONS.entity}>
            <FormGrid>
              <SearchSelectField
                label="Business Entity Name"
                placeholder="Search company name…"
                    required
                options={existingEntities}
                    value={selectedEntity}
                onChange={(v) => { setSelectedEntity(v); clearErr('entity') }}
                    error={errors.entity}
                getKey={(o) => o.id}
                getLabel={(o) => o.name}
                clearable={false}
                    renderOption={(o) => (
                      <div>
                    <p className="text-xs font-semibold text-ink">{o.name}</p>
                    <p className="text-xs text-ink-faint">{o.type} · {o.city}</p>
                      </div>
                    )}
                  />
              <SearchSelectField
                label="Contact Person"
                placeholder="Search contact…"
                required
                options={contactOptions}
                value={selectedContact}
                onChange={setContact}
                error={errors.contact}
                getKey={(o) => o.id}
                getLabel={(o) => o.name}
                filterItem={(o, q) => `${o.name} ${o.designation} ${o.company}`.toLowerCase().includes(q.toLowerCase())}
                clearable={false}
                renderOption={(o) => (
                      <div>
                    <p className="text-xs font-semibold text-ink">{o.name}</p>
                    <p className="text-xs text-ink-faint">{o.designation || o.company}</p>
                    </div>
                  )}
              />
            </FormGrid>
          </Section>

          <Section title="Lead Classification" icon={SECTION_ICONS.classification}>
            <FormGrid cols={3}>
              <SelectField
                label="Lead Source"
                placeholder="Select source"
                options={withCurrent(activeLeadSourceNames, lead.source)}
                value={lead.source}
                onValueChange={(v) => updateLead('source', v)}
              />
              <SelectField
                label="Lead Stage"
                preserveOrder
                options={withCurrent(activeLeadStageNames, lead.stage)}
                value={lead.stage}
                onValueChange={(v) => updateLead('stage', v)}
              />
              <SelectField
                label="Lead Status"
                preserveOrder
                options={withCurrent(activeLeadStatusNames, lead.status)}
                value={lead.status}
                onValueChange={(v) => updateLead('status', v)}
              />
            </FormGrid>
          </Section>

          <Section title="Lead Details" icon={SECTION_ICONS.leadDetails}>
            <FormGrid>
              <div className="lg:col-span-2">
                <TableSearchSelectField
                  label="Product"
                  required
                  error={errors.products}
                  options={availableProducts}
                  value={null}
                  onChange={addProduct}
                  getKey={(item) => String(item.id)}
                  getLabel={productLine}
                  filterItem={matchesProduct}
                  placeholder="Select product…"
                  searchPlaceholder="Advance Search"
                  emptyText="No matching products"
                  clearable={false}
                  columns={[
                    { header: 'Code - Item Name', getValue: productLine, truncate: true },
                    { header: 'Unit', getValue: productUnit, width: '3.5rem' },
                  ]}
                />
                {selectedProducts.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedProducts.map((item) => (
                      <Tag
                        key={item.id}
                        label={productLine(item)}
                        title={productLine(item)}
                        onRemove={() => removeProduct(item.id)}
                        removeLabel={`Remove ${item.itemName}`}
                      />
              ))}
            </div>
                ) : null}
                      </div>
              <div className="lg:col-span-2" role="group" aria-label="Estimated Value">
                <p className="form-label">Estimated Value</p>
                <div className="flex gap-2">
                  <div className="w-[7.5rem] shrink-0">
                    <SearchSelect
                      options={MAIN_CURRENCIES}
                      value={findCurrency(lead.currency)}
                      onChange={(item) => { if (item) setLead((p) => ({ ...p, currency: item.code })) }}
                      getKey={(item) => item.code}
                      getLabel={(item) => item.code}
                      filterItem={matchesCurrency}
                      placeholder="Currency"
                      searchPlaceholder="Currency…"
                      emptyText="No matches"
                      clearable={false}
                      preserveOrder
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <TextInput
                      aria-label="Estimated value amount"
                      type="number"
                      min={0}
                      leading={currencyAmountPrefix(lead.currency)}
                      value={lead.value}
                      onValueChange={(v) => updateLead('value', v)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <SelectField label="Lead Priority" options={LEAD_PRIORITIES} value={lead.priority} onValueChange={(v) => setLead((p) => ({ ...p, priority: v as LeadPriority }))} />
              <SelectField label="Lead Owner" required error={errors.owner} options={SALESPERSONS} placeholder="Select owner" value={lead.owner} onValueChange={(v) => updateLead('owner', v)} />
            </FormGrid>
          </Section>

          <Section title="Activity Details" icon={SECTION_ICONS.activity}>
            <FormGrid>
              <div className="lg:col-span-2">
                <SearchSelectField
                  label="Type"
                  error={errors.activityType}
                  options={SELECTABLE_OPER_TASK_TYPES}
                  value={selectedActivityType}
                  onChange={selectActivityType}
                  getKey={(item) => String(item.OperTaskTypeNo)}
                  getLabel={(item) => item['Task Type']}
                  filterItem={matchesOperTaskType}
                  placeholder="Search and select type…"
                  searchPlaceholder="Search task type or code…"
                  emptyText="No matching types"
                />
              </div>
              <TextField
                fieldClassName="lg:col-span-2"
                label="Subject"
                required
                error={errors.subject}
                value={activity.subject}
                onValueChange={(v) => updateActivity('subject', v)}
                placeholder="Brief description of this activity"
              />
              <TextField
                label="Due Date"
                required
                type="date"
                error={errors.dueDate}
                value={activity.dueDate}
                onValueChange={(v) => updateActivity('dueDate', v)}
              />
              <SelectField
                label="Assigned To"
                required
                error={errors.assignedTo}
                options={SALESPERSONS}
                placeholder="Select assignee"
                value={activity.assignedTo}
                onValueChange={(v) => updateActivity('assignedTo', v)}
              />
              <TextAreaField
                fieldClassName="lg:col-span-2"
                label="Notes / Outcome"
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
          </Section>

          {!isEdit ? (
            <Section title="Internal Notes" icon={SECTION_ICONS.notes}>
              <FormGrid>
                <TextField
                  label="Date/Time"
                  required
                  type="datetime-local"
                  error={errors.noteDateTime}
                  value={noteDateTime}
                  onValueChange={(v) => { setNoteDateTime(v); clearErr('noteDateTime') }}
                />
                <TextField
                  label="Created By"
                  required
                  error={errors.noteCreatedBy}
                  value={noteCreatedBy}
                  placeholder="Created by"
                  onValueChange={(v) => { setNoteCreatedBy(v); clearErr('noteCreatedBy') }}
                />
                <TextAreaField
                  fieldClassName="lg:col-span-2"
                  label="Note / Discussion"
                  required
                  error={errors.noteDiscussion}
                  hint={`${noteDiscussion.length} / ${NOTE_DISCUSSION_MAX}`}
                  rows={4}
                  maxLength={NOTE_DISCUSSION_MAX}
                  value={noteDiscussion}
                  onValueChange={(v) => { setNoteDiscussion(v.slice(0, NOTE_DISCUSSION_MAX)); clearErr('noteDiscussion') }}
                  placeholder="Capture the internal discussion…"
                />
              </FormGrid>
              <div className="mt-3 flex justify-end">
                <Button variant="solid" className="!min-h-8 !px-3 !py-2 text-xs" onClick={addLeadNote}>
                  Add Note
                </Button>
              </div>
              {addedNotes.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {addedNotes.map((item) => (
                    <Card key={item.key} className="min-w-0 p-2.5 !shadow-none">
                      <div className="flex items-start gap-1">
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{item.by}</p>
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
                      <p className="text-xs text-ink-faint">{item.date} {item.time}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-ink-soft">{item.text}</p>
                    </Card>
                  ))}
                </div>
              ) : null}
          </Section>
          ) : null}

          <Section title="Documents / Attachments" icon={SECTION_ICONS.documents}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
              role="button"
              tabIndex={0}
              className={`mb-4 flex cursor-pointer select-none flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${dragging ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface-muted'
                }`}
            >
              <p className="text-sm font-semibold text-ink">Drag & drop files here</p>
              <p className="mt-1 text-xs text-ink-faint">PDF, Word, Excel, Images — max 10 MB each</p>
              <Button variant="secondary" className="pointer-events-none mt-3 !px-4 !py-1.5 text-xs">Browse Files</Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>
            {(relatedDocuments.length > 0 || files.length > 0) && (
              <div className="space-y-2">
                {relatedDocuments.map((doc) => (
                  <RecordRow key={doc.id} title={doc.name} meta={`${doc.fileType} · ${doc.size}`} />
                ))}
                {files.map((file, index) => {
                  const icon = fileKind(file.name, file.type)
                  return (
                    <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface-muted px-3 py-2.5">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${icon.className}`}>{icon.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">{file.name}</p>
                        <p className="text-xs text-ink-faint">{formatBytes(file.size)}</p>
                      </div>
                      <IconTooltip label="Remove file">
                        <Button variant="icon" aria-label="Remove file" onClick={() => setFiles((p) => p.filter((_, i) => i !== index))}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        </Button>
                      </IconTooltip>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {Object.keys(errors).length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3" role="alert">
              <p className="text-xs font-bold text-accent">Please fix the following before saving:</p>
                <ul className="space-y-0.5">
                {Object.values(errors).map((item) => (
                  <li key={item} className="text-xs text-accent">• {item}</li>
                  ))}
                </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button variant="secondary" onClick={onBack}>Cancel</Button>
            <div className="flex items-center gap-2.5">
              <Button variant="secondary">Save as Draft</Button>
              <Button variant="solid" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Lead'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
