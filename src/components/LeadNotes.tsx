import { useEffect, useMemo, useState } from "react"
import { Button, FormGrid, TextAreaField, TextField } from "../ui"
import { initialsAvatar } from "../data/contacts"
import type { Lead } from "../data/leads"
import { FIELD_LIMITS } from "../constants/fieldLimits"
import { EmptyState, EmptyIcons } from "./CRMStates"
import type { ToastType } from "./Toast"
import { sameList, useCrmActions, useCrmSelector, type CrmNote } from "../contexts/CrmStoreContext"
import { saveConfirm, useConfirm } from "../contexts/ConfirmContext"
import { formatDateParts, toIsoDate } from "../utils/dateFormat"
import { useAuth } from "../auth/AuthContext"

/**
 * Internal notes (list + add form), shared by the lead / opportunity views and their edit forms.
 */

export type LeadNote = { id: string; text: string; date: string; time: string; by: string }

/** LeadNotesDetail.Discussion varchar(1000) */
const NOTE_DISCUSSION_MAX = FIELD_LIMITS.noteDiscussion

export function NoteCard({
  note,
  expanded,
  onToggle,
  onDelete,
  onEdit,
}: {
  note: LeadNote
  expanded: boolean
  onToggle: () => void
  onDelete?: (note: LeadNote) => void
  onEdit?: (note: LeadNote) => void
}) {
  const preview =
    note.text.length > 72 ? `${note.text.slice(0, 72).trim()}…` : note.text
  const when = formatDateParts(note.date, note.time)

  return (
    <li
      className={`border-b border-line last:border-b-0 transition-colors duration-200 ${
        expanded ? "bg-warning-soft/50" : "bg-surface"
      }`}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning-soft text-[9px] font-bold text-warning">
          {initialsAvatar(note.by)}
    </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-[11px] font-bold leading-snug text-ink">{note.by}</p>
            <span className="shrink-0 text-[10px] leading-snug text-ink-faint">{when}</span>
          </div>
          {!expanded && preview ? (
            <p className="mt-px truncate text-[10px] leading-snug text-ink-faint">{preview}</p>
          ) : null}
        </div>
        <svg
          width="12"
          height="12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
          className={`shrink-0 text-ink-faint transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className="accordion-panel"
        data-open={expanded ? "true" : "false"}
        aria-hidden={!expanded}
        {...(!expanded ? { inert: true } : {})}
      >
        <div className="accordion-panel-inner">
          <div className="accordion-panel-body border-t border-line-subtle px-2.5 pb-2 pl-10 pt-1.5">
            <p className="text-[9px] font-bold tracking-wide text-ink-muted">Note / Discussion</p>
            <p className="mt-1 rounded-md border border-line bg-surface-muted px-2 py-1.5 text-[11px] leading-relaxed text-ink">
              {note.text || "No discussion text."}
            </p>
            {onDelete || onEdit ? (
              <div className="mt-2 flex justify-end gap-2">
                {onEdit ? (
                  <Button variant="secondary" className="!min-h-7 !px-3 !py-1 text-[11px]" onClick={() => onEdit(note)}>
                    Edit
                  </Button>
                ) : null}
                {onDelete ? (
                <Button
                  variant="secondary"
                  className="!min-h-7 !px-3 !py-1 text-[11px] text-accent"
                  onClick={() => onDelete(note)}
                >
                  Delete
                </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}

export function InternalNotesTab({
  notes,
  adding,
  draft,
  errors,
  onDraft,
  onStartAdd,
  onCancel,
  onSave,
  onDelete,
  onEdit,
  editing = false,
  editingId = null,
  readOnly = false,
}: {
  /** The note open in the form; it is left out of the list while edited. */
  editingId?: string | null
  /** Locked lead: notes are shown only (no add / edit / delete). */
  readOnly?: boolean
  notes: LeadNote[]
  adding: boolean
  draft: { dateTime: string; createdBy: string; text: string }
  errors: Record<string, string>
  onDraft: (patch: Partial<{ dateTime: string; createdBy: string; text: string }>) => void
  onStartAdd: () => void
  onCancel: () => void
  onSave: () => void
  /** Shown on each expanded note when given. */
  onDelete?: (note: LeadNote) => void
  onEdit?: (note: LeadNote) => void
  /** The form is editing an existing note (title and button say so). */
  editing?: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const userName = useAuth().user?.name ?? ""

  // A new note starts with today's date, and Created By is the logged-in user.
  useEffect(() => {
    if (!adding) return
    const patch: Partial<{ dateTime: string; createdBy: string }> = {}
    if (!draft.dateTime.trim()) patch.dateTime = toIsoDate(new Date())
    if (!draft.createdBy.trim() && userName) patch.createdBy = userName
    if (Object.keys(patch).length) onDraft(patch)
  }, [adding, draft.dateTime, draft.createdBy, userName, onDraft])

  useEffect(() => {
    setOpenId((prev) => (prev && notes.some((item) => item.id === prev) ? prev : null))
  }, [notes])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-muted">
          {notes.length} internal note{notes.length !== 1 ? "s" : ""}
        </p>
        {readOnly || adding ? null : (
          <Button variant="solid" className="!px-3 !py-1.5 text-xs" onClick={onStartAdd}>
            Add Internal Note / Observation
          </Button>
        )}
      </div>
      {adding && !readOnly && (
        <div className="mb-3 space-y-3 rounded-xl border border-warning-line bg-warning-soft p-4">
          {editing ? <p className="text-xs font-bold text-ink">Edit Internal Note / Observation</p> : null}
          <FormGrid cols={2}>
            <TextField
              label="Date"
              required
              type="date"
              error={errors.dateTime}
              value={draft.dateTime}
              onValueChange={(v) => onDraft({ dateTime: v })}
            />
            <TextField
              label="Created By"
              maxLength={FIELD_LIMITS.noteOriginatedBy}
              required
              disabled
              error={errors.createdBy}
              value={draft.createdBy}
              placeholder="Created by"
            />
          </FormGrid>
          <TextAreaField
            label="Note / Discussion"
            required
            error={errors.text}
            rows={4}
            maxLength={NOTE_DISCUSSION_MAX}
            value={draft.text}
            onValueChange={(v) => onDraft({ text: v.slice(0, NOTE_DISCUSSION_MAX) })}
            placeholder="Capture the internal discussion…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button variant="solid" onClick={onSave}>{editing ? "Update Note" : "Save Note"}</Button>
          </div>
        </div>
      )}
      {notes.length === 0 && !adding ? (
        <EmptyState
          icon={EmptyIcons.notes}
          title="No internal notes / observations yet"
          subtitle="Record date, author and discussion so the team has one internal thread."
          action={readOnly ? undefined : { label: "Add Internal Note / Observation", onClick: onStartAdd }}
        />
      ) : notes.some((note) => note.id !== editingId) ? (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface" aria-label="Internal notes / observations">
          {notes.filter((note) => note.id !== editingId).map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              expanded={openId === note.id}
              onToggle={() => setOpenId((prev) => (prev === note.id ? null : note.id))}
              onDelete={readOnly ? undefined : onDelete}
              onEdit={readOnly ? undefined : onEdit}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}


// ─── Panel (list + add / delete), saved straight away ───────────────────────

const EMPTY_DRAFT = { dateTime: "", createdBy: "", text: "" }

/** `YYYY-MM-DDTHH:MM` (datetime-local) or `DD-MM-YYYY HH:MM` → display date and time. */
function splitDateTime(value: string) {
  const trimmed = value.trim()
  if (trimmed.includes("T")) {
    const [isoDate = "", isoTime = ""] = trimmed.split("T")
    const [year, month, day] = isoDate.split("-")
    return { date: year && month && day ? `${day}-${month}-${year}` : isoDate, time: isoTime.slice(0, 5) }
  }
  const idx = trimmed.indexOf(" ")
  return idx === -1 ? { date: trimmed, time: "" } : { date: trimmed.slice(0, idx), time: trimmed.slice(idx + 1).trim() }
}

/** Stored note date (`DD-MM-YYYY HH:MM`, or ISO) → the `datetime-local` input value (`YYYY-MM-DDTHH:MM`). */
/** A saved note date as the note form's date input value (`YYYY-MM-DD`). */
export function noteDateToInput(value: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(value.trim())
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toLeadNote(n: CrmNote): LeadNote {
  return { id: n.id, text: n.title ? `${n.title} — ${n.text}` : n.text, date: n.date, time: "", by: n.by }
}

export interface LeadNotesPanelProps {
  lead: Lead
  onToast?: (type: ToastType, title: string, message?: string) => void
}

/**
 * The lead view's internal notes as a self-contained block (lead form, edit mode). Adding and deleting
 * are saved straight away — server leads through `save-notes-detail` / `delete-notes-detail`.
 */
export function LeadNotesPanel({ lead, onToast, readOnly = false }: LeadNotesPanelProps & { readOnly?: boolean }) {
  return <RecordNotesPanel recordId={lead.id} recordName={lead.companyName} noun="lead" onToast={onToast} readOnly={readOnly} />
}

export interface RecordNotesPanelProps {
  /** Lead (`SL-…`) or opportunity (`SO-…`) id; notes are stored against it as `relatedLeadId`. */
  recordId: string
  recordName: string
  /** Used in the toasts ("saved on this lead"). */
  noun: "lead" | "opportunity"
  onToast?: (type: ToastType, title: string, message?: string) => void
  /** Locked lead / closed opportunity: notes are shown only (no add / edit / delete). */
  readOnly?: boolean
}

/**
 * Internal notes of one lead or opportunity (list + add / edit / delete), saved straight away —
 * server records through their `save-notes-detail` / `delete-notes-detail`.
 */
export function RecordNotesPanel({ recordId, recordName, noun, onToast, readOnly = false }: RecordNotesPanelProps) {
  const { addNote, patchNote, removeNote } = useCrmActions()
  const confirm = useConfirm()
  const stored = useCrmSelector((state) => state.notes.filter((n) => n.relatedLeadId === recordId), sameList)
  // Shown until the server reload brings the saved note (which then replaces it).
  const [pending, setPending] = useState<LeadNote[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [errors, setErrors] = useState<Record<string, string>>({})
  /** Note being edited (its id), or null when the form adds a new one. */
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => setPending([]), [stored])
  const notes = useMemo(() => [...pending, ...stored.map(toLeadNote)], [pending, stored])

  async function save() {
    const dateTime = draft.dateTime.trim()
    const by = draft.createdBy.trim()
    const text = draft.text.trim()
    const errs: Record<string, string> = {}
    if (!dateTime) errs.dateTime = "Date/Time is required"
    if (!by) errs.createdBy = "Created by is required"
    if (!text) errs.text = "Note / discussion is required"
    else if (draft.text.length > NOTE_DISCUSSION_MAX) errs.text = `Note / discussion cannot exceed ${NOTE_DISCUSSION_MAX} characters`
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    if (!(await confirm(saveConfirm("Note", Boolean(editingId))))) return
    const { date, time } = splitDateTime(dateTime)
    if (editingId) {
      // Server notes → save-notes-detail with their number, then the lead / opportunity reloads.
      // Failed → the error toast shows and the form stays open with the text.
      const responseMessage = await patchNote(editingId, { text, by, date: `${date} ${time}`.trim() })
      if (!responseMessage) return
      setDraft(EMPTY_DRAFT)
      setErrors({})
      setAdding(false)
      setEditingId(null)
      onToast?.("success", "Internal Note / Observation Updated", typeof responseMessage === 'string' ? responseMessage : "The discussion has been updated.")
      return
    }
    const created: CrmNote = {
      id: `N-${Date.now()}`,
      title: "Internal note",
      text,
      relatedLeadId: recordId,
      relatedLeadName: recordName,
      date: `${date} ${time}`.trim(),
      by,
    }
    const responseMessage = await addNote(created)
    if (!responseMessage) return
    setPending((prev) => [{ id: created.id, text, date, time, by }, ...prev])
    setDraft(EMPTY_DRAFT)
    setErrors({})
    setAdding(false)
    onToast?.("success", "Internal Note / Observation Added", typeof responseMessage === 'string' ? responseMessage : `The discussion has been saved on this ${noun}.`)
  }

  function edit(note: LeadNote) {
    const saved = stored.find((n) => n.id === note.id)
    if (!saved) {
      onToast?.("info", "Still saving", "This note is still being saved — try again in a moment.")
      return
    }
    setDraft({ dateTime: noteDateToInput(saved.date), createdBy: saved.by, text: saved.text })
    setErrors({})
    setEditingId(saved.id)
    setAdding(true)
  }

  async function remove(note: LeadNote) {
    if (pending.some((p) => p.id === note.id)) {
      onToast?.("info", "Still saving", "This note is still being saved — try again in a moment.")
      return
    }
    const ok = await confirm({
      title: "Delete Note",
      message: `Delete this note by ${note.by || "unknown"}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!ok) return
    if (await removeNote(note.id)) onToast?.("info", "Note Deleted", "The internal note has been deleted.")
  }

  return (
    <InternalNotesTab
      readOnly={readOnly}
      notes={notes}
      adding={adding}
      draft={draft}
      errors={errors}
      onDraft={(patch) => {
        setDraft((prev) => ({ ...prev, ...patch }))
        setErrors((prev) => {
          const next = { ...prev }
          for (const key of Object.keys(patch)) delete next[key]
          return next
        })
      }}
      onStartAdd={() => {
        setDraft(EMPTY_DRAFT)
        setErrors({})
        setEditingId(null)
        setAdding(true)
      }}
      onCancel={() => {
        setAdding(false)
        setDraft(EMPTY_DRAFT)
        setErrors({})
        setEditingId(null)
      }}
      onSave={() => void save()}
      onDelete={(note) => void remove(note)}
      onEdit={(note) => edit(note)}
      editing={Boolean(editingId)}
      editingId={editingId}
    />
  )
}
