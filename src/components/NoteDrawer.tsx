import { useState } from 'react'
import { useCrmSelector } from '../contexts/CrmStoreContext'
import { Button, FileField, SearchSelectField, TextAreaField, TextField } from '../ui'
import { useSheetClose } from './useSheetClose'

interface NoteDrawerProps {
  preselectedLead?: { id: string; name: string } | null
  onClose: () => void
  onSave: (note: {
    id: string
    title: string
    text: string
    relatedLeadId: string
    relatedLeadName: string
    attachmentName?: string
    date: string
    by: string
  }) => void
}

export default function NoteDrawer({ preselectedLead, onClose, onSave }: NoteDrawerProps) {
  const leads = useCrmSelector((state) => state.leads)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [leadId, setLeadId] = useState(preselectedLead?.id ?? '')
  const [leadName, setLeadName] = useState(preselectedLead?.name ?? '')
  const [attachmentName, setAttachmentName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { closing, requestClose } = useSheetClose(onClose)

  const selectedLead = leads.find((l) => l.id === leadId) ?? null

  function validate() {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Note title is required'
    if (!text.trim()) errs.text = 'Note description is required'
    if (!leadId) errs.leadId = 'Related lead is required'
    return errs
  }

  function handleSave() {
    if (saving) return
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setSaving(true)
    setTimeout(() => {
      onSave({
        id: `NOTE-${Date.now()}`,
        title: title.trim(),
        text: text.trim(),
        relatedLeadId: leadId,
        relatedLeadName: leadName,
        attachmentName: attachmentName || undefined,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        by: 'Priya Mehta',
      })
      requestClose()
    }, 450)
  }

  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
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
        aria-labelledby="note-drawer-title"
        className="crm-sheet relative z-[1] flex h-full w-[26rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-l border-line bg-surface shadow-overlay sm:max-w-full"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 id="note-drawer-title" className="font-display text-sm font-bold text-ink">
                New Note
              </h2>
              {preselectedLead?.name ? (
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  Linked to <span className="font-semibold text-primary">{preselectedLead.name}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-primary">Capture context, next steps, or comments</p>
              )}
            </div>
          </div>
          <Button type="button" variant="icon" aria-label="Close" onClick={requestClose}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas px-5 py-5">
          <TextField
            htmlFor="qc-note-title"
            label="Note Title"
            required
            error={errors.title}
            value={title}
            autoFocus
            onValueChange={(v) => {
              setTitle(v)
              clearError('title')
            }}
            placeholder="e.g. Call recap with CTO"
          />
          <TextAreaField
            htmlFor="qc-note-text"
            label="Note Description"
            required
            error={errors.text}
            rows={4}
            value={text}
            onValueChange={(v) => {
              setText(v)
              clearError('text')
            }}
            placeholder="Capture context, next steps or stakeholder comments…"
          />
          <SearchSelectField
            label="Related Lead"
            required
            error={errors.leadId}
            options={leads}
            value={selectedLead}
            disabled={Boolean(preselectedLead)}
            onChange={(lead) => {
              setLeadId(lead?.id ?? '')
              setLeadName(lead?.companyName ?? '')
              clearError('leadId')
            }}
            getKey={(l) => l.id}
            getLabel={(l) => l.companyName}
            placeholder="Select lead…"
            renderOption={(l) => (
              <div>
                <p className="text-xs font-semibold text-ink">{l.companyName}</p>
                <p className="text-xs text-ink-faint">
                  {l.id} · {l.contactPerson}
                </p>
              </div>
            )}
          />
          <FileField
            label="Attachment"
            fileName={attachmentName}
            onFile={(file) => setAttachmentName(file.name)}
            onClear={() => setAttachmentName('')}
            buttonLabel="Choose file"
          />
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-line-subtle bg-surface px-5 py-4">
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="solid"
            className="!bg-warning hover:!bg-warning"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save Note'}
          </Button>
        </div>
      </div>
    </div>
  )
}
