import { useState } from 'react'
import { useSheetClose } from './useSheetClose'
import {
  Meeting,
  MeetingMode,
  MeetingStatus,
  MEETING_MODES,
  MEETING_STATUSES,
} from '../data/meetings'
import { useCrmSelector } from '../contexts/CrmStoreContext'
import {
  Button,
  FileField,
  FormGrid,
  SearchSelectField,
  TextAreaField,
  TextField,
} from '../ui'

interface MeetingDrawerProps {
  preselectedLead?: { id: string; name: string; contact: string } | null
  onClose: () => void
  onSave: (m: Meeting) => void
}

type LeadOption = { id: string; name: string; contact: string }

const MODE_ICONS: Record<MeetingMode, string> = {
  'In Person': '🏢',
  Online: '💻',
  Phone: '📞',
}

function modeTone(mode: MeetingMode, active: boolean): string {
  const tones: Record<MeetingMode, { idle: string; active: string }> = {
    'In Person': {
      idle: 'bg-purple-soft text-purple border-purple-line',
      active: 'bg-purple text-white border-purple',
    },
    Online: {
      idle: 'bg-primary-soft text-primary border-line-strong',
      active: 'bg-primary text-white border-primary',
    },
    Phone: {
      idle: 'bg-success-soft text-success-strong border-success-line',
      active: 'bg-success-strong text-white border-success-strong',
    },
  }
  return active ? tones[mode].active : tones[mode].idle
}

function statusTone(status: MeetingStatus, active: boolean): string {
  const tones: Record<MeetingStatus, { idle: string; active: string }> = {
    Scheduled: {
      idle: 'bg-warning-soft text-warning border-warning-line',
      active: 'bg-warning text-white border-warning',
    },
    Completed: {
      idle: 'bg-success-soft text-success border-success-line',
      active: 'bg-success text-white border-success',
    },
    Cancelled: {
      idle: 'bg-accent-soft text-accent border-accent/40',
      active: 'bg-accent text-white border-accent',
    },
  }
  return active ? tones[status].active : tones[status].idle
}

