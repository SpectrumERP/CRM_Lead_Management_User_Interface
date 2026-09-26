import { useMemo, useState, type ReactNode } from 'react'
import {
  Button,
  SearchSelect,
  Select,
  TableSearchSelect,
  Tag,
  TextArea,
  TextInput,
} from '../ui'
import { PersonContactCard } from './PersonContactCard'
import { useCrmActions } from '../contexts/CrmStoreContext'
import type { ToastType } from './Toast'
import type { BusinessEntity } from '../data/businessEntities'
import { SALESPERSONS } from '../data/businessEntities'
import type { Contact } from '../data/contacts'
import {
  MAIN_CURRENCIES,
  currencyAmountPrefix,
  findCurrency,
  matchesCurrency,
} from '../data/currencies'
import {
  LEAD_PRIORITIES,
  displayLeadName,
  formatLeadDate,
  formatLeadValue,
  leadDescriptionOf,
  leadPriorityOf,
  leadProductList,
  normalizeOrgName,
  primaryLeadContact,
  secondaryLeadContacts,
  type Lead,
  type LeadContactEntry,
  type LeadPriority,
  type LeadSource,
} from '../data/leads'
import {
  PRODUCTS,
  matchesProduct,
  productLine,
  productUnit,
  productsFromLeadNames,
  type Product,
} from '../data/products'
import { SecondaryContactsMore } from './SecondaryContactsMore'

type FieldKey =
  | 'name'
  | 'description'
  | 'entity'
  | 'primary'
  | 'secondary'
  | 'products'
  | 'priority'
  | 'owner'
  | 'value'
  | 'source'
  | 'closure'

function EditCue() {
  return (
    <span
      className="inline-flex shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100"
      aria-hidden="true"
    >
      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </span>
  )
}

function SaveCancel({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <Button variant="solid" className="!min-h-6 !px-2 !py-0.5 text-[11px]" onClick={onSave} disabled={disabled}>
        Save
      </Button>
      <Button variant="secondary" className="!min-h-6 !px-2 !py-0.5 text-[11px]" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}

function Cell({
  label,
  field,
  editing,
  locked,
  wide,
  full,
  onEdit,
  editor,
  children,
}: {
  label: string
  field?: FieldKey
  editing: FieldKey | null
  locked?: boolean
  wide?: boolean
  full?: boolean
  onEdit?: (field: FieldKey) => void
  editor?: ReactNode
  children: ReactNode
}) {
  const active = Boolean(field && editing === field)
  const editable = Boolean(!locked && field && !active && onEdit)

  function startEdit(event: { target: EventTarget; currentTarget: EventTarget }) {
    if (!editable || !field || !onEdit) return
    const target = event.target as HTMLElement
    if (target.closest('a, button, input, select, textarea, [data-contact-hover-card]')) return
    onEdit(field)
  }

  return (
    <div
      className={`group min-w-0 border-b border-r border-line bg-surface px-3 py-2.5 ${
        active || full
          ? 'col-span-full'
          : wide
            ? 'sm:col-span-2'
            : ''
      } ${active ? 'border-primary/20 bg-primary-soft/50' : ''} ${
        editable
          ? 'cursor-pointer hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary'
          : ''
      }`}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? `Edit ${label}` : undefined}
      onClick={startEdit}
      onKeyDown={(event) => {
        if (!editable || !field || !onEdit) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEdit(field)
        }
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{label}</p>
        {editable ? <EditCue /> : null}
      </div>
      {active ? editor : <div className="min-h-5 text-sm font-semibold leading-snug text-ink">{children}</div>}
    </div>
  )
}

function DetailBand({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden border-b border-line last:border-b-0">
      <div className="border-b border-line bg-surface-muted px-3 py-1.5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">{title}</h3>
      </div>
      <div className="grid grid-cols-1 bg-surface sm:grid-cols-2 xl:grid-cols-4 sm:[&>*:nth-child(2n)]:border-r-0 xl:[&>*:nth-child(2n)]:border-r xl:[&>*:nth-child(4n)]:border-r-0">
        {children}
      </div>
    </section>
  )
}

function ProductChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full truncate rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
      {label}
    </span>
  )
}

