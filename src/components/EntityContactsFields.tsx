import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  businessEntityFromDetail,
  emptyContact,
  loadBusinessEntity,
  saveBusinessEntityContact,
  searchContactPersons,
  type ContactDraft,
} from '../api/businessEntities'
import { toApiError } from '../api/errors'
import { FORM_NO } from '../api/formRights'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'
import { useFormRights } from '../contexts/FormRightsContext'
import { useOptionalToast } from '../contexts/ToastContext'
import type { LeadContactEntry } from '../data/leads'
import { FormGrid, Spinner, TableSearchSelect, TableSearchSelectField, Tag, Field, type TableSearchColumn } from '../ui'
import OverlayShell from './OverlayShell'
import { loadCreatedEntity, spectrumEntityId, useBusinessEntityOptions, type EntityOption } from './useBusinessEntityOptions'
import { useContactPersonOptions } from './useContactPersonOptions'

// The entity form loads only when someone creates an entity from the field.
const CreateBusinessEntity = lazy(() => import('../pages/CreateBusinessEntity'))
// The Business Entity form's contact drawer, when someone adds a contact person from a contact field.
const ContactDialog = lazy(() => import('../pages/businessEntities/FormDialogs').then((m) => ({ default: m.ContactDialog })))

/**
 * Each contact person of the selected server entity by number, from its record — the contact search
 * has no phone. Loaded once per entity, only while `needed` (a contact is picked, so its details show).
 */
function useEntityContactDetails(entity: EntityOption | null, headOfficeNo: number | null | undefined, needed: boolean) {
  const businessEntityNo = entity?.source === 'spectrum' ? entity.businessEntityNo : undefined
  const [loaded, setLoaded] = useState<{ businessEntityNo: number; contacts: Map<number, ContactDraft> } | null>(null)
  const loadedNo = loaded?.businessEntityNo
  useEffect(() => {
    if (!businessEntityNo || !headOfficeNo || !needed || loadedNo === businessEntityNo) return
    let cancelled = false
    loadBusinessEntity(businessEntityNo, headOfficeNo)
      .then((raw) => {
        if (cancelled) return
        const detail = businessEntityFromDetail(raw)
        const contacts = new Map<number, ContactDraft>()
        for (const c of [detail.primaryContact, ...detail.contacts]) if (c.contactPersonNo) contacts.set(c.contactPersonNo, c)
        setLoaded({ businessEntityNo, contacts })
      })
      .catch(() => undefined) // The card then shows what the contact search returned.
    return () => {
      cancelled = true
    }
  }, [businessEntityNo, headOfficeNo, needed, loadedNo])
  return loaded && loaded.businessEntityNo === businessEntityNo ? loaded.contacts : undefined
}

const PHONE_PATH =
  'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z'
const MAIL_PATH = 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'

