import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Select, TextInput } from '../ui'
import { PersonContactCard } from './PersonContactCard'
import { SecondaryContactsMore } from './SecondaryContactsMore'
import { useCrmActions } from '../contexts/CrmStoreContext'
import { saveConfirm, useConfirm } from '../contexts/ConfirmContext'
import type { ToastType } from './Toast'
import { formatLeadDate } from '../data/leads'
import {
  dealStageClass,
  formatDealValue,
  formatOpportunityStage,
  opportunityStatusClass,
  type DealStage,
  type Opportunity,
} from '../data/opportunities'
import { UserSelect } from './UserSelect'
import { useOpportunityFillValues } from './useOpportunityFillValues'
import { stageBadgeStyle, useOpportunityStageColors } from './useOpportunityStageColors'
import { bySequence, guessIsoCurrency } from '../api/fillValues'
import { opportunityStageLabel } from '../api/opportunityFormFillValues'
import { FIELD_LIMITS } from '../constants/fieldLimits'
import { formatDate } from '../utils/dateFormat'

export type OppFieldKey =
  | 'name'
  | 'contact'
  | 'email'
  | 'phone'
  | 'products'
  | 'stage'
  | 'status'
  | 'value'
  | 'owner'
  | 'closure'

function EditCue() {
  return (
    <span
      className="inline-flex shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100"
      aria-hidden="true"
    >
      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    </span>
  )
}

function SaveCancel({
  onSave,
  onCancel,
  disabled,
}: {
  onSave: () => void
  onCancel: () => void
  disabled?: boolean
}) {
  const confirm = useConfirm()
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <Button variant="solid" className="!min-h-6 !px-2 !py-0.5 text-[11px]" onClick={async () => { if (await confirm(saveConfirm('Opportunity', true))) onSave() }} disabled={disabled}>
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
  field?: OppFieldKey
  editing: OppFieldKey | null
  locked?: boolean
  wide?: boolean
  full?: boolean
  onEdit?: (field: OppFieldKey) => void
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
        active || full ? 'col-span-full' : wide ? 'sm:col-span-2' : ''
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
        <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-faint">{label}</p>
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
        <h3 className="text-[10px] font-bold tracking-[0.1em] text-ink-muted">{title}</h3>
      </div>
      <div className="grid grid-cols-1 bg-surface sm:grid-cols-2 xl:grid-cols-4 sm:[&>*:nth-child(2n)]:border-r-0 xl:[&>*:nth-child(2n)]:border-r xl:[&>*:nth-child(4n)]:border-r-0">
        {children}
      </div>
    </section>
  )
}

