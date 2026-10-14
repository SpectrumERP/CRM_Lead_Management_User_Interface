import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ATTACHMENT_FORM_NO, fetchAttachmentBlob, listAttachments, uploadAttachment, type Attachment } from '../api/attachments'
import {
  BUSINESS_ENTITY_LIMITS,
  buildBusinessEntitySaveBody,
  businessEntityFromDetail,
  deleteBusinessEntityContact,
  emptyBusinessEntityDraft,
  emptyContact,
  emptyLocation,
  loadBusinessEntity,
  saveBusinessEntity,
  saveBusinessEntityContact,
  type BusinessEntityDraft,
  type ContactDraft,
  type LocationDraft,
} from '../api/businessEntities'
import {
  defaultLocationTypeNo,
  EMPTY_BUSINESS_ENTITY_FILL_VALUES,
  getBusinessEntityFillValues,
  type BusinessEntityFillValues,
  type BusinessEntityTypeOption,
  type GstinTypeOption,
} from '../api/businessEntityFillValues'
import { toApiError } from '../api/errors'
import { FORM_NO } from '../api/formRights'
import { toNo, type CityComboRow } from '../api/geo'
import { UPLOAD_ACCEPT_ATTR, validateUploadFile } from '../api/uploadFiles'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'
import AttachmentsField from '../components/AttachmentsField'
import { BusinessEntityShareMenu } from '../components/BusinessEntityShareMenu'
import type { ScanResult } from '../components/businessCard/BusinessCardScanner'
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice'
import type { ToastType } from '../components/Toast'
import { useConfirm } from '../contexts/ConfirmContext'
import { useFormRights } from '../contexts/FormRightsContext'
import { useOptionalToast } from '../contexts/ToastContext'
import { Button, IconTooltip, SearchSelectField, Spinner, TextField } from '../ui'
import { formatDateTime } from '../utils/dateFormat'
import { locationTimeZoneLabel } from '../utils/timeZones/locationTimeZone'
import { mergeScannedCard, resolveScannedPlace } from './businessEntities/applyScannedCard'
import { CityCreateDialog, ContactDialog, LocationDialog } from './businessEntities/FormDialogs'
import { ContactCard, FollowUpNotesField, LocationCard, NameField, PortsField } from './businessEntities/FormParts'
import LocationFields from './businessEntities/LocationFields'
import FormDrawer from '../components/FormDrawer'
import { BreadcrumbBar, EntitySection, ICON, Icon, OutlineButton, SolidButton, Subheading } from './businessEntities/ui'
import { BreadcrumbActions } from '../components/BreadcrumbActions'

// OpenCV and Tesseract (~12 MB) load only when the scanner opens.
const BusinessCardScanner = lazy(() => import('../components/businessCard/BusinessCardScanner'))

const IMAGE_FILE = /\.(jpe?g|png|webp|avif|bmp|tiff?)$/i
const ANALYZE_ACCEPT = 'image/png,image/jpeg,image/webp'

interface Props {
  /** The entity to edit; omit to create one. */
  businessEntityNo?: number
  onBack: () => void
  /** Called after a save with the entity's number and name. */
  onSuccess: (businessEntityNo: number, name: string) => void
  /** Inside the quick-create sheet: no breadcrumb. */
  embedded?: boolean
  onToast?: (type: ToastType, title: string, message?: string) => void
}

/** Errors under `prefix.` with the prefix removed (`primaryContact.name` → `name`). */
function scoped(errors: Record<string, string>, prefix: string) {
  const out: Record<string, string> = {}
  for (const [key, message] of Object.entries(errors)) if (key.startsWith(`${prefix}.`)) out[key.slice(prefix.length + 1)] = message
  return out
}

type LocationEdit = { index: number | null; initial: LocationDraft }
type ContactEdit = { index: number | null; initial: ContactDraft }
type CityTarget = { for: 'primary' | 'dialog'; countryNo: number | null; stateNo: number | null }

