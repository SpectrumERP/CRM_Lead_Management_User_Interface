import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  checkAttachmentStatus,
  createAttachmentEntry,
  deleteAttachment,
  fetchAttachmentBlob,
  listAttachments,
  openAttachment,
  renameAttachment,
  uploadAttachmentFile,
  type Attachment,
} from '../api/attachments'
import { toApiError } from '../api/errors'
import {
  UPLOAD_ACCEPT_ATTR,
  UPLOAD_HELP_TEXT,
  formatUploadSize,
  getFileExtension,
  isImageFileName,
  validateUploadFile,
} from '../api/uploadFiles'
import { useConfirm } from '../contexts/ConfirmContext'
import { useOptionalToast } from '../contexts/ToastContext'
import { Button, IconTooltip, ImagePreview, Spinner } from '../ui'

type QueueStatus = 'pending' | 'uploading' | 'verifying' | 'failed'

interface QueueItem {
  tempId: string
  file: File
  status: QueueStatus
  error?: string
}

const STATUS_TEXT: Record<Exclude<QueueStatus, 'failed'>, string> = {
  pending: 'Pending upload…',
  uploading: 'Registering entry…',
  verifying: 'Uploading file…',
}

function kind(name: string): { label: string; className: string } {
  const ext = getFileExtension(name)
  if (ext === 'pdf') return { label: 'PDF', className: 'bg-accent-soft text-accent' }
  if (['doc', 'docx'].includes(ext)) return { label: 'DOC', className: 'bg-primary-soft text-primary' }
  if (['xlsx', 'csv'].includes(ext)) return { label: ext.toUpperCase(), className: 'bg-success-soft text-success' }
  if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'tif'].includes(ext)) return { label: 'IMG', className: 'bg-warning-soft text-warning' }
  return { label: (ext || 'FILE').slice(0, 4).toUpperCase(), className: 'bg-surface-hover text-ink-soft' }
}

function splitName(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' }
}

