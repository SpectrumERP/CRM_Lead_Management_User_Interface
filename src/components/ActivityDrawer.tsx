import { useEffect, useState } from 'react'
import { useSheetClose } from './useSheetClose'
import { useLeadFormFillValues } from './useLeadFormFillValues'
import {
  Activity,
  ActivityFormStatus,
  ActivityType,
  toStoredActivityStatus,
} from '../data/activities'
import { api } from '../api/crm'
import { isLeadLocked } from '../data/leads'
import { useApiQuery } from '../api/useApiQuery'
import {
  Button,
  ChoiceField,
  DetailField,
  FormGrid,
  SearchSelectField,
  TextAreaField,
  TextField,
} from '../ui'
import { UserSelectField } from './UserSelect'
import { FIELD_LIMITS } from '../constants/fieldLimits'
import { formatDate } from '../utils/dateFormat'
import { saveConfirm, useConfirm } from '../contexts/ConfirmContext'

interface ActivityDrawerProps {
  preselectedLead?: { id: string; name: string; contact: string } | null
  followUpFrom?: Activity | null
  /** Edit this activity: the form starts from it and `onSave` returns it with the same id. */
  editing?: Activity | null
  onClose: () => void
  onSave: (a: Activity) => void
  /** Render the form inside a parent card instead of a side sheet. */
  inline?: boolean
  /** Editing: show the details read-only; only Notes / Outcome and Status can change. */
  notesOnly?: boolean
}

type LeadOption = { id: string; name: string; contact: string }