export default function MeetingDrawer({ preselectedLead, onClose, onSave }: MeetingDrawerProps) {
  const leads = useCrmSelector((state) => state.leads)
  const leadOptions: LeadOption[] = leads.map((l) => ({
    id: l.id,
    name: l.companyName,
    contact: l.contactPerson,
  }))

  const [subject, setSubject] = useState('')
  const [lead, setLead] = useState<LeadOption | null>(preselectedLead ?? null)
  const [contactPerson, setContactPerson] = useState(preselectedLead?.contact ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [mode, setMode] = useState<MeetingMode>('In Person')
  const [location, setLocation] = useState('')
  const [participantsRaw, setParticipantsRaw] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<MeetingStatus>('Scheduled')
  const [attachmentName, setAttachmentName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { closing, requestClose } = useSheetClose(onClose)

  function clearErr(key: string) {
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!subject.trim()) errs.subject = 'Meeting subject is required'
    if (!lead) errs.leadId = 'Lead is required'
    if (!date) errs.date = 'Meeting date is required'
    if (!time) errs.time = 'Start time is required'
    if (!mode) errs.mode = 'Meeting mode is required'
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
      const participants = participantsRaw
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      onSave({
        id: `MTG-${Date.now()}`,
        subject: subject.trim(),
        leadId: lead!.id,
        leadName: lead!.name,
        contactPerson: contactPerson.trim() || lead!.contact,
        date,
        time,
        endTime: endTime || undefined,
        mode,
        location,
        participants,
        notes,
        status,
        outcome: '',
        hasAttachment: Boolean(attachmentName),
        attachmentName: attachmentName || undefined,
      })
      requestClose()
    }, 600)
  }

  const locationLabel =
    mode === 'In Person'
      ? 'Address / Venue'
      : mode === 'Online'
        ? 'Meeting Link / Platform'
        : 'Phone / Conference Number'
  const locationPlaceholder =
    mode === 'In Person'
      ? 'e.g. TCS House, Fort, Mumbai'
      : mode === 'Online'
        ? 'e.g. https://meet.google.com/xyz or Teams link'
        : 'e.g. +91 22 4000 4000 or conference line'

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
        aria-label="Schedule Meeting"
        className="crm-sheet relative z-[1] flex h-full w-[31.25rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-l border-line bg-surface shadow-overlay sm:max-w-full"
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-ink">Schedule Meeting</h2>
              {preselectedLead ? (
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  For: <span className="font-semibold text-primary">{preselectedLead.name}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-primary">Book a call or visit with a lead</p>
              )}
            </div>
          </div>
          <Button type="button" variant="icon" aria-label="Close" onClick={requestClose}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas p-5">
          <TextField
            label="Meeting Subject"
            required
            error={errors.subject}
            value={subject}
            autoFocus
            placeholder="e.g. Product Demo — ERP Suite & Analytics"
            onValueChange={(v) => {
              setSubject(v)
              clearErr('subject')
            }}
          />

          <SearchSelectField
            label="Lead"
            required
            error={errors.leadId}
            options={leadOptions}
            value={lead}
            disabled={Boolean(preselectedLead)}
            onChange={(item) => {
              setLead(item)
              if (item) setContactPerson(item.contact)
              clearErr('leadId')
            }}
            getKey={(l) => l.id}
            getLabel={(l) => l.name}
            placeholder="Search and select lead…"
            renderOption={(l) => (
              <div>
                <p className="text-xs font-semibold text-ink">{l.name}</p>
                <p className="text-xs text-ink-faint">
                  {l.id} · {l.contact}
                </p>
              </div>
            )}
          />

          <TextField
            label="Contact Person"
            value={contactPerson}
            onValueChange={setContactPerson}
            placeholder="Auto-filled from lead"
          />

          <div>
            <p className="form-label">
              Meeting Mode <span className="text-accent">*</span>
            </p>
            <div className="mt-1 flex gap-2">
              {MEETING_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    clearErr('mode')
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${modeTone(m, mode === m)}`}
                >
                  <span aria-hidden="true">{MODE_ICONS[m]}</span>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <FormGrid cols={3}>
            <TextField
              label="Date"
              type="date"
              required
              error={errors.date}
              value={date}
              onValueChange={(v) => {
                setDate(v)
                clearErr('date')
              }}
            />
            <TextField
              label="Start"
              type="time"
              required
              error={errors.time}
              value={time}
              onValueChange={(v) => {
                setTime(v)
                clearErr('time')
              }}
            />
            <TextField label="End" type="time" value={endTime} onValueChange={setEndTime} />
          </FormGrid>

          <TextField
            label={locationLabel}
            value={location}
            onValueChange={setLocation}
            placeholder={locationPlaceholder}
          />

          <TextAreaField
            label="Participants"
            rows={2}
            value={participantsRaw}
            onValueChange={setParticipantsRaw}
            placeholder="Names separated by commas — e.g. Rajesh Sharma (CTO, TCS), Priya Mehta (FI)"
            hint="Separate multiple participants with commas"
          />

          <TextAreaField
            label="Discussion Notes / Agenda"
            rows={4}
            value={notes}
            onValueChange={setNotes}
            placeholder="Meeting agenda, talking points, objectives, preparation notes…"
          />

          <div>
            <p className="form-label">Status</p>
            <div className="flex gap-2">
              {MEETING_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${statusTone(s, status === s)}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <FileField
            label="Attachment"
            fileName={attachmentName}
            onFile={(file) => setAttachmentName(file.name)}
            onClear={() => setAttachmentName('')}
            buttonLabel="Browse & Attach File"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.png,.jpg,.txt"
          />

          {Object.keys(errors).length > 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3" role="alert">
              <svg
                className="mt-0.5 flex-shrink-0 text-accent"
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
              </svg>
              <div>
                <p className="mb-0.5 text-xs font-bold text-accent">Please fix before saving:</p>
                {Object.values(errors).map((e) => (
                  <p key={e} className="text-xs text-accent">
                    • {e}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 gap-2.5 border-t border-line-subtle bg-surface px-5 py-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" variant="solid" className="flex-1" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Schedule Meeting'}
          </Button>
        </div>
      </div>
    </div>
  )
}