const X_ICON = (
  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export interface AttachmentsFieldProps {
  /** Spectrum form number the files are filed under; null switches uploads off (with a notice). */
  formNo: number | null
  /** Head office company number (as the Task Management app sends). */
  companyNo: number | null
  /** Store `detailType` for activity files (lead 2 / opportunity 3, ACTIVITY_ATTACHMENT_DETAIL_TYPE): sent on upload and on the list. */
  detailType?: number
  value: Attachment[]
  onChange: (next: Attachment[]) => void
  /** Saved record (leadNo / opportunityNo): its linked files are loaded once. */
  transactionId?: number
  /** True while any file is still uploading (or the saved ones are loading), so the form can hold its save. */
  onBusyChange?: (busy: boolean) => void
  /** Record noun for messages, e.g. "lead". */
  noun: string
  /** Extra per-file actions shown before Delete (e.g. share, analyze). */
  extraActions?: (item: Attachment) => ReactNode
}

/**
 * Documents / attachments, as in the Task Management app: each file is uploaded as soon as it is
 * picked or dropped (entry → file → status), failed ones can be retried; the parent save links the
 * uploaded docNos. View, rename and delete act on the server straight away.
 */
export default function AttachmentsField({
  formNo,
  companyNo,
  detailType,
  value,
  onChange,
  transactionId,
  onBusyChange,
  noun,
  extraActions,
}: AttachmentsFieldProps) {
  const { addToast } = useOptionalToast()
  const confirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [blocked, setBlocked] = useState<{ name: string; size: number; reason: string }[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [renaming, setRenaming] = useState<{ id: number; base: string; ext: string } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  // An image being viewed over the page (url null while it loads); `request` drops a late answer.
  const [preview, setPreview] = useState<{ request: number; name: string; url: string | null } | null>(null)
  const previewRequest = useRef(0)
  const previewUrl = useRef<string | null>(null)

  // Latest value for async callbacks (uploads finish after other state changes).
  const valueRef = useRef(value)
  valueRef.current = value

  const enabled = formNo !== null && companyNo !== null
  // Also while the saved files load: a save before then would link only the new ones.
  const busy = loadingList || queue.some((q) => q.status !== 'failed')

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  useEffect(() => {
    if (!transactionId || formNo === null) return
    let cancelled = false
    setLoadingList(true)
    listAttachments(transactionId, formNo, detailType)
      .then((rows) => {
        if (cancelled) return
        const known = new Set(valueRef.current.map((a) => a.id))
        onChange([...rows.filter((r) => !known.has(r.id)), ...valueRef.current])
      })
      .catch((error) => {
        if (!cancelled) addToast('error', 'Could not load attachments', toApiError(error).message)
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
    // Load once per record; `onChange` / `addToast` identity changes must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, formNo, detailType])

  function setStatus(tempId: string, patch: Partial<QueueItem>) {
    setQueue((prev) => prev.map((q) => (q.tempId === tempId ? { ...q, ...patch } : q)))
  }

  async function startUpload(tempId: string, file: File) {
    if (formNo === null || companyNo === null) return
    setStatus(tempId, { status: 'uploading', error: undefined })
    try {
      const id = await createAttachmentEntry(file.name, companyNo, formNo, detailType)
      setStatus(tempId, { status: 'verifying' })
      await uploadAttachmentFile(id, file)
      await checkAttachmentStatus(id)
      onChange([...valueRef.current, { id, name: file.name, size: file.size, type: file.type || undefined }])
      setQueue((prev) => prev.filter((q) => q.tempId !== tempId))
      addToast('success', 'File uploaded', `"${file.name}" uploaded successfully.`)
    } catch (error) {
      const message = toApiError(error).message || 'File upload failed. Please try again.'
      setStatus(tempId, { status: 'failed', error: message })
      addToast('error', 'Upload failed', `"${file.name}": ${message}`)
    }
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list || !enabled) return
    const failed: { name: string; size: number; reason: string }[] = []
    const valid: File[] = []
    for (const file of Array.from(list)) {
      const check = validateUploadFile(file)
      if (check.ok) valid.push(file)
      else failed.push({ name: file.name, size: file.size, reason: check.reason })
    }
    setBlocked(failed)
    const items = valid.map((file) => ({ tempId: Math.random().toString(36).slice(2, 9), file, status: 'pending' as const }))
    if (!items.length) return
    setQueue((prev) => [...prev, ...items])
    items.forEach((item) => void startUpload(item.tempId, item.file))
  }

  function closePreview() {
    previewRequest.current += 1
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = null
    setPreview(null)
  }

  // Leaving the page with an image open releases it.
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current) }, [])

  /** Images open in the preview over the page; PDFs in a new tab; other files download. */
  async function view(item: Attachment) {
    if (isImageFileName(item.name)) {
      closePreview()
      const request = previewRequest.current
      setPreview({ request, name: item.name, url: null })
      try {
        const url = URL.createObjectURL(await fetchAttachmentBlob(item.id, item.name))
        if (previewRequest.current !== request) {
          URL.revokeObjectURL(url)
          return
        }
        previewUrl.current = url
        setPreview({ request, name: item.name, url })
      } catch (error) {
        if (previewRequest.current !== request) return
        closePreview()
        addToast('error', 'Could not open the image', toApiError(error).message)
      }
      return
    }
    try {
      await openAttachment(item)
    } catch (error) {
      addToast('error', 'Could not open the document', toApiError(error).message)
    }
  }

  async function saveRename() {
    if (!renaming || formNo === null) return
    const base = renaming.base.trim()
    if (!base) {
      addToast('error', 'File name cannot be empty.')
      return
    }
    const next = `${base}${renaming.ext}`
    const current = value.find((a) => a.id === renaming.id)
    if (!current || current.name === next) {
      setRenaming(null)
      return
    }
    if (!(await confirm({ title: 'Rename Document', message: `Rename "${current.name}" to "${next}"?`, confirmLabel: 'Rename' }))) return
    setBusyId(renaming.id)
    try {
      await renameAttachment(renaming.id, next, formNo)
      onChange(valueRef.current.map((a) => (a.id === renaming.id ? { ...a, name: next } : a)))
      setRenaming(null)
      addToast('success', 'Document renamed', `File renamed to "${next}".`)
    } catch (error) {
      addToast('error', 'Could not rename the document', toApiError(error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(item: Attachment) {
    const ok = await confirm({
      title: 'Delete Document',
      message: `Delete "${item.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setBusyId(item.id)
    try {
      await deleteAttachment(item.id)
      onChange(valueRef.current.filter((a) => a.id !== item.id))
      addToast('info', 'Document deleted', `"${item.name}" has been removed.`)
    } catch (error) {
      addToast('error', 'Could not delete the document', toApiError(error).message)
    } finally {
      setBusyId(null)
    }
  }

  if (formNo === null) {
    return (
      <p className="rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-xs text-ink-soft" role="note">
        Document uploads are not set up for this {noun} form yet (the Spectrum form number is missing).
      </p>
    )
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        dragDepth.current += 1
        if (enabled && e.dataTransfer.types.includes('Files')) setDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        addFiles(e.dataTransfer.files)
      }}
    >
      <div
        onClick={() => enabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (enabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={enabled ? 0 : -1}
        aria-disabled={!enabled || undefined}
        className={`mb-3 flex select-none flex-col items-center justify-center rounded-xl border-2 border-dashed py-7 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          !enabled ? 'cursor-not-allowed border-line bg-surface-muted opacity-60' : dragging ? 'cursor-pointer border-primary bg-primary-soft' : 'cursor-pointer border-line-strong bg-surface-muted'
        }`}
      >
        <p className="text-sm font-semibold text-ink">{dragging ? 'Drop to upload' : 'Drag & drop files here'}</p>
        <p className="mt-1 text-center text-xs text-ink-faint">{UPLOAD_HELP_TEXT}</p>
        <Button variant="secondary" className="pointer-events-none mt-3 !px-4 !py-1.5 text-xs" disabled={!enabled}>
          Browse Files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={UPLOAD_ACCEPT_ATTR}
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {blocked.length > 0 ? (
        <div className="mb-3 rounded-lg border border-accent bg-accent-soft px-3 py-2.5" role="alert">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-xs font-bold text-accent">File upload blocked</p>
            <Button variant="icon" className="!h-6 !w-6" aria-label="Dismiss" onClick={() => setBlocked([])}>{X_ICON}</Button>
          </div>
          <ul className="mt-1 space-y-0.5">
            {blocked.map((b, i) => (
              <li key={`${b.name}-${i}`} className="text-xs text-accent">
                • <span className="font-semibold">{b.name}</span> ({formatUploadSize(b.size) || '0 B'}) — {b.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loadingList ? (
        <div className="flex justify-center py-3"><Spinner label="Loading attachments" /></div>
      ) : null}

      {(queue.length > 0 || value.length > 0) && (
        <div className="space-y-2">
          {queue.map((q) => {
            const icon = kind(q.file.name)
            const failed = q.status === 'failed'
            return (
              <div key={q.tempId} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${failed ? 'border-accent bg-accent-soft' : 'border-line bg-surface-muted'}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${icon.className}`}>{icon.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">{q.file.name}</p>
                  <p className={`truncate text-xs ${failed ? 'text-accent' : 'text-ink-faint'}`}>
                    {q.status === 'failed' ? q.error : STATUS_TEXT[q.status]}
                  </p>
                </div>
                {failed ? (
                  <>
                    <Button variant="secondary" className="!min-h-7 !px-2.5 !py-1 text-xs" onClick={() => void startUpload(q.tempId, q.file)}>
                      Retry
                    </Button>
                    <IconTooltip label="Remove">
                      <Button variant="icon" aria-label="Remove" onClick={() => setQueue((prev) => prev.filter((x) => x.tempId !== q.tempId))}>{X_ICON}</Button>
                    </IconTooltip>
                  </>
                ) : (
                  <Spinner label={`Uploading ${q.file.name}`} />
                )}
              </div>
            )
          })}

          {value.map((a) => {
            const icon = kind(a.name)
            const isRenaming = renaming?.id === a.id
            const rowBusy = busyId === a.id
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${icon.className}`}>{icon.label}</span>
                <div className="min-w-0 flex-1">
                  {isRenaming ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        className="form-input !h-8 !min-h-8 !py-0 text-xs"
                        value={renaming.base}
                        maxLength={200}
                        autoFocus
                        aria-label="File name"
                        onChange={(e) => setRenaming({ ...renaming, base: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); void saveRename() }
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                      />
                      {renaming.ext ? <span className="shrink-0 text-xs text-ink-faint">{renaming.ext}</span> : null}
                    </div>
                  ) : (
                    <button type="button" className="block max-w-full truncate text-left text-xs font-semibold text-ink hover:text-primary" onClick={() => void view(a)}>
                      {a.name}
                    </button>
                  )}
                  {/* While renaming the row is one line (icon, name, extension, Save, Cancel), so no size line. */}
                  {isRenaming ? null : <p className="text-xs text-ink-faint">{formatUploadSize(a.size) || 'Uploaded'}</p>}
                </div>
                {rowBusy ? (
                  <Spinner label="Working" />
                ) : isRenaming ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="solid" className="!h-8 !min-h-8 !px-3 !py-0 text-xs" onClick={() => void saveRename()}>Save</Button>
                    <Button variant="secondary" className="!h-8 !min-h-8 !px-3 !py-0 text-xs" onClick={() => setRenaming(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <IconTooltip label="View / download">
                      <Button variant="icon" aria-label={`View ${a.name}`} onClick={() => void view(a)}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                    </IconTooltip>
                    <IconTooltip label="Rename">
                      <Button variant="icon" aria-label={`Rename ${a.name}`} onClick={() => setRenaming({ id: a.id, ...splitName(a.name) })}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                    </IconTooltip>
                    {extraActions?.(a)}
                    <IconTooltip label="Delete">
                      <Button variant="icon" aria-label={`Delete ${a.name}`} onClick={() => void remove(a)}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </IconTooltip>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {preview ? <ImagePreview src={preview.url} alt={preview.name} onClose={closePreview} /> : null}
    </div>
  )
}
