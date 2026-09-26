import { useState } from 'react'
import { shallowEqual, useCrmSelector } from '../contexts/CrmStoreContext'
import { useSheetClose } from './useSheetClose'
import {
  formatFileSize,
  readImagePreview,
  type CRMDocument,
  type DocFileType,
} from '../data/documents'
import { Button, ChoiceField, FileField, SearchSelectField, SelectField, TextAreaField, TextField } from '../ui'

interface DocumentDrawerProps {
  preselectedLead?: { id: string; name: string } | null
  preselectedEntity?: { id: string; name: string } | null
  onClose: () => void
  onSave: (doc: CRMDocument) => void
}

const DOC_TYPES: DocFileType[] = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'IMG']

function fileTypeFromName(name: string): DocFileType {
  if (/\.pdf$/i.test(name)) return 'PDF'
  if (/\.(docx?)$/i.test(name)) return 'DOCX'
  if (/\.(xlsx?|csv)$/i.test(name)) return 'XLSX'
  if (/\.(pptx?)$/i.test(name)) return 'PPTX'
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return 'IMG'
  return 'PDF'
}

export default function DocumentDrawer({
  preselectedLead,
  preselectedEntity,
  onClose,
  onSave,
}: DocumentDrawerProps) {
  const { leads, entities } = useCrmSelector(
    (state) => ({ leads: state.leads, entities: state.entities }),
    shallowEqual,
  )
  const defaultRelated = preselectedLead
    ? { type: 'lead' as const, id: preselectedLead.id, name: preselectedLead.name }
    : preselectedEntity
      ? { type: 'entity' as const, id: preselectedEntity.id, name: preselectedEntity.name }
      : { type: 'lead' as const, id: '', name: '' }

  const [fileName, setFileName] = useState('')
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [docName, setDocName] = useState('')
  const [docType, setDocType] = useState<DocFileType>('PDF')
  const [relatedType, setRelatedType] = useState<'lead' | 'entity'>(defaultRelated.type)
  const [relatedId, setRelatedId] = useState(defaultRelated.id)
  const [relatedName, setRelatedName] = useState(defaultRelated.name)
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { closing, requestClose } = useSheetClose(onClose)

  const options =
    relatedType === 'lead'
      ? leads.map((l) => ({ id: l.id, name: l.companyName, meta: l.contactPerson }))
      : entities.map((e) => ({ id: e.id, name: e.name, meta: e.type }))
  const selectedRelated = options.find((o) => o.id === relatedId) ?? null

  function validate() {
    const errs: Record<string, string> = {}
    if (!fileName && !docName.trim()) errs.file = 'Upload a file or enter a document name'
    if (!relatedId) errs.related = 'Related record is required'
    return errs
  }

  async function handleSave() {
    if (saving) return
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setSaving(true)
    const name = docName.trim() || fileName
    const previewUrl = pickedFile ? await readImagePreview(pickedFile) : undefined
    onSave({
      id: `DOC-${Date.now()}`,
      name,
      fileType: docType,
      size: pickedFile ? formatFileSize(pickedFile.size) : fileName ? 'Uploaded' : '—',
      relatedId,
      relatedType,
      relatedName,
      uploadedBy: 'Priya Mehta',
      uploadedDate: new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      category: remarks.trim() || 'General',
      previewUrl,
    })
    requestClose()
  }

  return (
    <div className={`fixed inset-0 z-[60] flex justify-end${closing ? ' is-sheet-closing' : ''}`} role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="ui-scrim crm-sheet-scrim absolute inset-0 border-0 p-0"
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upload Document"
        className="crm-sheet relative z-[1] flex h-full w-[28.75rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-l border-line bg-surface shadow-overlay sm:max-w-full"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary/15 bg-primary-soft px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-surface shadow-sm"
              aria-hidden="true"
            >
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-ink">Upload Document</h2>
              <p className="mt-0.5 text-xs text-primary">Attach a file to a lead or entity</p>
            </div>
          </div>
          <Button type="button" variant="icon" aria-label="Close" onClick={requestClose}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas p-5">
          <FileField
            label="File upload"
            error={errors.file}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp"
            fileName={fileName}
            buttonLabel="Click to choose a file"
            onFile={(file) => {
              setPickedFile(file)
              setFileName(file.name)
              setDocName((prev) => prev || file.name)
              setDocType(fileTypeFromName(file.name))
              setErrors((p) => {
                const n = { ...p }
                delete n.file
                return n
              })
            }}
            onClear={() => {
              setFileName('')
              setPickedFile(null)
            }}
          />
          <TextField
            htmlFor="qc-doc-name"
            label="Document Name"
            value={docName}
            onValueChange={setDocName}
            placeholder="Display name"
          />
          <SelectField
            htmlFor="qc-doc-type"
            label="Document Type"
            options={DOC_TYPES}
            value={docType}
            onValueChange={(v) => setDocType(v as DocFileType)}
          />
          <div className="space-y-2">
            <ChoiceField
              label="Related Lead / Business Entity"
              required
              options={[
                { value: 'lead', label: 'Lead' },
                { value: 'entity', label: 'Business Entity' },
              ]}
              value={relatedType}
              onChange={(t) => {
                setRelatedType(t)
                setRelatedId('')
                setRelatedName('')
              }}
            />
            <SearchSelectField
              label="Related record"
              error={errors.related}
              options={options}
              value={selectedRelated}
              onChange={(item) => {
                setRelatedId(item?.id ?? '')
                setRelatedName(item?.name ?? '')
              }}
              getKey={(o) => o.id}
              getLabel={(o) => o.name}
              placeholder={`Select ${relatedType}…`}
              renderOption={(o) => (
                <div>
                  <p className="text-xs font-semibold text-ink">{o.name}</p>
                  <p className="text-xs text-ink-faint">
                    {o.id} · {o.meta}
                  </p>
                </div>
              )}
            />
          </div>
          <TextAreaField
            htmlFor="qc-doc-remarks"
            label="Remarks"
            rows={3}
            value={remarks}
            onValueChange={setRemarks}
            placeholder="Optional context for this file"
          />
        </div>
        <div className="flex flex-shrink-0 gap-2 border-t border-line-subtle bg-surface px-5 py-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" variant="solid" className="flex-1" disabled={saving} onClick={handleSave}>
            {saving ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>
    </div>
  )
}