/** Location fields a newly added city fills in. */
function placeOfCity(city: CityComboRow): Partial<LocationDraft> {
  return {
    cityNo: String(city.cityNo),
    cityName: city.cityName,
    stateNo: city.stateNo ? String(city.stateNo) : '',
    stateName: city.stateName,
    countryNo: city.countryNo ? String(city.countryNo) : '',
    countryName: city.countryName,
  }
}

/** "Analyze Image" menu of the header: pick an image, or capture one with the camera. */
function AnalyzeMenu({ onPickImage, onCamera }: { onPickImage: () => void; onCamera: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey) }
  }, [open])
  const item = 'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-ink hover:bg-surface-hover'
  return (
    <div ref={ref} className="relative">
      <OutlineButton title="Analyze Image" active iconOnly onClick={() => setOpen((o) => !o)}>
        <Icon d={ICON.idCard} />
      </OutlineButton>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-lg border border-line bg-surface p-1 shadow-overlay">
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onPickImage() }}>
            <Icon d={ICON.file} size={16} className="text-ink-muted" /> Direct Analyze
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onCamera() }}>
            <Icon d={ICON.camera} size={16} className="text-ink-muted" /> Camera Capture
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** Business entity form, laid out and behaving as the Task Management "Business Entity" master. */
export default function CreateBusinessEntity({ businessEntityNo, onBack, onSuccess, embedded, onToast }: Props) {
  const isEdit = Boolean(businessEntityNo)
  const company = useSpectrumCompany()
  const headOfficeNo = company.headOfficeNo
  const rights = useFormRights(FORM_NO.businessEntity)
  const cityRights = useFormRights(FORM_NO.city)
  const confirm = useConfirm()
  const { addToast } = useOptionalToast()
  const toast = onToast ?? addToast
  const formNo = ATTACHMENT_FORM_NO.businessEntity

  const [fill, setFill] = useState<BusinessEntityFillValues | null>(null)
  const [fillError, setFillError] = useState<string | null>(null)
  const [draft, setDraft] = useState<BusinessEntityDraft>(() => emptyBusinessEntityDraft())
  const [meta, setMeta] = useState<{ code: string; createdBy: string | null; createdDate: string | null } | null>(null)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadsBusy, setUploadsBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [locationEdit, setLocationEdit] = useState<LocationEdit | null>(null)
  const [contactEdit, setContactEdit] = useState<ContactEdit | null>(null)
  const [cityTarget, setCityTarget] = useState<CityTarget | null>(null)
  const [dialogCity, setDialogCity] = useState<Partial<LocationDraft> | null>(null)
  const [showAttachments, setShowAttachments] = useState(false)
  const [scan, setScan] = useState<{ file?: File; uploadFile: boolean } | null>(null)
  const [readingAttachment, setReadingAttachment] = useState<number | null>(null)
  const [analyzedIds, setAnalyzedIds] = useState<number[]>([])
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const analyzeInputRef = useRef<HTMLInputElement>(null)

  const lists = fill ?? EMPTY_BUSINESS_ENTITY_FILL_VALUES
  const allowed = isEdit ? rights.isUpdate : rights.isSave

  useEffect(() => {
    if (!headOfficeNo) return
    let cancelled = false
    setFillError(null)
    getBusinessEntityFillValues(headOfficeNo)
      .then((values) => { if (!cancelled) setFill(values) })
      .catch((err) => { if (!cancelled) setFillError(toApiError(err).message) })
    return () => { cancelled = true }
  }, [headOfficeNo, retry])

  useEffect(() => {
    if (!businessEntityNo || !headOfficeNo) return
    let cancelled = false
    setLoadingRecord(true)
    setLoadError(null)
    // Attachments load with the record so the header count is right before the dialog opens.
    Promise.all([loadBusinessEntity(businessEntityNo, headOfficeNo), listAttachments(businessEntityNo, formNo).catch(() => [])])
      .then(([raw, attachments]) => {
        if (cancelled) return
        const { code, createdBy, createdDate, ...rest } = businessEntityFromDetail(raw, attachments)
        setDraft(rest)
        setMeta({ code, createdBy, createdDate })
      })
      .catch((err) => { if (!cancelled) setLoadError(toApiError(err).message) })
      .finally(() => { if (!cancelled) setLoadingRecord(false) })
    return () => { cancelled = true }
  }, [businessEntityNo, headOfficeNo, formNo, retry])

  function clearErrors(...keys: string[]) {
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev
      const next = { ...prev }
      for (const key of keys) delete next[key]
      return next
    })
  }

  function update<K extends keyof BusinessEntityDraft>(key: K, value: BusinessEntityDraft[K], ...clear: string[]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    clearErrors(key, ...clear)
  }

  function updatePrimaryContact(patch: Partial<ContactDraft>) {
    setDraft((prev) => ({ ...prev, primaryContact: { ...prev.primaryContact, ...patch } }))
    clearErrors(...Object.keys(patch).map((k) => `primaryContact.${k}`))
  }

  function updatePrimaryLocation(patch: Partial<LocationDraft>) {
    setDraft((prev) => ({ ...prev, primaryLocation: { ...prev.primaryLocation, ...patch } }))
    clearErrors(...Object.keys(patch).map((k) => `primaryLocation.${k}`))
  }

  const confirmRemove = (entityLabel: string, recordName: string) =>
    confirm({ title: `Delete ${entityLabel}`, message: `Are you sure you want to delete "${recordName}"? This action cannot be undone.`, confirmLabel: 'Delete', danger: true })

  // ── Locations / contacts / ports / notes ──
  function saveLocation(location: LocationDraft) {
    setDraft((prev) => {
      const locations = [...prev.locations]
      if (locationEdit?.index != null) locations[locationEdit.index] = location
      else locations.push(location)
      return { ...prev, locations }
    })
    clearErrors(...draft.locations.map((_, i) => `locations.${i}`))
    setLocationEdit(null)
    setDialogCity(null)
  }

  async function removeLocation(index: number) {
    const loc = draft.locations[index]
    const label = [typeNameOf(loc.locationTypeNo), loc.cityName || loc.address].filter(Boolean).join(' · ') || 'Location'
    if (!(await confirmRemove('location', label))) return
    setDraft((prev) => ({ ...prev, locations: prev.locations.filter((_, i) => i !== index) }))
    clearErrors(`locations.${index}`)
  }

  async function saveContact(contact: ContactDraft) {
    const index = contactEdit?.index ?? null
    const applyLocally = () =>
      setDraft((prev) => {
        const contacts = [...prev.contacts]
        if (index != null) contacts[index] = { ...contacts[index], ...contact }
        else contacts.push(contact)
        return { ...prev, contacts }
      })
    const entityNo = draft.businessEntityNo
    // A saved entity's Update sends only the primary contact: the others are saved on the server straight away.
    if (entityNo) {
      try {
        await saveBusinessEntityContact(entityNo, index != null ? { ...draft.contacts[index], ...contact } : contact)
      } catch (err) {
        toast('error', 'Failed to save contact', toApiError(err).message)
        return
      }
      toast('success', index != null ? 'Contact updated' : 'Contact added')
      // The server returns no number for a new contact: reload the list so it can be edited / deleted later.
      try {
        if (!headOfficeNo) throw new Error('No company')
        const { contacts } = businessEntityFromDetail(await loadBusinessEntity(entityNo, headOfficeNo))
        setDraft((prev) => ({ ...prev, contacts }))
      } catch {
        applyLocally()
        toast('error', 'Contact list could not be refreshed', 'Reopen this business entity before changing the contact again.')
      }
    } else {
      applyLocally()
    }
    clearErrors(...draft.contacts.map((_, i) => `contacts.${i}`))
    setContactEdit(null)
  }

  async function removeContact(index: number) {
    const contact = draft.contacts[index]
    if (!(await confirmRemove('contact', contact.name || contact.email || 'Contact'))) return
    // Contacts not saved yet only exist in the form; saved ones are deleted on the server.
    if (contact.contactPersonNo != null) {
      try {
        await deleteBusinessEntityContact(contact.contactPersonNo)
        toast('success', 'Contact deleted')
      } catch (err) {
        toast('error', 'Failed to delete contact', toApiError(err).message)
        return
      }
    }
    setDraft((prev) => ({ ...prev, contacts: prev.contacts.filter((c) => c !== contact) }))
    clearErrors(`contacts.${index}`)
  }

  async function removePort(index: number) {
    if (await confirmRemove('port', draft.ports[index].portName || 'Port')) update('ports', draft.ports.filter((_, i) => i !== index))
  }

  async function removeFollowUp(index: number) {
    const label = draft.followUps[index].note.trim().slice(0, 60) || 'Note'
    if (await confirmRemove('follow-up note', label)) {
      update('followUps', draft.followUps.filter((_, i) => i !== index))
      clearErrors(`followUps.${index}`)
    }
  }

  // ── City quick-create ──
  function openAddCity(target: CityTarget['for'], place: LocationDraft) {
    setCityTarget({ for: target, countryNo: toNo(place.countryNo), stateNo: toNo(place.stateNo) })
  }

  function cityCreated(city: CityComboRow) {
    const place = placeOfCity(city)
    if (cityTarget?.for === 'primary') updatePrimaryLocation(place)
    else setDialogCity(place)
    setCityTarget(null)
    toast('success', 'City added', `"${city.cityName}" was added.`)
  }

  // ── Attachments ──
  async function uploadPicked(file: File) {
    const check = validateUploadFile(file)
    if (!check.ok) {
      toast('error', 'File not allowed', check.reason)
      return
    }
    if (!headOfficeNo) return
    setUploading(true)
    try {
      const uploaded = await uploadAttachment(file, headOfficeNo, formNo)
      setDraft((prev) => ({ ...prev, attachments: [...prev.attachments, uploaded] }))
      toast('success', 'Attachment uploaded', file.name)
    } catch (err) {
      toast('error', 'Upload failed', toApiError(err).message)
    } finally {
      setUploading(false)
    }
  }

  async function analyzeAttachment(item: Attachment) {
    setReadingAttachment(item.id)
    try {
      const blob = await fetchAttachmentBlob(item.id, item.name)
      setAnalyzedIds((ids) => [...ids, item.id])
      setScan({ file: new File([blob], item.name, { type: blob.type || 'image/jpeg' }), uploadFile: false })
    } catch (err) {
      toast('error', 'Failed to load file for analysis', toApiError(err).message)
    } finally {
      setReadingAttachment(null)
    }
  }

  async function scanDone(result: ScanResult) {
    setScan(null)
    const uploaded = result.attachments.filter((a) => !draft.attachments.some((x) => x.id === a.id))
    const base = { ...draft, attachments: [...draft.attachments, ...uploaded] }
    if (!result.data) {
      setDraft(base)
      toast('success', 'Image uploaded', 'The card image was added to the attachments.')
      return
    }
    const merged = mergeScannedCard(base, result.data, lists)
    setDraft(merged.draft)
    clearErrors('name', 'primaryContact.name', 'primaryContact.phone', 'primaryContact.email', 'primaryLocation.address')
    toast('success', uploaded.length ? 'Business card scanned successfully!' : 'Details confirmed!')
    if (merged.placeForPrimary) {
      const place = await resolveScannedPlace(merged.placeForPrimary, lists)
      // Only while the primary address still has no place picked.
      if (place) setDraft((prev) => (prev.primaryLocation.cityNo || prev.primaryLocation.countryNo
        ? prev
        : { ...prev, primaryLocation: { ...prev.primaryLocation, ...place } }))
    }
  }

  // ── Save ──
  async function handleSave() {
    if (saving) return
    setServerError(null)
    if (!fill) {
      setServerError('The form lists have not loaded yet. Retry loading them, then save.')
      return
    }
    const result = buildBusinessEntitySaveBody(draft, fill)
    if (result.errors) {
      setErrors(result.errors)
      toast('error', 'Please fill all required fields', [...new Set(Object.values(result.errors))].map((m) => `• ${m}`).join('\n'))
      return
    }
    if (uploadsBusy || uploading) {
      toast('error', 'Please wait for all attachments to finish uploading before saving.')
      return
    }
    if (!(await confirm({ title: 'Confirm Save', message: 'Are you sure you want to save these changes?', confirmLabel: 'Save' }))) return
    setSaving(true)
    try {
      const no = await saveBusinessEntity(result.body)
      onSuccess(no, result.body.businessEntityName)
    } catch (err) {
      setServerError(toApiError(err).message)
      setSaving(false)
    }
  }

  const typeNameOf = (no: string) => lists.locationTypes.find((t) => String(t.locationTypeNo) === no)?.locationTypeName ?? no
  const canAddCity = cityRights.isSave && Boolean(headOfficeNo)
  const blockSave = saving || loadingRecord || Boolean(loadError) || !company.enabled || !fill

  const actions = (
    <>
      <OutlineButton onClick={onBack} disabled={saving} className="h-9">
        <Icon d={ICON.x} />
        <span className="hidden sm:inline">Cancel</span>
      </OutlineButton>
      {allowed || !rights.ready ? (
        <SolidButton onClick={() => void handleSave()} disabled={blockSave} className="h-9 px-4">
          {saving ? <Spinner label="Saving" /> : <Icon d={ICON.save} />}
          <span className="hidden sm:inline">{saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}</span>
        </SolidButton>
      ) : null}
    </>
  )
  // Full page: Cancel / Save at the right of the app header's breadcrumb line (which already names the page).
  // Quick Create drawer: this form's own bar keeps them in view.
  const bar = embedded ? (
    <BreadcrumbBar items={[]} actions={actions} />
  ) : (
    <BreadcrumbActions>{actions}</BreadcrumbActions>
  )

  if (rights.ready && !allowed) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-canvas">
        {bar}
        <div className="page-gutter py-6">
          <div className="rounded-lg border border-line bg-surface px-6 py-10 text-center">
            <p className="text-sm font-bold text-ink">You do not have permission to {isEdit ? 'edit' : 'create'} business entities.</p>
            <p className="mt-1 text-xs text-ink-muted">Ask your administrator for {isEdit ? 'Update' : 'Save'} rights on the Business Entity form.</p>
          </div>
        </div>
      </div>
    )
  }

  const L = BUSINESS_ENTITY_LIMITS
  const contactErrs = scoped(errors, 'primaryContact')
  const otherDetailsHaveData = Boolean(draft.gstinTypeNo || draft.vatgstNo || draft.creditInsuranceLimit || draft.creditInsuranceCompanyName || draft.ports.length || errors.vatgstNo)
  const selectedType = lists.businessEntityTypes.find((t) => String(t.typeNo) === draft.typeNo) ?? null
  const selectedGstin = lists.gstinTypes.find((t) => String(t.gstinTypeNo) === draft.gstinTypeNo) ?? null
  const listErrors = Object.entries(errors).filter(([key]) => /^(locations|contacts|followUps)\./.test(key)).map(([, m]) => m)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas form-labels-as-written">
      {bar}
      <div className="page-gutter min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
        <SpectrumRequiredNotice what="Business entities" />
        {fillError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-xs text-accent" role="alert">
            <span>Could not load the form lists: {fillError}</span>
            <button type="button" className="font-bold underline" onClick={() => setRetry((r) => r + 1)}>Retry</button>
          </div>
        ) : null}

        {!company.ready || loadingRecord ? (
          <div className="flex min-h-[220px] items-center justify-center py-16"><Spinner label="Loading record" /></div>
        ) : loadError ? (
          <div className="rounded-lg border border-line bg-surface px-6 py-10 text-center">
            <p className="text-sm font-bold text-ink">Failed to load record</p>
            <p className="mt-1 text-xs text-ink-muted">Could not load this record for editing. Retry uses the same request. Cancel returns to the list.</p>
            <p className="mt-1 text-xs text-accent">{loadError}</p>
            <Button className="mt-4" variant="secondary" onClick={() => setRetry((r) => r + 1)}>Retry</Button>
          </div>
        ) : (
          <>
            <EntitySection
              icon={ICON.building}
              title="Business Entity"
              description="Required details, primary contact and address"
              action={
                <div className="flex items-center gap-3">
                  <OutlineButton title="View Attachments" onClick={() => setShowAttachments(true)}>
                    <Icon d={ICON.file} />
                    {draft.attachments.length}
                  </OutlineButton>
                  <OutlineButton title="Upload Attachment" active iconOnly disabled={uploading || !headOfficeNo}
                    onClick={() => uploadInputRef.current?.click()}>
                    {uploading ? <Spinner label="Uploading" /> : <Icon d={ICON.paperclip} />}
                  </OutlineButton>
                  <input ref={uploadInputRef} type="file" accept={UPLOAD_ACCEPT_ATTR} className="hidden" aria-hidden="true"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadPicked(f) }} />
                  {headOfficeNo ? (
                    <AnalyzeMenu onPickImage={() => analyzeInputRef.current?.click()} onCamera={() => setScan({ uploadFile: true })} />
                  ) : null}
                  <input ref={analyzeInputRef} type="file" accept={ANALYZE_ACCEPT} className="hidden" aria-hidden="true"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
                        toast('error', 'Only PNG, JPG or WebP images can be analyzed.')
                        return
                      }
                      setScan({ file: f, uploadFile: true })
                    }} />
                </div>
              }
            >
              {isEdit && meta ? (
                <div className="mb-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-1.5 border-b border-line pb-3 text-xs">
                  <span className="flex items-baseline gap-1.5"><span className="text-ink-faint">Code</span><span className="font-mono font-semibold text-ink">{meta.code || '—'}</span></span>
                  {meta.createdBy ? <span className="flex items-baseline gap-1.5"><span className="text-ink-faint">Created by</span><span className="font-semibold text-ink">{meta.createdBy}</span></span> : null}
                  {meta.createdDate ? <span className="flex items-baseline gap-1.5"><span className="text-ink-faint">Created on</span><span className="font-semibold text-ink">{formatDateTime(meta.createdDate)}</span></span> : null}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
                <NameField value={draft.name} error={errors.name} onChange={(v) => update('name', v)} />
                <SearchSelectField<BusinessEntityTypeOption>
                  label="Business Entity Type"
                  required
                  error={errors.typeNo}
                  options={lists.businessEntityTypes}
                  value={selectedType}
                  onChange={(t) => update('typeNo', t ? String(t.typeNo) : '')}
                  getKey={(t) => String(t.typeNo)}
                  getLabel={(t) => t.typeName}
                  placeholder="Select business entity type"
                  searchPlaceholder="Search…"
                />
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <TextField label="Contact Person Name" required error={contactErrs.name} maxLength={L.contactName}
                  placeholder="Enter contact person name" value={draft.primaryContact.name} onValueChange={(name) => updatePrimaryContact({ name })} />
                <TextField label="Designation" error={contactErrs.designation} maxLength={L.designation}
                  placeholder="Enter designation" value={draft.primaryContact.designation} onValueChange={(designation) => updatePrimaryContact({ designation })} />
                <TextField label="Phone Number" required error={contactErrs.phone} type="tel" maxLength={L.phone}
                  placeholder="Enter phone number" value={draft.primaryContact.phone} onValueChange={(phone) => updatePrimaryContact({ phone })} />
                <TextField label="Email Address" error={contactErrs.email} type="email" maxLength={L.email}
                  placeholder="Enter email address" value={draft.primaryContact.email} onValueChange={(email) => updatePrimaryContact({ email })} />
              </div>

              <div className="mt-3.5">
                <LocationFields
                  value={draft.primaryLocation}
                  onChange={updatePrimaryLocation}
                  errors={scoped(errors, 'primaryLocation')}
                  countries={lists.countries}
                  timeZones={lists.timeZones}
                  onAddCity={canAddCity ? () => openAddCity('primary', draft.primaryLocation) : undefined}
                />
              </div>

              <div className="mt-3.5">
                <TextField label="Website" error={errors.website} inputMode="url" maxLength={L.website}
                  placeholder="https://www.example.com" value={draft.website} onValueChange={(v) => update('website', v)} />
              </div>
            </EntitySection>

            <EntitySection icon={ICON.info} title="Other Details" description="VAT / GST, credit insurance and preferred ports"
              collapsible autoOpen={otherDetailsHaveData}>
              <Subheading>Tax &amp; Credit Insurance</Subheading>
              <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <SearchSelectField<GstinTypeOption>
                  label="Document Type"
                  options={lists.gstinTypes}
                  value={selectedGstin}
                  onChange={(t) => update('gstinTypeNo', t ? String(t.gstinTypeNo) : '', 'vatgstNo')}
                  getKey={(t) => String(t.gstinTypeNo)}
                  getLabel={(t) => t.gstinTypeName}
                  placeholder="Select document type"
                  searchPlaceholder="Search…"
                />
                <TextField label="VAT / GST No" required={Boolean(toNo(draft.gstinTypeNo))} error={errors.vatgstNo} maxLength={L.vatgstNo}
                  placeholder="Enter VAT No. / GST No." value={draft.vatgstNo} onValueChange={(v) => update('vatgstNo', v)} />
                <TextField label="Credit Insurance Limit" error={errors.creditInsuranceLimit} type="number" min={0} className="!text-left"
                  placeholder="Enter credit insurance limit" value={draft.creditInsuranceLimit}
                  onValueChange={(v) => update('creditInsuranceLimit', v)} />
                <TextField label="Credit Insurance Company" error={errors.creditInsuranceCompanyName} maxLength={L.creditInsuranceCompanyName}
                  placeholder="Enter credit insurance company name" value={draft.creditInsuranceCompanyName}
                  onValueChange={(v) => update('creditInsuranceCompanyName', v)} />
              </div>
              <Subheading className="mt-5">Preferred Ports</Subheading>
              <PortsField
                ports={draft.ports}
                options={lists.ports}
                onAdd={(port) => update('ports', [...draft.ports, port])}
                onRemove={(i) => void removePort(i)}
              />
            </EntitySection>

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <EntitySection
                icon={ICON.pin}
                title="Locations"
                description="Other offices, sites or warehouses"
                collapsible
                count={draft.locations.length}
                autoOpen={draft.locations.length > 0 || listErrors.some((m) => m.startsWith('Location'))}
                bodyClassName={draft.locations.length === 0 ? 'py-3' : ''}
                action={
                  <SolidButton onClick={() => setLocationEdit({ index: null, initial: emptyLocation(defaultLocationTypeNo(lists)) })}>
                    <Icon d={ICON.plus} strokeWidth={2.5} /> Add Location
                  </SolidButton>
                }
              >
                {draft.locations.length === 0 ? (
                  <p className="py-2 text-center text-[11px] font-medium text-ink-faint">No locations added yet. Click Add Location to create one.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
                    {draft.locations.map((loc, i) => (
                      <LocationCard key={i} location={loc} typeName={typeNameOf(loc.locationTypeNo)}
                        zoneLabel={locationTimeZoneLabel(lists.timeZones, loc.timeZoneNo, loc.timeZoneName)}
                        onEdit={() => setLocationEdit({ index: i, initial: loc })}
                        onRemove={() => void removeLocation(i)} />
                    ))}
                  </div>
                )}
              </EntitySection>

              <EntitySection
                icon={ICON.user}
                title="Contact Persons"
                description="Other people at this business entity"
                collapsible
                count={draft.contacts.length}
                autoOpen={draft.contacts.length > 0}
                bodyClassName={draft.contacts.length === 0 ? 'py-3' : ''}
                action={
                  <SolidButton onClick={() => setContactEdit({ index: null, initial: emptyContact() })}>
                    <Icon d={ICON.plus} strokeWidth={2.5} /> Add Contact Person
                  </SolidButton>
                }
              >
                {draft.contacts.length === 0 ? (
                  <p className="py-2 text-center text-[11px] font-medium text-ink-faint">No contact persons added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
                    {draft.contacts.map((contact, i) => (
                      <ContactCard key={contact.contactPersonNo ?? `new-${i}`} contact={contact} entityName={draft.name} entityCode={meta?.code}
                        onEdit={() => setContactEdit({ index: i, initial: contact })}
                        onRemove={() => void removeContact(i)} />
                    ))}
                  </div>
                )}
              </EntitySection>
            </div>

            <EntitySection icon={ICON.note} title="Follow-up Notes" description="Add dated remarks for this business entity"
              collapsible count={draft.followUps.length} autoOpen={draft.followUps.length > 0}>
              <FollowUpNotesField
                notes={draft.followUps}
                onAdd={(note) => update('followUps', [note, ...draft.followUps])}
                onRemove={(i) => void removeFollowUp(i)}
              />
            </EntitySection>

            {listErrors.length ? (
              <div className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-xs font-medium text-accent" role="alert">
                {listErrors.map((m) => <p key={m}>{m}</p>)}
              </div>
            ) : null}
            {serverError ? (
              <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-xs font-medium text-accent" role="alert">
                <span className="shrink-0 font-semibold">Error:</span>
                <span className="flex-1 whitespace-pre-wrap leading-relaxed">{serverError}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {showAttachments ? (
        <FormDrawer title="Document Attachments" subtitle="Files attached to this business entity"
          icon={<Icon d={ICON.file} size={17} />} widthClass="w-[42rem]" onClose={() => setShowAttachments(false)}>
          <AttachmentsField
            noun="business entity"
            formNo={formNo}
            companyNo={headOfficeNo}
            value={draft.attachments}
            onChange={(next: Attachment[]) => setDraft((prev) => ({ ...prev, attachments: next }))}
            onBusyChange={setUploadsBusy}
            extraActions={(item) => (
              <>
                {IMAGE_FILE.test(item.name) ? (
                  analyzedIds.includes(item.id) || /capture|^logo/i.test(item.name) ? (
                    <span className="px-1 text-[10px] font-semibold text-ink-faint">Analyzed</span>
                  ) : (
                    <IconTooltip label="Analyze Image">
                      <Button variant="icon" aria-label={`Analyze ${item.name}`} disabled={readingAttachment !== null}
                        onClick={() => void analyzeAttachment(item)}>
                        {readingAttachment === item.id ? <Spinner label="Opening" /> : <Icon d={ICON.scan} size={13} className="text-success" />}
                      </Button>
                    </IconTooltip>
                  )
                ) : null}
                <BusinessEntityShareMenu mode="attachment" docNo={item.id} fileName={item.name} companyName={draft.name} />
              </>
            )}
          />
        </FormDrawer>
      ) : null}

      {locationEdit ? (
        <LocationDialog
          initial={locationEdit.initial}
          isNew={locationEdit.index === null}
          countries={lists.countries}
          timeZones={lists.timeZones}
          locationTypes={lists.locationTypes}
          onAddCity={canAddCity ? (place) => openAddCity('dialog', place) : undefined}
          cityCreated={dialogCity}
          onSave={saveLocation}
          onClose={() => { setLocationEdit(null); setDialogCity(null) }}
        />
      ) : null}
      {contactEdit ? (
        <ContactDialog initial={contactEdit.initial} isNew={contactEdit.index === null} onSave={saveContact} onClose={() => setContactEdit(null)} />
      ) : null}
      {cityTarget && headOfficeNo ? (
        <CityCreateDialog
          headOfficeNo={headOfficeNo}
          countries={lists.countries}
          initialCountryNo={cityTarget.countryNo}
          initialStateNo={cityTarget.stateNo}
          onCreated={cityCreated}
          onClose={() => setCityTarget(null)}
          onError={(message) => toast('error', 'Could not add city', message)}
        />
      ) : null}
      {scan && headOfficeNo ? (
        <Suspense fallback={<div className="ui-scrim fixed inset-0 z-[70] flex items-center justify-center"><Spinner label="Loading camera" /></div>}>
          <BusinessCardScanner
            file={scan.file}
            uploadFile={scan.uploadFile}
            companyNo={headOfficeNo}
            formNo={formNo}
            onDone={(result) => void scanDone(result)}
            onClose={() => setScan(null)}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
