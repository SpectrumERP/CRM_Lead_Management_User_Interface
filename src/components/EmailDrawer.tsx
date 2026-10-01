import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { CrmEmail } from '../contexts/crmTypes'
import { isEmail } from '../api/sanitize'
import { Button, FormGrid, TextAreaField, TextField } from '../ui'
import { useSheetClose } from './useSheetClose'
import { toStoredStamp } from '../utils/dateFormat'

export interface EmailDraftLead {
  id: string
  name: string
  contact: string
  email: string
}

interface EmailDrawerProps {
  preselectedLead: EmailDraftLead
  onClose: () => void
  onSave: (email: CrmEmail) => void
}

function nowStamp() {
  return toStoredStamp()
}

export function openMailto(to: string, subject: string, body: string) {
  const href = `mailto:${to.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.assign(href)
}

export default function EmailDrawer({ preselectedLead, onClose, onSave }: EmailDrawerProps) {
  const { user } = useAuth()
  const fromAddress = user?.email ?? ''
  const fromName = user?.name ?? 'You'
  const [to, setTo] = useState(preselectedLead.email)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { closing, requestClose } = useSheetClose(onClose)

  function clearErr(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!to.trim()) errs.to = 'To is required'
    else if (!isEmail(to.trim())) errs.to = 'Enter a valid email address'
    if (!subject.trim()) errs.subject = 'Subject is required'
    if (!body.trim()) errs.body = 'Email body is required'
    if (!fromAddress) errs.from = 'Your account has no email address'
    return errs
  }

  function handleSend() {
    if (saving) return
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setSaving(true)
    const stamp = nowStamp()
    const toAddress = to.trim()
    const subjectText = subject.trim()
    const bodyText = body.trim()
    window.setTimeout(() => {
      onSave({
        id: `EM-${Date.now()}`,
        leadId: preselectedLead.id,
        leadName: preselectedLead.name,
        to: toAddress,
        from: fromAddress,
        subject: subjectText,
        body: bodyText,
        date: stamp.date,
        time: stamp.time,
        by: fromName,
        direction: 'out',
      })
      openMailto(toAddress, subjectText, bodyText)
      requestClose()
    }, 350)
  }

  return (
    <div className={`fixed inset-0 z-[60] flex justify-end${closing ? ' is-sheet-closing' : ''}`} role="presentation">
      {/* Forms do not close on a backdrop click (that would discard the input); use Cancel, × or Esc. */}
      <div aria-hidden="true" className="ui-scrim crm-sheet-scrim absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-email-title"
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 id="send-email-title" className="font-display text-sm font-bold text-ink">
                Send Email
              </h2>
              <p className="mt-0.5 truncate text-xs text-ink-muted">
                To {preselectedLead.contact} ·{' '}
                <span className="font-semibold text-primary">{preselectedLead.name}</span>
              </p>
            </div>
          </div>
          <Button type="button" variant="icon" onClick={requestClose} aria-label="Close">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas px-5 py-5">
          <FormGrid cols={1}>
            <TextField
              htmlFor="send-email-from"
              label="From"
              value={fromAddress}
              readOnly
              error={errors.from}
            />
            <TextField
              htmlFor="send-email-to"
              label="To"
              type="email"
              required
              autoFocus
              error={errors.to}
              value={to}
              onValueChange={(value) => {
                setTo(value)
                clearErr('to')
              }}
              placeholder="name@company.com"
            />
            <TextField
              htmlFor="send-email-subject"
              label="Subject"
              required
              error={errors.subject}
              value={subject}
              onValueChange={(value) => {
                setSubject(value)
                clearErr('subject')
              }}
              placeholder="Email subject"
            />
            <TextAreaField
              htmlFor="send-email-body"
              label="Email body"
              required
              error={errors.body}
              rows={8}
              value={body}
              onValueChange={(value) => {
                setBody(value)
                clearErr('body')
              }}
              placeholder="Write the email…"
            />
          </FormGrid>
          {Object.keys(errors).length > 0 ? (
            <p className="text-xs text-accent" role="alert">
              Please fill the required fields before sending.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-line-subtle bg-surface px-5 py-4">
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" variant="solid" onClick={handleSend} disabled={saving}>
            {saving ? 'Sending…' : 'Send Email'}
          </Button>
        </div>
      </div>
    </div>
  )
}
