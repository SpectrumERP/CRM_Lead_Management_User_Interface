import { useState, type ReactNode } from 'react'
import { SALESPERSONS } from '../data/activities'
import { LEAD_CURRENCIES, type LeadCurrency } from '../data/leads'
import { currencyAmountPrefix } from '../data/currencies'
import {
  DEAL_STAGES,
  OPPORTUNITY_STATUSES,
  dealWeight,
  formatOpportunityStage,
  weightedDealValue,
  type DealStage,
  type Opportunity,
  type OpportunityStatus,
} from '../data/opportunities'
import { useAuth } from '../auth/AuthContext'
import { useCrmActions } from '../contexts/CrmStoreContext'
import { Button, Card, FormGrid, SelectField, TextField, TextInput } from '../ui'

interface CreateOpportunityProps {
  onBack: () => void
  onSuccess: (id: string) => void
  /** When true, hide page chrome (used inside Quick Create overlay). */
  embedded?: boolean
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-surface"
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <SectionIcon>{icon}</SectionIcon>
          <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  )
}

const SECTION_ICONS = {
  system: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  deal: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  ),
  contact: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
} as const

export default function CreateOpportunity({ onBack, onSuccess, embedded }: CreateOpportunityProps) {
  const { user } = useAuth()
  const { addOpportunity } = useCrmActions()
  const createdBy = user?.name ?? 'System'
  const today = new Date().toISOString().slice(0, 10)

  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [productsRequired, setProductsRequired] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [valueCurrency, setValueCurrency] = useState<LeadCurrency>('INR')
  const [dealStage, setDealStage] = useState<DealStage>('Qualification')
  const [status, setStatus] = useState<OpportunityStatus>('Open')
  const [closingDate, setClosingDate] = useState('')
  const [owner, setOwner] = useState(createdBy)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  function validate() {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Opportunity name is required'
    if (!companyName.trim()) next.companyName = 'Business entity is required'
    if (!contactPerson.trim()) next.contactPerson = 'Contact person is required'
    if (!email.trim()) next.email = 'Email is required'
    const value = Number(dealValue)
    if (!Number.isFinite(value) || value < 0) next.dealValue = 'Enter a valid opportunity value'
    if (!closingDate) next.closingDate = 'Expected closure date is required'
    if (!owner.trim()) next.owner = 'Opportunity owner is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSave() {
    if (saving || !validate()) return
    setSaving(true)
    const id = `OPP-${Date.now().toString(36).toUpperCase()}`
    const value = Number(dealValue)
    const payload: Opportunity = {
      id,
      // Direct create — no lead conversion
      leadId: undefined,
      name: name.trim(),
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      productsRequired: productsRequired.trim(),
      dealValue: value,
      valueCurrency,
      dealStage,
      status,
      weightPercent: dealWeight(dealStage),
      weightedValue: weightedDealValue(value, dealStage),
      closingDate,
      owner: owner.trim(),
      leadSource: 'Inbound',
      lastActivity: 'Just now',
      createdAt: today,
      createdBy,
    }
    addOpportunity(payload)
    setSubmittedId(id)
    setTimeout(() => onSuccess(id), embedded ? 700 : 1200)
  }

  if (submittedId) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center bg-canvas">
        <Card className="max-w-sm px-10 py-12 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="ui-title mb-1 text-lg">Opportunity Created!</h2>
          <p className="ui-subtitle mb-2 text-sm">{companyName.trim()}</p>
          <p className="mb-6 font-mono text-xs font-semibold text-primary">{submittedId}</p>
          <p className="text-xs text-ink-faint">Redirecting…</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className={`page-gutter py-4 pb-4 ${embedded ? 'pt-2' : ''}`}>
        {!embedded ? (
          <div className="mb-5">
            <button
              type="button"
              onClick={onBack}
              className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Opportunities
            </button>
            <h1 className="ui-title text-xl">Create Opportunity</h1>
            <p className="ui-subtitle mt-0.5 text-xs">
              Direct create — Reference Lead No will remain empty
            </p>
          </div>
        ) : null}

        <div className="space-y-5">
          <Section title="System fields" icon={SECTION_ICONS.system}>
            <FormGrid>
              <TextField label="Opportunity No" value="Auto-generated on save" disabled />
              <TextField label="Reference Lead No" value="—" disabled />
              <TextField label="Creation Date" value={today} disabled />
              <TextField label="Created By" value={createdBy} disabled />
            </FormGrid>
          </Section>

          <Section title="Opportunity Info" icon={SECTION_ICONS.info}>
            <FormGrid>
              <TextField
                fieldClassName="lg:col-span-2"
                label="Opportunity Name"
                required
                error={errors.name}
                value={name}
                onValueChange={setName}
                placeholder="Deal / opportunity name"
              />
              <TextField
                label="Business Entity"
                required
                error={errors.companyName}
                value={companyName}
                onValueChange={setCompanyName}
                placeholder="Company / organisation name"
              />
              <TextField
                fieldClassName="lg:col-span-2"
                label="Products Required"
                value={productsRequired}
                onValueChange={setProductsRequired}
                placeholder="Products or solutions in this deal"
              />
            </FormGrid>
          </Section>

          <Section title="Opportunity Details" icon={SECTION_ICONS.deal}>
            <FormGrid>
              <SelectField
                label="Opportunity Stage"
                required
                value={dealStage}
                onValueChange={(value) => setDealStage(value as DealStage)}
                options={DEAL_STAGES.map((stage) => ({
                  value: stage,
                  label: formatOpportunityStage(stage, dealWeight(stage)),
                }))}
              />
              <SelectField
                label="Opportunity Status"
                required
                value={status}
                onValueChange={(value) => setStatus(value as OpportunityStatus)}
                options={OPPORTUNITY_STATUSES}
              />
              <SelectField
                label="Opportunity Owner"
                required
                error={errors.owner}
                options={SALESPERSONS}
                placeholder="Select owner"
                value={owner}
                onValueChange={setOwner}
              />
              <div role="group" aria-label="Opportunity Value">
                <p className="form-label">
                  Opportunity Value <span className="form-required">*</span>
                </p>
                <div className={`form-input-combo${errors.dealValue ? ' error' : ''}`}>
                  <select
                    className="form-input-combo-currency"
                    aria-label="Currency"
                    value={valueCurrency}
                    onChange={(event) => setValueCurrency(event.target.value as LeadCurrency)}
                  >
                    {LEAD_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <span className="form-input-combo-divider" aria-hidden />
                  <div className="form-input-combo-amount">
                    <TextInput
                      aria-label="Opportunity value amount"
                      type="number"
                      min={0}
                      leading={currencyAmountPrefix(valueCurrency)}
                      value={dealValue}
                      onValueChange={setDealValue}
                      placeholder="0"
                    />
                  </div>
                </div>
                {errors.dealValue ? (
                  <p className="mt-1 text-xs text-accent" role="alert">
                    {errors.dealValue}
                  </p>
                ) : null}
              </div>
              <TextField
                label="Expected Closure Date"
                type="date"
                required
                error={errors.closingDate}
                value={closingDate}
                onValueChange={setClosingDate}
              />
            </FormGrid>
          </Section>

          <Section title="Primary Contact" icon={SECTION_ICONS.contact}>
            <FormGrid>
              <TextField
                label="Contact Person"
                required
                error={errors.contactPerson}
                value={contactPerson}
                onValueChange={setContactPerson}
              />
              <TextField
                label="Email"
                type="email"
                required
                error={errors.email}
                value={email}
                onValueChange={setEmail}
              />
              <TextField label="Phone" value={phone} onValueChange={setPhone} />
            </FormGrid>
          </Section>

          {Object.keys(errors).length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3" role="alert">
              <p className="text-xs font-bold text-accent">Please fix the following before saving:</p>
              <ul className="space-y-0.5">
                {Object.values(errors).map((item) => (
                  <li key={item} className="text-xs text-accent">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button variant="secondary" onClick={onBack} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create Opportunity'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