function contactsForEntity(entity: BusinessEntity | undefined, contacts: Contact[]) {
  if (!entity) return contacts
  return contacts.filter(
    (item) =>
      item.businessEntityId === entity.id ||
      normalizeOrgName(item.businessEntityName) === normalizeOrgName(entity.name),
  )
}

function entryFromContact(item: Contact, primary: boolean): LeadContactEntry {
  return {
    name: item.name,
    email: item.email,
    phones: item.mobile ? [item.mobile] : [],
    primary,
  }
}

export function LeadIdentityEdit({
  lead,
  editing,
  onEdit,
  onCancel,
  onToast,
}: {
  lead: Lead
  editing: FieldKey | null
  onEdit: (field: FieldKey) => void
  onCancel: () => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}) {
  const { patchLead } = useCrmActions()
  const [nameDraft, setNameDraft] = useState(lead.leadName && lead.leadName !== lead.id ? lead.leadName : displayLeadName(lead))
  const [descriptionDraft, setDescriptionDraft] = useState(leadDescriptionOf(lead))

  function saveName() {
    const next = nameDraft.trim()
    if (!next) return
    patchLead(lead.id, { leadName: next })
    onCancel()
    onToast?.('success', 'Lead Updated', 'Lead name saved.')
  }

  function saveDescription() {
    patchLead(lead.id, { description: descriptionDraft.trim() })
    onCancel()
    onToast?.('success', 'Lead Updated', 'Lead description saved.')
  }

  const description = leadDescriptionOf(lead)

  return (
    <div className="min-w-0">
      {editing === 'name' ? (
        <div>
          <TextInput value={nameDraft} onValueChange={setNameDraft} aria-label="Lead name" />
          <SaveCancel onSave={saveName} onCancel={onCancel} disabled={!nameDraft.trim()} />
        </div>
      ) : (
        <button
          type="button"
          className="group flex w-full min-w-0 cursor-pointer items-start gap-1.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => {
            setNameDraft(lead.leadName && lead.leadName !== lead.id ? lead.leadName : displayLeadName(lead))
            onEdit('name')
          }}
        >
          <h1 className="min-w-0 font-display text-xl font-bold text-ink">{displayLeadName(lead)}</h1>
          <EditCue />
        </button>
      )}
      {editing === 'description' ? (
        <div className="mt-2">
          <TextArea rows={3} value={descriptionDraft} onValueChange={setDescriptionDraft} aria-label="Lead description" />
          <SaveCancel onSave={saveDescription} onCancel={onCancel} />
        </div>
      ) : description ? (
        <button
          type="button"
          className="group mt-1 flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          title={description}
          onClick={() => {
            setDescriptionDraft(description)
            onEdit('description')
          }}
        >
          <p className="min-w-0 truncate font-display text-sm font-semibold text-ink-soft">{description}</p>
          <EditCue />
        </button>
      ) : (
        <button
          type="button"
          className="mt-1 cursor-pointer text-left text-xs font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => {
            setDescriptionDraft('')
            onEdit('description')
          }}
        >
          Add description
        </button>
      )}
    </div>
  )
}