export default function ActivityDrawer({ preselectedLead, followUpFrom, editing, onClose, onSave, inline = false, notesOnly = false }: ActivityDrawerProps) {
  const confirm = useConfirm()
  // Server activity types and server leads only (what the save APIs accept).
  const { values: fill } = useLeadFormFillValues()
  const activeActivityTypeNames = fill ? fill.leadActivityTypes.map((t) => t.leadActivityTypeName) : []
  const { data: leadPage } = useApiQuery(() => api.leads.list(), [])
  // Server leads only, and not locked ones (converted / completed stage take no new activities).
  const leadOptions: LeadOption[] = (leadPage?.items ?? []).filter((lead) => lead.spectrum && !isLeadLocked(lead)).map((lead) => ({
    id: lead.id,
    name: lead.companyName,
    contact: lead.contactPerson,
  }))

  const [type, setType] = useState<ActivityType>(editing?.type ?? (followUpFrom ? 'Follow-up' : 'Phone Call'))
  useEffect(() => {
    // Use the server's own name for the preferred type (e.g. "Follow Up"), else its first type.
    if (!activeActivityTypeNames.length || activeActivityTypeNames.includes(type)) return
    const norm = (v: string) => v.toLowerCase().replace(/[\s_-]+/g, '')
    const match = activeActivityTypeNames.find((name) => norm(name) === norm(type))
    setType((match ?? activeActivityTypeNames[0]) as ActivityType)
  }, [activeActivityTypeNames, type])
  const [subject, setSubject] = useState(editing?.subject ?? (followUpFrom ? `Follow-up: ${followUpFrom.subject}` : ''))
  const [dueDate, setDueDate] = useState(editing?.scheduleDate ?? '')
  const [assignedTo, setAssignedTo] = useState(editing?.assignedTo ?? followUpFrom?.assignedTo ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  // New work, including a follow-up of a finished activity, starts Open. Editing keeps the status —
  // a completed activity can stay Completed (with its remark) or be reopened / closed.
  const [formStatus, setFormStatus] = useState<ActivityFormStatus | 'Completed'>(
    editing?.status === 'Completed' ? 'Completed' : editing?.status === 'Closed' ? 'Closed' : 'Open',
  )
  const [closureDate, setClosureDate] = useState(editing?.closureDate ?? '')
  const [remark, setRemark] = useState(editing?.outcome ?? '')
  const statusOptions = editing?.status === 'Completed' ? (['Open', 'Closed', 'Completed'] as const) : (['Open', 'Closed'] as const)
  const [lead, setLead] = useState<LeadOption | null>(() => {
    if (editing) return { id: editing.leadId, name: editing.leadName, contact: editing.contactPerson }
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
  const isCompleted = formStatus === 'Completed'
  const typeOptions = activeActivityTypeNames

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
    if (isCompleted && !remark.trim()) errs.remark = 'Completion remark is required when status is Completed'
    return errs
  }

  async function handleSave() {
    if (saving) return
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    if (!lead) return
    if (!(await confirm(saveConfirm('Activity', Boolean(editing))))) return
    setSaving(true)
    window.setTimeout(() => {
      onSave({
        ...editing,
        id: editing?.id ?? `ACT-${Date.now()}`,
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
        // Open → Pending; Closed → Closed with its closure date; Completed (Mark Complete, or kept when
        // editing a completed activity) with its remark.
        status: isCompleted ? 'Completed' : toStoredActivityStatus(formStatus as ActivityFormStatus),
        outcome: isCompleted ? remark.trim() : '',
        closureDate: isClosed ? closureDate : undefined,
        completeDate: isCompleted ? (editing?.completeDate ?? '') : '',
        completeTime: isCompleted ? (editing?.completeTime ?? '') : '',
        hasAttachment: editing?.hasAttachment ?? false,
        parentActivityId: editing?.parentActivityId ?? followUpFrom?.id,
      })
      dismiss()
    }, 400)
  }

  const fields = (
    <div className={inline ? 'space-y-4' : 'min-h-0 flex-1 space-y-4 overflow-y-auto p-5'}>
      <FormGrid>
        {notesOnly ? (
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface-muted p-4 lg:col-span-2">
            <DetailField label="TYPE" value={type} />
            <DetailField label="DUE DATE" value={formatDate(dueDate)} />
            <DetailField label="SUBJECT" value={subject} className="col-span-2" />
            <DetailField label="LEAD" value={lead?.name} className="col-span-2" />
            <DetailField label="ASSIGNED TO" value={assignedTo} />
          </div>
        ) : (
          <>
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
          maxLength={FIELD_LIMITS.activitySubject}
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

        <UserSelectField
          label="Assigned To"
          required
          error={errors.assignedTo}
          placeholder="Select assignee"
          value={assignedTo}
          onValueChange={(value) => {
            setAssignedTo(value)
            clearErr('assignedTo')
          }}
        />

          </>
        )}

        <TextAreaField
          fieldClassName="lg:col-span-2"
          label="Notes / Outcome"
          maxLength={FIELD_LIMITS.activityNotesOutcome}
          rows={4}
          value={notes}
          onValueChange={setNotes}
          placeholder="Notes, discussion, or outcome…"
        />

        <ChoiceField
          label="Status"
          name="activity-form-status"
          layout="radio"
          options={statusOptions}
          value={formStatus}
          onChange={(value) => {
            setFormStatus(value)
            clearErr('remark')
            if (value !== 'Closed') {
              setClosureDate('')
              clearErr('closureDate')
              return
            }
            setClosureDate((current) => current || new Date().toISOString().slice(0, 10))
          }}
        />

        {isCompleted ? (
          <TextAreaField
            fieldClassName="lg:col-span-2"
            label="Completion Remark"
            required
            maxLength={FIELD_LIMITS.activityNotesOutcome}
            rows={3}
            error={errors.remark}
            value={remark}
            onValueChange={(value) => {
              setRemark(value)
              clearErr('remark')
            }}
            placeholder="What was the result?"
          />
        ) : null}

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
            {saving ? 'Saving…' : editing ? 'Update Activity' : 'Save Activity'}
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
      {/* Forms do not close on a backdrop click (that would discard the input); use Cancel, × or Esc. */}
      <div aria-hidden="true" className="ui-scrim crm-sheet-scrim absolute inset-0" />

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
              {editing ? 'Edit Activity' : followUpFrom ? 'Create Follow-up Task' : 'Add Activity'}
            </h2>
              {editing ? (
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  Editing: <span className="font-semibold text-primary">{editing.subject}</span>
                </p>
              ) : followUpFrom ? (
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
