import { lazy, Suspense, useMemo, useRef, useState } from 'react'
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

const ENTITY_COLUMNS: TableSearchColumn<EntityOption>[] = [
  { header: 'Business Entity', getValue: (o) => o.name, truncate: true },
  { header: 'Code', getValue: (o) => o.code || '—', width: '6.5rem' },
  { header: 'Type', getValue: (o) => o.type || '—', width: '9rem', truncate: true },
  { header: 'Location', getValue: (o) => o.city || '—', width: '12rem', truncate: true },
]

const CONTACT_COLUMNS: TableSearchColumn<ContactPick>[] = [
  { header: 'Contact Person', getValue: (c) => c.name, truncate: true },
  { header: 'Designation', getValue: (c) => c.designation || '—', width: '11rem', truncate: true },
  { header: 'Email', getValue: (c) => c.email || '—', width: 'minmax(0,1fr)', truncate: true },
]

export interface EntityContactsFieldsProps {
  value: EntityContactsValue
  onChange: (next: EntityContactsValue) => void
  errors?: { entity?: string; contact?: string }
  /** Show the entity but do not allow changing it (e.g. editing an opportunity). */
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
  const [creating, setCreating] = useState(false)
  // Latest value for the read-back after a create (the user may pick something else meanwhile).
  const valueRef = useRef(value)
  valueRef.current = value
  const canCreate = entityField.remote && entityRights.isSave && !entityLocked

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
      />
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
          />
        </Field>
        {secondary.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {secondary.map((c) => (
              <Tag
                key={c.id}
                label={c.designation ? `${c.name} · ${c.designation}` : c.name}
                title={c.email || c.name}
                onRemove={() => onChange({ ...value, secondary: secondary.filter((x) => x.id !== c.id) })}
                removeLabel={`Remove ${c.name}`}
              />
            ))}
          </div>
        ) : null}
      </div>
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
