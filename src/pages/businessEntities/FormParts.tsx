/** Smaller pieces of the business entity form, laid out as in Task Management. */
import { useEffect, useState } from 'react'
import {
  BUSINESS_ENTITY_LIMITS,
  findBusinessEntityNames,
  type BusinessEntityPort,
  type ContactDraft,
  type FollowUpNoteDraft,
  type LocationDraft,
} from '../../api/businessEntities'
import type { PortOption } from '../../api/businessEntityFillValues'
import { BusinessEntityShareMenu } from '../../components/BusinessEntityShareMenu'
import { Field, IconTooltip, SearchSelect, TextArea, TextField, TextInput } from '../../ui'
import { formatDate } from '../../utils/dateFormat'
import { ICON, Icon, SolidButton } from './ui'

/**
 * Business Entity Name with a dropdown of existing names (from 2 characters): arrow keys move,
 * Enter or a click picks one — a hint against creating duplicates.
 */
export function NameField({ value, error, onChange }: { value: string; error?: string; onChange: (name: string) => void }) {
  const [names, setNames] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const query = value.trim()
  const visible = query.length >= 2 ? names : []

  useEffect(() => {
    if (query.length < 2) {
      setNames([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      findBusinessEntityNames(query, controller.signal)
        .then((rows) => { setNames(rows); setActive(-1) })
        .catch(() => setNames([]))
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function pick(name: string) {
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="relative min-w-0 sm:col-span-2">
      <TextField
        label="Business Entity Name"
        required
        error={error}
        maxLength={BUSINESS_ENTITY_LIMITS.name}
        placeholder="Enter Business Entity Name"
        value={value}
        autoComplete="off"
        onValueChange={(next) => {
          onChange(next)
          setOpen(next.trim().length >= 2)
        }}
        onFocus={() => { if (query.length >= 2) setOpen(true) }}
        onBlur={() => window.setTimeout(() => setOpen(false), 200)}
        onKeyDown={(e) => {
          if (!open || visible.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, visible.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(visible[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && visible.length > 0 ? (
        <div role="listbox" className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-48 overflow-auto rounded-lg border border-line bg-surface shadow-overlay">
          {visible.map((name, i) => (
            <div key={name} role="option" aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 text-xs text-ink ${i === active ? 'bg-surface-hover' : 'hover:bg-surface-hover'}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(name) }}>
              {name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Preferred ports: pick a port and Assign; assigned ports show as removable chips. */
export function PortsField({
  ports,
  options,
  onAdd,
  onRemove,
}: {
  ports: readonly BusinessEntityPort[]
  options: readonly PortOption[]
  onAdd: (port: BusinessEntityPort) => void
  onRemove: (index: number) => void
}) {
  const [picked, setPicked] = useState<PortOption | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <SearchSelect<PortOption>
            options={options}
            value={picked}
            onChange={setPicked}
            getKey={(p) => String(p.portNo)}
            getLabel={(p) => p.portName}
            placeholder="Select Port"
            searchPlaceholder="Search port…"
          />
        </div>
        <SolidButton className="h-10 px-4" disabled={!picked} onClick={() => {
          // Already assigned ports are ignored.
          if (picked && !ports.some((p) => p.portNo === picked.portNo)) onAdd({ portNo: picked.portNo, portName: picked.portName })
          setPicked(null)
        }}>
          Assign
        </SolidButton>
      </div>
      {ports.length === 0 ? (
        <p className="py-3 text-center text-[11px] font-medium text-ink-faint">No ports assigned to this company profile.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ports.map((port, i) => (
            <div key={port.portNo} className="flex items-center gap-1.5 rounded-md border border-primary/15 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              <span>{port.portName || `Port ${port.portNo}`}</span>
              <IconTooltip label="Unassign Port">
                <button type="button" aria-label="Unassign Port" onClick={() => onRemove(i)}
                  className="rounded p-0.5 text-primary/70 transition-colors hover:bg-surface hover:text-primary">
                  <Icon d={ICON.x} size={10} strokeWidth={2.5} />
                </button>
              </IconTooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Dated follow-up remarks: pick a date, type a note, Add Note; saved notes listed newest first. */
export function FollowUpNotesField({
  notes,
  onAdd,
  onRemove,
}: {
  notes: readonly FollowUpNoteDraft[]
  onAdd: (note: FollowUpNoteDraft) => void
  onRemove: (index: number) => void
}) {
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const max = BUSINESS_ENTITY_LIMITS.followUpNote

  function add() {
    if (!note.trim()) return
    onAdd({ date, note: note.trim() })
    setDate('')
    setNote('')
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-end gap-x-3 gap-y-2.5 sm:grid-cols-[minmax(140px,180px)_minmax(0,1fr)_auto]">
        <Field label="Date">
          <TextInput type="date" value={date} onValueChange={setDate} aria-label="Follow-up date" />
        </Field>
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-soft">Note</span>
            <span className="text-[10px] font-medium tabular-nums text-ink-faint">{note.length}/{max}</span>
          </div>
          <TextArea rows={1} maxLength={max} placeholder="Enter follow-up note..." value={note} onValueChange={setNote}
            className="!min-h-10 resize-none" aria-label="Follow-up note"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }} />
        </div>
        <SolidButton className="h-10 w-full px-4 sm:w-auto" onClick={add} disabled={!note.trim()}>
          <Icon d={ICON.plus} size={14} strokeWidth={2.5} />
          Add Note
        </SolidButton>
      </div>
      {notes.length ? (
        <div className="space-y-2 border-t border-line pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Saved notes ({notes.length})</p>
          <ul className="space-y-2">
            {notes.map((n, i) => (
              <li key={`${i}-${n.date}`}
                className="group grid grid-cols-1 gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-primary/35 hover:bg-surface-muted sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                <div className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary-soft px-2 text-[10px] font-semibold tabular-nums text-primary">
                  <Icon d={ICON.calendar} size={12} className="shrink-0" />
                  <span className="truncate">{n.date ? formatDate(n.date) : 'No date'}</span>
                </div>
                <p className="min-w-0 whitespace-pre-wrap break-words text-xs font-medium leading-snug text-ink">{n.note}</p>
                <button type="button" onClick={() => onRemove(i)} title="Remove Note" aria-label="Remove note"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-faint opacity-70 transition-colors hover:bg-accent-soft hover:text-accent group-hover:opacity-100">
                  <Icon d={ICON.trash} size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="pt-0.5 text-[11px] font-medium text-ink-faint">No follow-up notes yet. Pick a date and add a remark above.</p>
      )}
    </div>
  )
}

function HoverAction({ label, d, tone, onClick }: { label: string; d: string; tone: 'edit' | 'delete'; onClick: () => void }) {
  return (
    <IconTooltip label={label}>
      <button type="button" aria-label={label} onClick={onClick}
        className={`rounded-md p-1.5 text-ink-faint transition-colors ${tone === 'edit' ? 'hover:bg-primary-soft hover:text-primary' : 'hover:bg-accent-soft hover:text-accent'}`}>
        <Icon d={d} size={13} />
      </button>
    </IconTooltip>
  )
}

function typeTone(typeName: string) {
  if (typeName === 'Office') return 'border-primary/30 bg-primary-soft text-primary'
  if (typeName === 'Warehouse') return 'border-warning-line bg-warning-soft text-warning'
  return 'border-success-line bg-success-soft text-success'
}

export function LocationCard({ location, typeName, zoneLabel, onEdit, onRemove }: {
  location: LocationDraft; typeName: string; zoneLabel: string; onEdit: () => void; onRemove: () => void
}) {
  const place = [location.cityName, location.stateName, location.countryName, location.pinCode]
  return (
    <div className="group relative rounded-lg border border-line bg-surface-muted p-3.5 transition-colors hover:border-primary/35">
      <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
        <HoverAction label="Edit Location" d={ICON.edit} tone="edit" onClick={onEdit} />
        <HoverAction label="Remove Location" d={ICON.trash} tone="delete" onClick={onRemove} />
      </div>
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg border border-line bg-surface p-2 text-primary">
          <Icon d={ICON.building} size={15} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 space-y-1 pr-12">
          {typeName ? <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-semibold ${typeTone(typeName)}`}>{typeName}</span> : null}
          <p className="text-xs font-semibold leading-snug text-ink">{location.address}</p>
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-medium text-ink-muted">
            {place.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 ? <span className="text-ink-faint">•</span> : null}
                <span className={i === 3 ? 'font-mono text-ink-faint' : ''}>{part}</span>
              </span>
            ))}
          </div>
          {zoneLabel ? (
            <div className="flex min-w-0 items-center gap-1 text-[10px] font-medium text-ink-muted">
              <Icon d={ICON.clock} size={10} className="shrink-0" />
              <span className="truncate">{zoneLabel}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function ContactCard({ contact, entityName, entityCode, onEdit, onRemove }: {
  contact: ContactDraft; entityName: string; entityCode?: string; onEdit: () => void; onRemove: () => void
}) {
  const active = contact.status !== 'Inactive'
  return (
    <div className="group relative rounded-lg border border-line bg-surface-muted p-3.5 transition-colors hover:border-primary/35">
      <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
        <BusinessEntityShareMenu mode="contact" contact={{
          companyName: entityName, companyCode: entityCode, name: contact.name,
          designation: contact.designation, phone: contact.phone, email: contact.email,
        }} />
        <HoverAction label="Edit Contact" d={ICON.edit} tone="edit" onClick={onEdit} />
        <HoverAction label="Remove Contact" d={ICON.trash} tone="delete" onClick={onRemove} />
      </div>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-semibold uppercase text-primary">
          {contact.name ? contact.name.substring(0, 2) : 'CP'}
        </div>
        <div className="min-w-0 space-y-1 pr-16">
          <h4 className="truncate text-xs font-semibold leading-snug text-ink">{contact.name}</h4>
          <div className="flex flex-wrap items-center gap-1">
            {contact.designation ? (
              <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[9px] font-semibold text-ink-soft">{contact.designation}</span>
            ) : null}
            <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-semibold ${active ? 'border-success-line bg-success-soft text-success' : 'border-line bg-surface-hover text-ink-muted'}`}>
              {contact.status || 'Active'}
            </span>
          </div>
          <div className="space-y-0.5 text-[10px] font-medium text-ink-muted">
            <p><span className="text-ink-faint">Phone:</span> <strong className="font-semibold text-ink">{contact.phone}</strong></p>
            <p><span className="text-ink-faint">Email:</span> <strong className="select-all font-semibold text-primary">{contact.email}</strong></p>
          </div>
        </div>
      </div>
    </div>
  )
}