export function OpportunityIdentityEdit({
  opportunity,
  editing,
  onEdit,
  onCancel,
  onToast,
}: {
  opportunity: Opportunity
  editing: OppFieldKey | null
  onEdit: (field: OppFieldKey) => void
  onCancel: () => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}) {
  const { patchOpportunity } = useCrmActions()
  const [nameDraft, setNameDraft] = useState(opportunity.name)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [descriptionOverflows, setDescriptionOverflows] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement | null>(null)
  const description = opportunity.description?.trim() ?? ''

  useEffect(() => {
    if (descriptionExpanded || !description) return
    const element = descriptionRef.current
    if (!element) return
    const measure = () => setDescriptionOverflows(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [description, descriptionExpanded])

  function saveName() {
    const next = nameDraft.trim()
    if (!next) return
    patchOpportunity(opportunity.id, { name: next })
    onCancel()
    onToast?.('success', 'Opportunity Updated', 'Opportunity name saved.')
  }

  if (editing === 'name') {
    return (
      <div className="min-w-0">
        <TextInput
          aria-label="Opportunity name"
          maxLength={FIELD_LIMITS.opportunityName}
          value={nameDraft}
          onValueChange={setNameDraft}
          autoFocus
        />
        <SaveCancel onSave={saveName} onCancel={onCancel} disabled={!nameDraft.trim()} />
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        className="group flex min-w-0 max-w-full items-start gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => onEdit('name')}
        aria-label={`Edit opportunity name: ${opportunity.name}`}
      >
        <h1 className="min-w-0 font-display text-xl font-bold text-ink">{opportunity.name}</h1>
        <EditCue />
      </button>
      {description ? (
        <div className="mt-1 min-w-0">
          <p ref={descriptionRef} className={`font-display text-sm font-semibold text-ink-soft ${descriptionExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{description}</p>
          {descriptionOverflows ? (
            <button type="button" className="mt-0.5 text-xs font-semibold text-primary hover:underline" onClick={() => setDescriptionExpanded((value) => !value)}>
              {descriptionExpanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function OpportunitySummaryEdit({
  opportunity,
  editing,
  onEdit,
  onCancel,
  onViewLead,
  onToast,
}: {
  opportunity: Opportunity
  editing: OppFieldKey | null
  onEdit: (field: OppFieldKey) => void
  onCancel: () => void
  onViewLead?: (id: string) => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}) {
  const { patchOpportunity } = useCrmActions()
  // Server opportunity → stage / status choices from the server lists.
  const { values: oppFill } = useOpportunityFillValues()
  // Server lists only (stages, statuses, currencies).
  const stageOptions = bySequence(oppFill?.opportunityStages ?? []).map((stage) => ({ value: stage.opportunityStageName, label: opportunityStageLabel(stage) }))
  const serverCurrencies = oppFill?.currencies ?? []
  // Server stage colour (fill values `colorCoding`) for the stage badge.
  const stageColor = useOpportunityStageColors()
  const stageHex = opportunity.spectrum ? stageColor(opportunity.dealStage) : undefined
  // Primary + secondary contacts (primary first); older records only carry the single contact fields.
  const contactList = opportunity.contacts?.length
    ? opportunity.contacts
    : opportunity.contactPerson
      ? [{ name: opportunity.contactPerson, email: opportunity.email, phones: opportunity.phone ? [opportunity.phone] : [], primary: true }]
      : []
  const primaryContact = contactList.find((c) => c.primary) ?? contactList[0]
  const secondaryContacts = contactList.filter((c) => c !== primaryContact)
  const [emailDraft, setEmailDraft] = useState(opportunity.email)
  const [phoneDraft, setPhoneDraft] = useState(opportunity.phone)
  const [productsDraft, setProductsDraft] = useState(opportunity.productsRequired)
  const [stageDraft, setStageDraft] = useState<DealStage>(opportunity.dealStage)
  const [currencyNoDraft, setCurrencyNoDraft] = useState<number | undefined>(opportunity.spectrum?.currencyNo)
  const currencyDraft = serverCurrencies.find((c) => c.currencyNo === currencyNoDraft)
  const [valueDraft, setValueDraft] = useState(String(opportunity.dealValue || ''))
  const [ownerDraft, setOwnerDraft] = useState(opportunity.owner)
  const [closureDraft, setClosureDraft] = useState(opportunity.closingDate)

  useEffect(() => {
    if (editing === 'stage') setStageDraft(opportunity.dealStage)
    if (editing === 'owner') setOwnerDraft(opportunity.owner)
    if (editing === 'value') {
      setCurrencyNoDraft(opportunity.spectrum?.currencyNo)
      setValueDraft(String(opportunity.dealValue || ''))
    }
    if (editing === 'email') setEmailDraft(opportunity.email)
    if (editing === 'phone') setPhoneDraft(opportunity.phone)
    if (editing === 'products') setProductsDraft(opportunity.productsRequired)
    if (editing === 'closure') setClosureDraft(opportunity.closingDate)
  }, [editing, opportunity])

  function toastSaved(message: string) {
    onCancel()
    onToast?.('success', 'Opportunity Updated', message)
  }

  return (
    <div className="overflow-hidden border-t border-line">
      <DetailBand title="Company & contacts">
        <Cell label="Opportunity No" locked editing={editing}>
          <span className="font-mono text-ink-soft">{opportunity.id}</span>
        </Cell>
        {/* <Cell label="Reference Lead No" locked editing={editing}>
          {opportunity.leadId ? (
            onViewLead ? (
              <button
                type="button"
                className="font-mono font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => onViewLead(opportunity.leadId!)}
              >
                {opportunity.leadId}
              </button>
            ) : (
              <span className="font-mono">{opportunity.leadId}</span>
            )
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </Cell> */}
        <Cell label="Business Entity" locked editing={editing}>
          {opportunity.companyName}
        </Cell>
        {/* Contacts are read-only here — they are picked per business entity in Edit Opportunity. */}
        <Cell label="Primary Contact" locked editing={editing}>
          {primaryContact?.name ? (
            <PersonContactCard
              name={primaryContact.name}
              email={primaryContact.email}
              phone={primaryContact.phones[0] ?? ''}
              company={opportunity.companyName}
              designation={primaryContact.designation}
              primary
            />
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </Cell>
        <Cell label="Secondary Contacts" locked editing={editing}>
          {secondaryContacts.length ? (
            <SecondaryContactsMore
              items={secondaryContacts.map((item) => ({
                name: item.name,
                email: item.email,
                phone: item.phones[0],
                company: opportunity.companyName,
                designation: item.designation,
              }))}
            />
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </Cell>

      </DetailBand>

      <DetailBand title="Commercial">
        <Cell
          label="Products Required"
          field="products"
          wide
          editing={editing}
          onEdit={(field) => {
            setProductsDraft(opportunity.productsRequired)
            onEdit(field)
          }}
          editor={
            <div>
              <TextInput value={productsDraft} onValueChange={setProductsDraft} autoFocus />
              <SaveCancel
                onSave={() => {
                  patchOpportunity(opportunity.id, { productsRequired: productsDraft.trim() })
                  toastSaved('Products saved.')
                }}
                onCancel={onCancel}
              />
            </div>
          }
        >
          {opportunity.productsRequired || '—'}
        </Cell>
        <Cell
          label="Opportunity Stage"
          field="stage"
          editing={editing}
          onEdit={(field) => {
            setStageDraft(opportunity.dealStage)
            onEdit(field)
          }}
          editor={
            <div>
              <Select
                options={stageOptions}
                value={stageDraft}
                onValueChange={(value) => setStageDraft(value as DealStage)}
                preserveOrder
              />
              <SaveCancel
                onSave={() => {
                  patchOpportunity(opportunity.id, { dealStage: stageDraft })
                  toastSaved('Stage saved.')
                }}
                onCancel={onCancel}
              />
            </div>
          }
        >
          <span
            className={`badge ${stageHex ? 'border' : dealStageClass(opportunity.dealStage)}`}
            style={stageBadgeStyle(stageHex)}
          >
            {formatOpportunityStage(opportunity.dealStage, opportunity.weightPercent)}
          </span>
        </Cell>
        <Cell label="Opportunity Status" locked editing={editing}>
          <span className={`badge ${opportunityStatusClass(opportunity.status)}`}>{opportunity.status}</span>
        </Cell>
        <Cell
          label="Opportunity Value"
          field="value"
          full
          editing={editing}
          onEdit={(field) => {
            setCurrencyNoDraft(opportunity.spectrum?.currencyNo)
            setValueDraft(String(opportunity.dealValue || ''))
            onEdit(field)
          }}
          editor={
            <div>
              <div className={`form-input-combo`}>
                <select
                  className="form-input-combo-currency"
                  aria-label="Currency"
                  value={String(currencyNoDraft ?? '')}
                  onChange={(event) => setCurrencyNoDraft(Number(event.target.value) || undefined)}
                >
                  {serverCurrencies.map((c) => (
                    <option key={c.currencyNo} value={c.currencyNo}>
                      {c.currencyName}
                    </option>
                  ))}
                </select>
                <span className="form-input-combo-divider" aria-hidden />
                <div className="form-input-combo-amount">
                  <TextInput
                    aria-label="Opportunity value amount"
                    type="number"
                    min={0}
                    leading={currencyDraft?.symbol || ''}
                    value={valueDraft}
                    onValueChange={setValueDraft}
                    autoFocus
                  />
                </div>
              </div>
              <SaveCancel
                onSave={() => {
                  const amount = Number(valueDraft)
                  if (!Number.isFinite(amount) || amount < 0) return
                  patchOpportunity(opportunity.id, {
                    dealValue: amount,
                    ...(currencyDraft
                      ? { valueCurrency: guessIsoCurrency({ currencyName: currencyDraft.currencyName, symbol: currencyDraft.symbol ?? '' }) }
                      : {}),
                    // The picked server currency is sent as its number.
                    ...(opportunity.spectrum ? { spectrum: { ...opportunity.spectrum, currencyNo: currencyNoDraft } } : {}),
                  })
                  toastSaved('Opportunity value saved.')
                }}
                onCancel={onCancel}
                disabled={!Number.isFinite(Number(valueDraft)) || Number(valueDraft) < 0}
              />
            </div>
          }
        >
          <span className="font-display font-bold text-accent">
            {formatDealValue(opportunity.dealValue, opportunity.valueCurrency)}
          </span>
        </Cell>
      </DetailBand>

      <DetailBand title="Ownership & timeline">
        <Cell
          label="Opportunity Owner"
          field="owner"
          editing={editing}
          onEdit={(field) => {
            setOwnerDraft(opportunity.owner)
            onEdit(field)
          }}
          editor={
            <div>
              <UserSelect
                value={ownerDraft}
                onValueChange={setOwnerDraft}
                placeholder="Select owner"
                aria-label="Opportunity owner"
              />
              <SaveCancel
                onSave={() => {
                  if (!ownerDraft.trim()) return
                  patchOpportunity(opportunity.id, { owner: ownerDraft })
                  toastSaved('Owner saved.')
                }}
                onCancel={onCancel}
                disabled={!ownerDraft.trim()}
              />
            </div>
          }
        >
          <PersonContactCard name={opportunity.owner} company={opportunity.companyName} />
        </Cell>
        <Cell
          label="Expected Closure Date"
          field="closure"
          editing={editing}
          onEdit={(field) => {
            setClosureDraft(opportunity.closingDate)
            onEdit(field)
          }}
          editor={
            <div>
              <TextInput type="date" value={closureDraft} onValueChange={setClosureDraft} autoFocus />
              <SaveCancel
                onSave={() => {
                  if (!closureDraft) return
                  patchOpportunity(opportunity.id, { closingDate: closureDraft })
                  toastSaved('Closure date saved.')
                }}
                onCancel={onCancel}
                disabled={!closureDraft}
              />
            </div>
          }
        >
          {formatLeadDate(opportunity.closingDate)}
        </Cell>
        <Cell label="Creation Date" locked editing={editing}>
          {formatLeadDate(opportunity.createdAt)}
        </Cell>
        <Cell label="Created By" locked editing={editing}>
          {opportunity.createdBy ? (
            <PersonContactCard name={opportunity.createdBy} company={opportunity.companyName} />
          ) : (
            '—'
          )}
        </Cell>
        <Cell label="Lead Source" locked editing={editing}>
          {String(opportunity.leadSource || '—')}
        </Cell>
        <Cell label="Weighted Value" locked editing={editing}>
          <span className="font-bold text-ink">
            {formatDealValue(opportunity.weightedValue, opportunity.valueCurrency)}
          </span>
          <span className="ml-1 text-xs font-medium text-ink-faint">({opportunity.weightPercent}%)</span>
        </Cell>
        <Cell label="Last Activity" locked editing={editing}>
          {formatDate(opportunity.lastActivityAt || opportunity.lastActivity)}
        </Cell>
        {opportunity.convertedAt || opportunity.convertedBy ? (
          <>
            <Cell label="Converted At" locked editing={editing}>
              {opportunity.convertedAt ? formatLeadDate(opportunity.convertedAt.slice(0, 10)) : '—'}
            </Cell>
            <Cell label="Converted By" locked editing={editing}>
              {opportunity.convertedBy ? (
                <PersonContactCard name={opportunity.convertedBy} company={opportunity.companyName} />
              ) : (
                '—'
              )}
            </Cell>
          </>
        ) : null}
      </DetailBand>
    </div>
  )
}