function LineIcon({ d }: { d: string }) {
  return (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 text-ink-faint" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

/** The picked primary contact's designation, phone and email, under its field (phone / email open the mail / dialler). */
function ContactDetailsLine({ designation, phone, email }: { designation: string; phone: string; email: string }) {
  if (!designation && !phone && !email) return null
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted" aria-label="Primary contact details">
      {designation ? <span className="font-semibold text-ink-soft">{designation}</span> : null}
      {phone ? (
        <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 hover:text-primary hover:underline">
          <LineIcon d={PHONE_PATH} /> {phone}
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-primary hover:underline">
          <LineIcon d={MAIL_PATH} /> <span className="truncate">{email}</span>
        </a>
      ) : null}
    </p>
  )
}

/**
 * The contact just added to an entity: the save API returns no number, so it is looked up by name
 * (and email) — the newest match.
 */
async function findAddedContact(businessEntityNo: number, contact: ContactDraft): Promise<ContactPick | null> {
  const name = contact.name.trim().toLowerCase()
  const email = contact.email.trim().toLowerCase()
  const rows = await searchContactPersons({ businessEntityNo, keywordSearch: contact.name.trim() })
  const matches = rows
    .filter((r) => r.contactPersonName.trim().toLowerCase() === name && (!email || (r.email ?? '').trim().toLowerCase() === email))
    .sort((a, b) => b.businessEntityContactPersonDetailNo - a.businessEntityContactPersonDetailNo)
  const row = matches[0]
  if (!row) return null
  return {
    id: `SPX-CP-${row.businessEntityContactPersonDetailNo}`,
    name: row.contactPersonName,
    designation: row.designation ?? contact.designation,
    email: row.email ?? contact.email,
    phone: contact.phone,
    businessEntityContactPersonDetailNo: row.businessEntityContactPersonDetailNo,
  }
}

/** A contact as the lead / opportunity forms hold it. */
export interface ContactPick {
  id: string
  name: string
  designation: string
  email: string
  phone: string
  /** Set for Spectrum contact persons (what the save APIs take). */
  businessEntityContactPersonDetailNo?: number
}

export interface EntityContactsValue {
  entity: EntityOption | null
  primary: ContactPick | null
  secondary: ContactPick[]
}

export const EMPTY_ENTITY_CONTACTS: EntityContactsValue = { entity: null, primary: null, secondary: [] }

/** Contacts for storing on a lead / opportunity: primary first (flagged), then the secondary ones. */
export function toContactEntries(value: EntityContactsValue): LeadContactEntry[] {
  const all = [value.primary, ...value.secondary].filter((c): c is ContactPick => Boolean(c?.name.trim()))
  return all.map((c, i) => ({
    name: c.name.trim(),
    email: c.email.trim(),
    phones: c.phone.trim() ? [c.phone.trim()] : [],
    primary: i === 0,
    ...(c.designation ? { designation: c.designation } : {}),
    ...(c.businessEntityContactPersonDetailNo ? { businessEntityContactPersonDetailNo: c.businessEntityContactPersonDetailNo } : {}),
  }))
}

/** Stored contacts → primary / secondary picks (primary flag, else the first). */
export function fromContactEntries(entries: readonly LeadContactEntry[] | undefined): Pick<EntityContactsValue, 'primary' | 'secondary'> {
  const list = (entries ?? []).filter((e) => e.name.trim())
  const primaryIndex = Math.max(0, list.findIndex((e) => e.primary))
  const picks = list.map((e, i): ContactPick => ({
    id: e.businessEntityContactPersonDetailNo ? `SPX-CP-${e.businessEntityContactPersonDetailNo}` : `saved-${i}-${e.name}`,
    name: e.name,
    designation: e.designation ?? '',
    email: e.email,
    phone: e.phones[0] ?? '',
    businessEntityContactPersonDetailNo: e.businessEntityContactPersonDetailNo,
  }))
  return {
    primary: picks[primaryIndex] ?? null,
    secondary: picks.filter((_, i) => i !== primaryIndex),
  }
}

/** Server contact detail numbers, primary first. */
export function contactDetailNos(value: EntityContactsValue): number[] {
  return [value.primary, ...value.secondary]
    .map((c) => c?.businessEntityContactPersonDetailNo)
    .filter((no): no is number => Boolean(no))
}

// Shares, not fixed widths: the menu is only as wide as the field, and fixed Type / Location columns
// left the entity name no room on a half-width field.
const ENTITY_COLUMNS: TableSearchColumn<EntityOption>[] = [
  { header: 'Business Entity', getValue: (o) => o.name, width: 'minmax(0,2fr)', truncate: true },
  { header: 'Code', getValue: (o) => o.code || '', width: '6.5rem' },
  { header: 'Type', getValue: (o) => o.type || '', width: 'minmax(0,1fr)', truncate: true },
  { header: 'Location', getValue: (o) => o.city || '', width: 'minmax(0,1fr)', truncate: true },
]

const CONTACT_COLUMNS: TableSearchColumn<ContactPick>[] = [
  { header: 'Contact Person', getValue: (c) => c.name, truncate: true },
  { header: 'Designation', getValue: (c) => c.designation || '', width: '11rem', truncate: true },
  { header: 'Email', getValue: (c) => c.email || '', width: 'minmax(0,1fr)', truncate: true },
]

export interface EntityContactsFieldsProps {
  value: EntityContactsValue
  onChange: (next: EntityContactsValue) => void
  errors?: { entity?: string; contact?: string }
  /** Show the entity but do not allow changing it. */
  entityLocked?: boolean
}

/**
 * Business Entity + single Primary Contact + multiple Secondary Contacts, shared by the lead and
 * opportunity forms. Entities and their contact persons come from the server only.
 */
export default function EntityContactsFields({ value, onChange, errors = {}, entityLocked }: EntityContactsFieldsProps) {
  const { entity, primary, secondary } = value
  const entityField = useBusinessEntityOptions(entity)
  const contactField = useContactPersonOptions(entity)
  const company = useSpectrumCompany()
  const entityRights = useFormRights(FORM_NO.businessEntity)
  const { addToast } = useOptionalToast()
  const contactDetails = useEntityContactDetails(entity, company.headOfficeNo, Boolean(primary) || secondary.length > 0)
  /** A pick's details, completed from the entity's record (phone, and anything the search left out). */
  const detailsOf = (c: ContactPick) => {
    const saved = c.businessEntityContactPersonDetailNo ? contactDetails?.get(c.businessEntityContactPersonDetailNo) : undefined
    return {
      designation: c.designation || saved?.designation || '',
      email: c.email || saved?.email || '',
      phone: c.phone || saved?.phone || '',
    }
  }
  const [creating, setCreating] = useState(false)
  // Adding a contact person to the selected entity: as the primary contact, or a secondary one.
  const [addingContact, setAddingContact] = useState<'primary' | 'secondary' | null>(null)
  // Latest value for the read-back after a create (the user may pick something else meanwhile).
  const valueRef = useRef(value)
  valueRef.current = value
  const canCreate = entityField.remote && entityRights.isSave && !entityLocked
  // Adding a contact person changes the entity, so it takes the right to update entities.
  const canAddContact = contactField.active && entityRights.isUpdate
  const addContactAction = (as: 'primary' | 'secondary') =>
    canAddContact ? { label: 'Add Contact Person', onSelect: () => setAddingContact(as) } : undefined

  // Contact persons of the selected server entity only. An entity known only by name (older record,
  // no entity number) has nothing to query — the user picks the entity again.
  const needsEntityPick = Boolean(entity) && !contactField.active
  const contactOptions = useMemo<ContactPick[]>(
    () =>
      contactField.active
        ? contactField.options.map((c) => ({
            id: c.id,
            name: c.name,
            designation: c.designation,
            email: c.email,
            phone: '',
            businessEntityContactPersonDetailNo: c.businessEntityContactPersonDetailNo,
          }))
        : [],
    [contactField.active, contactField.options],
  )

  const chosenIds = new Set([primary?.id, ...secondary.map((c) => c.id)].filter(Boolean))
  // Keep the current primary selectable even if it is not on the loaded page.
  const primaryOptions = primary && !contactOptions.some((c) => c.id === primary.id) ? [primary, ...contactOptions] : contactOptions
  const secondaryOptions = contactOptions.filter((c) => !chosenIds.has(c.id))
  const serverSearch = {
    onQueryChange: contactField.onQueryChange,
    onOpenChange: contactField.onOpenChange,
    loading: contactField.loading,
    footer: contactField.footer,
  }

  function setEntity(next: EntityOption | null) {
    // Contacts belong to one entity — a different entity starts them over.
    if (next?.id === entity?.id) return
    onChange({ entity: next, primary: null, secondary: [] })
  }

  /** A new entity from the "Create Business Entity" drawer: select it, then fill its code and primary contact. */
  async function entityCreated(businessEntityNo: number, name: string) {
    setCreating(false)
    const id = spectrumEntityId(businessEntityNo)
    onChange({ entity: { id, name, type: '', city: '', source: 'spectrum', businessEntityNo }, primary: null, secondary: [] })
    addToast('success', 'Business Entity Created', `"${name}" is selected.`)
    if (!company.headOfficeNo) return
    try {
      const { entity: created, primaryContact: p } = await loadCreatedEntity(businessEntityNo, company.headOfficeNo)
      if (valueRef.current.entity?.id !== id) return
      onChange({
        entity: created,
        primary: p
          ? {
              id: `SPX-CP-${p.contactPersonNo}`,
              name: p.name,
              designation: p.designation,
              email: p.email,
              phone: p.phone,
              businessEntityContactPersonDetailNo: p.contactPersonNo ?? undefined,
            }
          : null,
        secondary: [],
      })
    } catch {
      // The entity stays selected by name and number; its contacts load when the field opens.
    }
  }

  /** Save the new contact person on the entity, then select it on this form. */
  async function saveNewContact(contact: ContactDraft) {
    const businessEntityNo = entity?.source === 'spectrum' ? entity.businessEntityNo : undefined
    const as = addingContact
    if (!businessEntityNo || !as) return
    try {
      await saveBusinessEntityContact(businessEntityNo, contact)
    } catch (err) {
      addToast('error', 'Failed to add contact person', toApiError(err).message)
      return
    }
    setAddingContact(null)
    contactField.reload()
    let added: ContactPick | null = null
    try {
      added = await findAddedContact(businessEntityNo, contact)
    } catch {
      // Saved; it is just not selected (below).
    }
    const current = valueRef.current
    if (!added || current.entity?.id !== entity?.id) {
      addToast('success', 'Contact person added', `"${contact.name.trim()}" was added to ${entity?.name ?? 'the business entity'}. Select it from the list.`)
      return
    }
    if (as === 'primary' || !current.primary) {
      onChange({ ...current, primary: added, secondary: current.secondary.filter((c) => c.id !== added.id) })
    } else if (!current.secondary.some((c) => c.id === added.id)) {
      onChange({ ...current, secondary: [...current.secondary, added] })
    }
    addToast('success', 'Contact person added', `"${added.name}" is selected.`)
  }

  function setPrimary(next: ContactPick | null) {
    onChange({ ...value, primary: next, secondary: secondary.filter((c) => c.id !== next?.id) })
  }

  return (
    <FormGrid>
      <TableSearchSelectField
        label="Business Entity"
        required
        error={errors.entity}
        placeholder="Search business entity…"
        options={entityField.options}
        value={entity}
        onChange={setEntity}
        getKey={(o) => o.id}
        getLabel={(o) => o.name}
        filterItem={(o, q) => `${o.name} ${o.code ?? ''} ${o.type} ${o.city}`.toLowerCase().includes(q.trim().toLowerCase())}
        columns={ENTITY_COLUMNS}
        searchPlaceholder="Search by name, code, type or location"
        emptyText="No matching business entities"
        disabled={entityLocked}
        onQueryChange={entityField.onQueryChange}
        onOpenChange={entityField.onOpenChange}
        loading={entityField.loading}
        footer={entityField.footer}
        action={canCreate ? { label: 'Create Business Entity', onSelect: () => setCreating(true) } : undefined}
      />
      <div className="min-w-0">
        <TableSearchSelectField
          label="Primary Contact Person"
          required
          error={errors.contact}
          hint={needsEntityPick ? 'Pick the business entity again to load its contact persons.' : undefined}
          placeholder={entity ? 'Search contact…' : 'Select the business entity first'}
          disabled={!entity}
          options={primaryOptions}
          value={primary}
          onChange={setPrimary}
          getKey={(c) => c.id}
          getLabel={(c) => c.name}
          filterItem={(c, q) => `${c.name} ${c.designation} ${c.email}`.toLowerCase().includes(q.trim().toLowerCase())}
          columns={CONTACT_COLUMNS}
          searchPlaceholder="Search contact person"
          emptyText="No contact persons for this business entity"
          {...serverSearch}
          action={addContactAction('primary')}
        />
        {primary ? <ContactDetailsLine {...detailsOf(primary)} /> : null}
      </div>
      <div className="lg:col-span-2">
        <Field label="Secondary Contact Persons" hint={primary ? undefined : 'Pick the primary contact first.'}>
          <TableSearchSelect
            placeholder={primary ? 'Add secondary contact…' : 'Select the primary contact first'}
            disabled={!entity || !primary}
            options={secondaryOptions}
            value={null}
            onChange={(c) => {
              if (c && !chosenIds.has(c.id)) onChange({ ...value, secondary: [...secondary, c] })
            }}
            getKey={(c) => c.id}
            getLabel={(c) => c.name}
            filterItem={(c, q) => `${c.name} ${c.designation} ${c.email}`.toLowerCase().includes(q.trim().toLowerCase())}
            columns={CONTACT_COLUMNS}
            searchPlaceholder="Search contact person"
            emptyText="No other contacts"
            clearable={false}
            {...serverSearch}
            action={addContactAction('secondary')}
          />
        </Field>
        {secondary.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {secondary.map((c) => {
              const details = detailsOf(c)
              return (
                <Tag
                  key={c.id}
                  label={c.designation ? `${c.name} · ${c.designation}` : c.name}
                  contact={{
                    name: c.name,
                    designation: details.designation || undefined,
                    email: details.email,
                    phone: details.phone,
                    company: entity?.name,
                    primary: false,
                  }}
                  onRemove={() => onChange({ ...value, secondary: secondary.filter((x) => x.id !== c.id) })}
                  removeLabel={`Remove ${c.name}`}
                />
              )
            })}
          </div>
        ) : null}
      </div>
      {addingContact ? (
        <Suspense fallback={null}>
          <ContactDialog
            initial={emptyContact()}
            isNew
            subtitle={entity ? `A new contact person at ${entity.name}` : undefined}
            onSave={saveNewContact}
            onClose={() => setAddingContact(null)}
          />
        </Suspense>
      ) : null}
      {creating ? (
        <OverlayShell title="New Business Entity" subtitle="Create it here and it is selected on this form" widthClass="w-full max-w-6xl"
          onClose={() => setCreating(false)}>
          {(requestClose) => (
            <Suspense fallback={<div className="flex justify-center py-16"><Spinner label="Loading form" /></div>}>
              <CreateBusinessEntity
                embedded
                onBack={requestClose}
                onSuccess={(no, name) => void entityCreated(no, name)}
                onToast={addToast}
              />
            </Suspense>
          )}
        </OverlayShell>
      ) : null}
    </FormGrid>
  )
}