export function LeadSummaryEdit({
  lead,
  entities,
  contacts,
  sources,
  editing,
  onEdit,
  onCancel,
  onToast,
}: {
  lead: Lead
  entities: BusinessEntity[]
  contacts: Contact[]
  sources: string[]
  editing: FieldKey | null
  onEdit: (field: FieldKey) => void
  onCancel: () => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}) {
  const { patchLead } = useCrmActions()
  const entity = useMemo(
    () =>
      entities.find((item) => {
        const name = normalizeOrgName(item.name)
        const key = normalizeOrgName(lead.companyName)
        return name === key || name.startsWith(key) || key.startsWith(name)
      }),
    [entities, lead.companyName],
  )
  const entityContacts = useMemo(() => contactsForEntity(entity, contacts), [entity, contacts])
  const primary = primaryLeadContact(lead)
  const catalogPrimary = entityContacts.find((item) => item.name === primary.name)

  const [entityDraft, setEntityDraft] = useState<BusinessEntity | null>(entity ?? null)
  const [primaryDraft, setPrimaryDraft] = useState<Contact | null>(catalogPrimary ?? null)
  const [secondaryDraft, setSecondaryDraft] = useState<LeadContactEntry[]>(secondaryLeadContacts(lead))
  const [addSecondary, setAddSecondary] = useState<Contact | null>(null)
  const [replacingName, setReplacingName] = useState<string | null>(null)
  const [productDraft, setProductDraft] = useState<Product[]>(() => productsFromLeadNames(leadProductList(lead)))
  const [priorityDraft, setPriorityDraft] = useState<LeadPriority>(leadPriorityOf(lead))
  const [ownerDraft, setOwnerDraft] = useState(lead.assignedSalesperson)
  const [currencyDraft, setCurrencyDraft] = useState(lead.valueCurrency ?? 'INR')
  const [valueDraft, setValueDraft] = useState(String(lead.opportunityValue || ''))
  const [sourceDraft, setSourceDraft] = useState(lead.leadSource)
  const [closureDraft, setClosureDraft] = useState(lead.expectedClosureDate ?? '')

  const entityPool = useMemo(() => contactsForEntity(entityDraft ?? entity, contacts), [entityDraft, entity, contacts])
  const secondaryPool = entityPool.filter(
    (item) =>
      item.name !== (primaryDraft?.name ?? primary.name) &&
      !secondaryDraft.some((entry) => entry.name === item.name),
  )

  function saved(message: string) {
    onCancel()
    onToast?.('success', 'Lead Updated', message)
  }

  function saveEntity() {
    if (!entityDraft) return
    const pool = contactsForEntity(entityDraft, contacts)
    const nextPrimary = pool.find((item) => item.name === lead.contactPerson) ?? pool[0]
    const keptSecondaries = secondaryLeadContacts(lead).filter((item) => pool.some((row) => row.name === item.name))
    const primaryEntry = nextPrimary
      ? entryFromContact(nextPrimary, true)
      : { name: lead.contactPerson, email: lead.email, phones: lead.phone ? [lead.phone] : [], primary: true }
    patchLead(lead.id, {
      companyName: entityDraft.name,
      contactPerson: primaryEntry.name,
      email: primaryEntry.email,
      phone: primaryEntry.phones[0] ?? '',
      contacts: [primaryEntry, ...keptSecondaries],
    })
    saved('Business entity saved.')
  }

  function savePrimary() {
    if (!primaryDraft) return
    const nextPrimary = entryFromContact(primaryDraft, true)
    patchLead(lead.id, {
      contactPerson: nextPrimary.name,
      email: nextPrimary.email,
      phone: nextPrimary.phones[0] ?? '',
      contacts: [nextPrimary, ...secondaryLeadContacts(lead).filter((item) => item.name !== nextPrimary.name)],
    })
    saved('Primary contact saved.')
  }

  function saveSecondary() {
    const currentPrimary = primaryLeadContact(lead)
    patchLead(lead.id, { contacts: [currentPrimary, ...secondaryDraft.map((item) => ({ ...item, primary: false }))] })
    saved('Secondary contacts saved.')
  }

  function saveProducts() {
    const names = productDraft.map((item) => item.itemName.trim()).filter(Boolean)
    patchLead(lead.id, { productTypes: names, productsRequired: names.join(', ') })
    saved('Products saved.')
  }

  function savePriority() {
    patchLead(lead.id, { priority: priorityDraft })
    saved('Lead priority saved.')
  }

  function saveOwner() {
    if (!ownerDraft.trim()) return
    patchLead(lead.id, { assignedSalesperson: ownerDraft })
    saved('Lead owner saved.')
  }

  function saveValue() {
    const amount = Number(valueDraft)
    if (!Number.isFinite(amount) || amount < 0) return
    patchLead(lead.id, { opportunityValue: amount, valueCurrency: currencyDraft })
    saved('Estimated lead value saved.')
  }

  function saveSource() {
    patchLead(lead.id, { leadSource: sourceDraft as LeadSource })
    saved('Lead source saved.')
  }

  function saveClosure() {
    patchLead(lead.id, { expectedClosureDate: closureDraft })
    saved('Expected closure date saved.')
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-surface"
          aria-hidden="true"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </span>
        <h2 className="ui-title truncate text-sm tracking-tight">Lead details</h2>
      </div>

      <div className="overflow-hidden border-t border-line">
        <DetailBand title="Company & contacts">
          <Cell label="Lead ID" editing={editing} locked>
            <span className="font-mono text-ink-soft">{lead.id}</span>
          </Cell>
          <Cell
            label="Business Entity"
            field="entity"
            editing={editing}
            onEdit={(field) => {
              setEntityDraft(entity ?? null)
              onEdit(field)
            }}
            editor={
              <div>
                <SearchSelect
                  options={entities}
                  value={entityDraft}
                  onChange={setEntityDraft}
                  getKey={(item) => item.id}
                  getLabel={(item) => item.name}
                  placeholder="Search company…"
                  clearable={false}
                />
                <SaveCancel onSave={saveEntity} onCancel={onCancel} disabled={!entityDraft} />
              </div>
            }
          >
            {lead.companyName}
          </Cell>
          <Cell
            label="Primary Contact"
            field="primary"
            editing={editing}
            onEdit={(field) => {
              setPrimaryDraft(catalogPrimary ?? null)
              onEdit(field)
            }}
            editor={
              <div>
                <SearchSelect
                  options={entityContacts}
                  value={primaryDraft}
                  onChange={setPrimaryDraft}
                  getKey={(item) => item.id}
                  getLabel={(item) => item.name}
                  placeholder="Search contact…"
                  clearable={false}
                  renderOption={(item) => (
                    <div>
                      <p className="text-xs font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-ink-faint">{item.designation || item.email}</p>
                    </div>
                  )}
                />
                <SaveCancel onSave={savePrimary} onCancel={onCancel} disabled={!primaryDraft} />
              </div>
            }
          >
            <PersonContactCard
              name={primary.name}
              email={catalogPrimary?.email || primary.email}
              phone={catalogPrimary?.mobile || primary.phones[0]}
              company={lead.companyName}
              designation={catalogPrimary?.designation}
              primary
            />
          </Cell>
          <Cell
            label="Secondary Contact"
            field="secondary"
            editing={editing}
            onEdit={(field) => {
              setSecondaryDraft(secondaryLeadContacts(lead))
              setAddSecondary(null)
              setReplacingName(null)
              onEdit(field)
            }}
            editor={
              <div className="space-y-3">
                <p className="text-xs text-ink-muted">
                  Pick a person to change or remove. Use <span className="font-semibold text-ink">Change</span> to
                  replace them with another contact from this company.
                </p>
                {secondaryDraft.length ? (
                  <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {secondaryDraft.map((item, index) => {
                      const catalog = entityPool.find((row) => row.name === item.name)
                      const replacing = replacingName === item.name
                      return (
                        <li key={`${item.name}-${item.email}-${index}`} className="bg-surface px-3 py-2.5">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span
                              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[10px] font-bold text-surface"
                              aria-hidden="true"
                            >
                              {item.name
                                .split(' ')
                                .slice(0, 2)
                                .map((part) => part[0] ?? '')
                                .join('')
                                .toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-ink">
                                {index + 1}. {item.name}
                              </p>
                              {catalog?.designation ? (
                                <p className="truncate text-[11px] font-semibold text-primary">{catalog.designation}</p>
                              ) : null}
                              <p className="truncate text-[11px] text-ink-faint">{item.email || catalog?.email || 'No email'}</p>
                              {replacing ? (
                                <div className="mt-2">
                                  <p className="mb-1 text-[11px] font-semibold text-ink">
                                    Replace {item.name} with
                                  </p>
                                  <SearchSelect
                                    options={secondaryPool}
                                    value={null}
                                    onChange={(next) => {
                                      if (!next) return
                                      setSecondaryDraft((prev) =>
                                        prev.map((row) => (row.name === item.name ? entryFromContact(next, false) : row)),
                                      )
                                      setReplacingName(null)
                                    }}
                                    getKey={(row) => row.id}
                                    getLabel={(row) => row.name}
                                    placeholder="Search replacement…"
                                    clearable={false}
                                    renderOption={(row) => (
                                      <div>
                                        <p className="text-xs font-semibold text-ink">{row.name}</p>
                                        <p className="text-xs text-ink-faint">{row.designation || row.email}</p>
                                      </div>
                                    )}
                                  />
                                </div>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <Button
                                variant="secondary"
                                className="!min-h-7 !px-2 !py-1 text-[11px]"
                                aria-expanded={replacing}
                                onClick={() => setReplacingName(replacing ? null : item.name)}
                              >
                                {replacing ? 'Close' : 'Change'}
                              </Button>
                              <Button
                                variant="secondary"
                                className="!min-h-7 !px-2 !py-1 text-[11px] text-accent"
                                aria-label={`Remove ${item.name}`}
                                onClick={() => {
                                  setSecondaryDraft((prev) => prev.filter((row) => row.name !== item.name))
                                  if (replacingName === item.name) setReplacingName(null)
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-ink-faint">
                    No secondary contacts on this lead yet.
                  </p>
                )}
                <div>
                  <p className="mb-1 text-[11px] font-semibold text-ink">Add another contact</p>
                  <SearchSelect
                    options={secondaryPool}
                    value={addSecondary}
                    onChange={(item) => {
                      if (!item) return
                      setSecondaryDraft((prev) => [...prev, entryFromContact(item, false)])
                      setAddSecondary(null)
                    }}
                    getKey={(item) => item.id}
                    getLabel={(item) => item.name}
                    placeholder="Search and add a contact…"
                    clearable={false}
                    renderOption={(item) => (
                      <div>
                        <p className="text-xs font-semibold text-ink">{item.name}</p>
                        <p className="text-xs text-ink-faint">{item.designation || item.email}</p>
                      </div>
                    )}
                  />
                </div>
                <SaveCancel onSave={saveSecondary} onCancel={onCancel} />
              </div>
            }
          >
            <SecondaryContactsMore
              items={secondaryLeadContacts(lead).map((item) => ({
                name: item.name,
                email: item.email,
                phone: item.phones[0],
                company: lead.companyName,
              }))}
            />
          </Cell>
        </DetailBand>

        <DetailBand title="Commercial">
          <Cell
            label="Product Type"
            field="products"
            wide
            editing={editing}
            onEdit={(field) => {
              setProductDraft(productsFromLeadNames(leadProductList(lead)))
              onEdit(field)
            }}
            editor={
              <div>
                <TableSearchSelect
                  options={PRODUCTS.filter((item) => !productDraft.some((row) => row.id === item.id))}
                  value={null}
                  onChange={(item) => {
                    if (item) setProductDraft((prev) => [...prev, item])
                  }}
                  getKey={(item) => String(item.id)}
                  getLabel={productLine}
                  filterItem={matchesProduct}
                  placeholder="Select product…"
                  searchPlaceholder="Advance Search"
                  emptyText="No matching products"
                  clearable={false}
                  columns={[
                    { header: 'Code - Item Name', getValue: productLine, truncate: true },
                    { header: 'Unit', getValue: productUnit, width: '3.5rem' },
                  ]}
                />
                {productDraft.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {productDraft.map((item) => (
                      <Tag
                        key={item.id}
                        label={productLine(item)}
                        onRemove={() => setProductDraft((prev) => prev.filter((row) => row.id !== item.id))}
                        removeLabel={`Remove ${item.itemName}`}
                      />
                    ))}
                  </div>
                ) : null}
                <SaveCancel onSave={saveProducts} onCancel={onCancel} />
              </div>
            }
          >
            {leadProductList(lead).length ? (
              <div className="flex flex-wrap gap-1.5">
                {leadProductList(lead).map((name, index) => (
                  <ProductChip key={`${name}-${index}`} label={name} />
                ))}
              </div>
            ) : (
              '—'
            )}
          </Cell>
          <Cell
            label="Lead Priority"
            field="priority"
            editing={editing}
            onEdit={(field) => {
              setPriorityDraft(leadPriorityOf(lead))
              onEdit(field)
            }}
            editor={
              <div>
                <Select options={LEAD_PRIORITIES} value={priorityDraft} onValueChange={(value) => setPriorityDraft(value as LeadPriority)} />
                <SaveCancel onSave={savePriority} onCancel={onCancel} />
              </div>
            }
          >
            {leadPriorityOf(lead)}
          </Cell>
          <Cell
            label="Lead Owner"
            field="owner"
            editing={editing}
            onEdit={(field) => {
              setOwnerDraft(lead.assignedSalesperson)
              onEdit(field)
            }}
            editor={
              <div>
                <Select options={SALESPERSONS} value={ownerDraft} onValueChange={setOwnerDraft} placeholder="Select owner" />
                <SaveCancel onSave={saveOwner} onCancel={onCancel} disabled={!ownerDraft} />
              </div>
            }
          >
            {lead.assignedSalesperson || '—'}
          </Cell>
          <Cell
            label="Estimated Lead Value"
            field="value"
            full
            editing={editing}
            onEdit={(field) => {
              setCurrencyDraft(lead.valueCurrency ?? 'INR')
              setValueDraft(String(lead.opportunityValue || ''))
              onEdit(field)
            }}
            editor={
              <div>
                <div className="flex gap-2">
                  <div className="w-[7.5rem] shrink-0">
                    <SearchSelect
                      options={MAIN_CURRENCIES}
                      value={findCurrency(currencyDraft)}
                      onChange={(item) => {
                        if (item) setCurrencyDraft(item.code)
                      }}
                      getKey={(item) => item.code}
                      getLabel={(item) => item.code}
                      filterItem={matchesCurrency}
                      placeholder="Currency"
                      clearable={false}
                      preserveOrder
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <TextInput
                      aria-label="Estimated value amount"
                      type="number"
                      min={0}
                      leading={currencyAmountPrefix(currencyDraft)}
                      value={valueDraft}
                      onValueChange={setValueDraft}
                    />
                  </div>
                </div>
                <SaveCancel onSave={saveValue} onCancel={onCancel} disabled={!Number.isFinite(Number(valueDraft)) || Number(valueDraft) < 0} />
              </div>
            }
          >
            <span className="font-display font-bold text-accent">{formatLeadValue(lead)}</span>
          </Cell>
        </DetailBand>

        <DetailBand title="Source & timeline">
          <Cell
            label="Lead Source"
            field="source"
            wide
            editing={editing}
            onEdit={(field) => {
              setSourceDraft(lead.leadSource)
              onEdit(field)
            }}
            editor={
              <div>
                <Select options={sources} value={sourceDraft} onValueChange={(value) => setSourceDraft(value as LeadSource)} />
                <SaveCancel onSave={saveSource} onCancel={onCancel} />
              </div>
            }
          >
            {lead.leadSource || '—'}
          </Cell>
          <Cell
            label="Expected Closure"
            field="closure"
            wide
            editing={editing}
            onEdit={(field) => {
              setClosureDraft(lead.expectedClosureDate ?? '')
              onEdit(field)
            }}
            editor={
              <div>
                <TextInput type="date" value={closureDraft} onValueChange={setClosureDraft} aria-label="Expected closure date" />
                <SaveCancel onSave={saveClosure} onCancel={onCancel} />
              </div>
            }
          >
            {lead.expectedClosureDate ? formatLeadDate(lead.expectedClosureDate) : '—'}
          </Cell>
        </DetailBand>
      </div>
    </div>
  )
}

export type { FieldKey }
