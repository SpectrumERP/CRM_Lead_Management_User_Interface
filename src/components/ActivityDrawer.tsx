import { useState } from 'react'
import { useSheetClose } from './useSheetClose'
import {
  Activity,
  ActivityFormStatus,
  ActivityType,
  SALESPERSONS,
  activityFormStatus,
  toStoredActivityStatus,
} from '../data/activities'
import { useMasterData } from '../contexts/MasterDataContext'
import { api } from '../api/crm'
import { useApiQuery } from '../api/useApiQuery'
import {
  Button,
  ChoiceField,
  FormGrid,
  SearchSelectField,
  SelectField,
  TextAreaField,
  TextField,
} from '../ui'

interface ActivityDrawerProps {
  preselectedLead?: { id: string; name: string; contact: string } | null
  followUpFrom?: Activity | null
  onClose: () => void
  onSave: (a: Activity) => void
  /** Render the form inside a parent card instead of a side sheet. */
  inline?: boolean
}

type LeadOption = { id: string; name: string; contact: string }

export default function ActivityDrawer({ preselectedLead, followUpFrom, onClose, onSave, inline = false }: ActivityDrawerProps) {
  const { activeActivityTypeNames } = useMasterData()
  const { data: leadPage } = useApiQuery(() => api.leads.list(), [])
  const leadOptions: LeadOption[] = (leadPage?.items ?? []).map((lead) => ({
    id: lead.id,
    name: lead.companyName,
    contact: lead.contactPerson,
  }))

  const [type, setType] = useState<ActivityType>(followUpFrom ? 'Follow-up' : 'Phone Call')
  const [subject, setSubject] = useState(followUpFrom ? `Follow-up: ${followUpFrom.subject}` : '')
  const [dueDate, setDueDate] = useState('')
  const [assignedTo, setAssignedTo] = useState(followUpFrom?.assignedTo ?? 'Priya Mehta')
  const [notes, setNotes] = useState('')
  const [formStatus, setFormStatus] = useState<ActivityFormStatus>(
    followUpFrom ? activityFormStatus(followUpFrom.status) : 'Open',
  )
  const [closureDate, setClosureDate] = useState('')
  const [lead, setLead] = useState<LeadOption | null>(() => {
    if (preselectedLead) return preselectedLead
    if (followUpFrom) {
      return { id: followUpFrom.leadId, name: followUpFrom.leadName, contact: followUpFrom.contactPerson }
    }
    return null
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { closing, requestClose } = useSheetClose(onClose)
  const dismiss = inline ? onClose : requestClose
  const fromLeadForm = Boolean(preselectedLead)
  const isClosed = formStatus === 'Closed'
  const typeOptions = activeActivityTypeNames.length ? activeActivityTypeNames : [type]

  function clearErr(key: string) {
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!type) errs.type = 'Type is required'
    if (!subject.trim()) errs.subject = 'Subject is required'
    if (!lead) errs.lead = 'Lead is required'
    if (!dueDate) errs.dueDate = 'Due date is required'
    if (!assignedTo) errs.assignedTo = 'Assigned to is required'
    if (isClosed && !closureDate) errs.closureDate = 'Closure date is required when status is Closed'
    return errs
  }

  function handleSave() {
    if (saving) return
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    if (!lead) return
    setSaving(true)
    window.setTimeout(() => {
      onSave({
        id: `ACT-${Date.now()}`,
        type,
        subject: subject.trim(),
        leadId: lead.id,
        leadName: lead.name,
        contactPerson: lead.contact,
        assignedTo,
        scheduleDate: dueDate,
        scheduleTime: '',
        reminder: 'None',
        notes: notes.trim(),
        status: toStoredActivityStatus(formStatus),
        outcome: isClosed ? notes.trim() : '',
        completeDate: isClosed ? closureDate : '',
        completeTime: '',
        hasAttachment: false,
        parentActivityId: followUpFrom?.id,
      })
      dismiss()
    }, 400)
  }

  const fields = (
    <div className={inline ? 'space-y-4' : 'min-h-0 flex-1 space-y-4 overflow-y-auto p-5'}>
      <FormGrid>
        <SearchSelectField
          fieldClassName="lg:col-span-2"
          label="Type"
          required
          error={errors.type}
          options={typeOptions}
          value={type}
          onChange={(next) => {
            if (!next) return
            setType(next as ActivityType)
            clearErr('type')
          }}
          getKey={(item) => item}
          getLabel={(item) => item}
          placeholder="Search and select type…"
          searchPlaceholder="Search type…"
          emptyText="No matching types"
          clearable={false}
        />

        <TextField
          fieldClassName="lg:col-span-2"
          label="Subject"
          required
          error={errors.subject}
          value={subject}
          onValueChange={(value) => {
            setSubject(value)
            clearErr('subject')
          }}
          placeholder="Brief description of this activity"
        />

        {!fromLeadForm ? (
          <SearchSelectField
            fieldClassName="lg:col-span-2"
            label="Lead"
            required
            error={errors.lead}
            options={leadOptions}
            value={lead}
            onChange={(next) => {
              setLead(next)
              if (next) clearErr('lead')
            }}
            getKey={(item) => item.id}
            getLabel={(item) => item.name}
            placeholder="Search and select lead…"
            searchPlaceholder="Type to search…"
          />
        ) : null}

        <TextField
          label="Due Date"
          required
          type="date"
          error={errors.dueDate}
          value={dueDate}
          onValueChange={(value) => {
            setDueDate(value)
            clearErr('dueDate')
          }}
        />

        <SelectField
          label="Assigned To"
          required
          error={errors.assignedTo}
          options={SALESPERSONS}
          placeholder="Select assignee"
          value={assignedTo}
          onValueChange={(value) => {
            setAssignedTo(value)
            clearErr('assignedTo')
          }}
        />

        <TextAreaField
          fieldClassName="lg:col-span-2"
          label="Notes / Outcome"
          rows={4}
          value={notes}
          onValueChange={setNotes}
          placeholder="Notes, discussion, or outcome…"
        />

        <ChoiceField
          label="Status"
          name="activity-form-status"
          layout="radio"
          options={['Open', 'Closed'] as const}
          value={formStatus}
          onChange={(value) => {
            setFormStatus(value)
            if (value === 'Open') {
              setClosureDate('')
              clearErr('closureDate')
              return
            }
            setClosureDate((current) => current || new Date().toISOString().slice(0, 10))
          }}
        />

        {isClosed ? (
          <TextField
            label="Closure Date"
            required
            type="date"
            error={errors.closureDate}
            value={closureDate}
            onValueChange={(value) => {
              setClosureDate(value)
              clearErr('closureDate')
            }}
          />
        ) : null}
      </FormGrid>

      {Object.keys(errors).length > 0 ? (
        <p className="text-xs text-accent" role="alert">
          Please fill the required fields before saving.
        </p>
      ) : null}
    </div>
  )

  const actions = (
        <div className={inline ? 'mt-4 flex justify-end gap-2' : 'flex shrink-0 gap-2.5 border-t border-line-subtle px-5 py-4'}>
          <Button variant="secondary" className={inline ? '' : 'flex-1'} onClick={dismiss}>
            Cancel
          </Button>
          <Button variant="solid" className={inline ? '' : 'flex-1'} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Activity'}
          </Button>
        </div>
  )

  if (inline) {
    return (
      <div className="rounded-xl border border-line bg-surface-muted p-4">
        {fields}
        {actions}
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 z-[60] flex justify-end${closing ? ' is-sheet-closing' : ''}`}>
      <button
        type="button"
        aria-label="Close dialog"
        className="ui-scrim crm-sheet-scrim absolute inset-0 border-0 p-0"
        onClick={requestClose}
      />

      <div className="crm-sheet relative z-[1] flex h-full w-[32rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-l border-line bg-surface shadow-overlay sm:max-w-full">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-ink">
              {followUpFrom ? 'Create Follow-up Task' : 'Add Activity'}
            </h2>
              {followUpFrom ? (
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  Follow-up from: <span className="font-semibold text-primary">{followUpFrom.subject}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-primary">Log a call, task, or follow-up for this lead</p>
              )}
            </div>
          </div>
          <Button type="button" variant="icon" onClick={requestClose} aria-label="Close">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        {fields}
        {actions}
      </div>
    </div>
  )
}
