import { useEffect, useState, type ReactNode } from 'react'
import type { Lead } from '../data/leads'
import type { DealStage, OpportunityStatus } from '../data/opportunities'
import { useAuth } from '../auth/AuthContext'
import { sameList, useCrmSelector } from '../contexts/CrmStoreContext'
import { saveConfirm, useConfirm } from '../contexts/ConfirmContext'
import { spectrumEntityId } from '../components/useBusinessEntityOptions'
import EntityContactsFields, {
  EMPTY_ENTITY_CONTACTS,
  contactDetailNos,
  fromContactEntries,
  type EntityContactsValue,
} from '../components/EntityContactsFields'
import { useOpportunityFillValues } from '../components/useOpportunityFillValues'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'
import { bySequence, guessIsoCurrency } from '../api/fillValues'
import { stageWeight } from '../api/opportunityFormFillValues'
import { OptionLookupField } from '../components/OptionLookupField'
import CurrencyAmountField from '../components/CurrencyAmountField'
import { buildOpportunitySaveBody, saveOpportunity } from '../api/opportunities'
import { refreshServerOpportunity } from '../api/opportunitySync'
import { loginNoForName, syncServerLeads } from '../api/leadSync'
import { toApiError } from '../api/errors'
import { Button, Card, FormGrid, TableSearchSelectField, TextField, type TableSearchColumn } from '../ui'
import { UserSelectField } from '../components/UserSelect'
import ProductPicker, { useProductCatalog } from '../components/ProductPicker'
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice'
import type { Product } from '../data/products'
import { FIELD_LIMITS } from '../constants/fieldLimits'
import AttachmentsField from '../components/AttachmentsField'
import { ATTACHMENT_FORM_NO, type Attachment } from '../api/attachments'
import { BreadcrumbActions } from '../components/BreadcrumbActions'

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
  documents: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
} as const

const LEAD_COLUMNS: TableSearchColumn<Lead>[] = [
  { header: 'Code', getValue: (l) => l.spectrum?.code || l.id, width: '7rem' },
  { header: 'Lead', getValue: (l) => l.leadName, truncate: true },
  { header: 'Business Entity', getValue: (l) => l.companyName || '', truncate: true },
  { header: 'Owner', getValue: (l) => l.assignedSalesperson || '', width: '10rem', truncate: true },
]

export default function CreateOpportunity({ onBack, onSuccess, embedded }: CreateOpportunityProps) {
  const confirm = useConfirm()
  const { user } = useAuth()
  const createdBy = user?.name ?? 'System'
  const today = new Date().toISOString().slice(0, 10)

  const [name, setName] = useState('')
  // Business entity + one primary and any number of secondary contacts (shared with the lead form).
  const [entityContacts, setEntityContacts] = useState<EntityContactsValue>(EMPTY_ENTITY_CONTACTS)
  const entity = entityContacts.entity
  const companyName = entity?.name ?? ''
  const productCatalog = useProductCatalog()
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [dealValue, setDealValue] = useState('')
  // Set from the server lists once they load (first stage, "Open" status).
  const [dealStage, setDealStage] = useState<DealStage>('' as DealStage)
  const [status, setStatus] = useState<OpportunityStatus>('' as OpportunityStatus)
  const [closingDate, setClosingDate] = useState('')
  const [owner, setOwner] = useState(createdBy)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  // Uploaded to the document store as they are picked; the save links them by docNo.
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadsBusy, setUploadsBusy] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  // ── Spectrum login: save through POST /api/crm/opportunities/save ─────────────
  const { values: oppFill } = useOpportunityFillValues()
  const spectrumCompany = useSpectrumCompany()
  const serverMode = Boolean(oppFill && spectrumCompany.headOfficeNo)
  const serverLeads = useCrmSelector((state) => state.leads.filter((l) => l.spectrum), sameList)
  const [referenceLead, setReferenceLead] = useState<Lead | null>(null)
  const [leadsRequested, setLeadsRequested] = useState(false)
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [salesOrganizationNo, setSalesOrganizationNo] = useState<number>()
  const [ownerLoginNo, setOwnerLoginNo] = useState<number>()
  const [currencyNo, setCurrencyNo] = useState<number>()
  const serverStages = oppFill ? bySequence(oppFill.opportunityStages) : []

  // Server defaults once the lists arrive: first stage, "Open" status, INR-like currency, first sales org.
  useEffect(() => {
    if (!oppFill) return
    const stages = bySequence(oppFill.opportunityStages)
    if (stages.length && !stages.some((st) => st.opportunityStageName === dealStage)) setDealStage(stages[0]!.opportunityStageName as DealStage)
    const statuses = oppFill.opportunityStatuses.map((st) => st.opportunityStatusName)
    if (statuses.length && !statuses.includes(status)) {
      setStatus((statuses.find((st) => /^open$/i.test(st)) ?? statuses[0]!) as OpportunityStatus)
    }
    if (!currencyNo) {
      const pick = oppFill.currencies.find((c) => guessIsoCurrency({ currencyName: c.currencyName, symbol: c.symbol ?? '' }) === 'INR') ?? oppFill.currencies[0]
      if (pick) setCurrencyNo(pick.currencyNo)
    }
    if (!salesOrganizationNo && oppFill.salesOrganizations[0]) setSalesOrganizationNo(oppFill.salesOrganizations[0].salesOrganizationNo)
    // Only when the lists first arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppFill])

  /** Server leads are loaded the first time the Reference Lead field opens. */
  function onLeadFieldOpen(open: boolean) {
    if (!open || leadsRequested) return
    setLeadsRequested(true)
    setLeadsLoading(true)
    syncServerLeads().catch(() => undefined).finally(() => setLeadsLoading(false))
  }

  function pickReferenceLead(next: Lead | null) {
    setReferenceLead(next)
    setErrors(({ lead: _cleared, ...rest }) => rest)
    if (!next?.spectrum) return
    const no = next.spectrum.businessEntityNo
    if (no) {
      // The lead's entity, and its contacts when the lead detail has been loaded.
      setEntityContacts({
        entity: { id: spectrumEntityId(no), name: next.companyName, type: '', city: '', source: 'spectrum', businessEntityNo: no },
        ...fromContactEntries(next.contacts),
      })
    }
    if (!name.trim()) setName(next.leadName)
    if (next.spectrum.salesOrganizationNo) setSalesOrganizationNo(next.spectrum.salesOrganizationNo)
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Opportunity name is required'
    if (!companyName.trim()) next.companyName = 'Business entity is required'
    if (!entityContacts.primary?.name.trim()) next.contactPerson = 'Select the primary contact person'
    const value = Number(dealValue)
    if (!Number.isFinite(value) || value < 0) next.dealValue = 'Enter a valid opportunity value'
    if (!closingDate) next.closingDate = 'Expected closure date is required'
    if (!owner.trim()) next.owner = 'Opportunity owner is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleServerSave() {
    if (!oppFill || !spectrumCompany.headOfficeNo) return
    const resolvedOwner = ownerLoginNo ?? (owner.trim() ? await loginNoForName(owner.trim()).catch(() => undefined) : undefined)
    const built = buildOpportunitySaveBody({
      companyNo: spectrumCompany.headOfficeNo,
      leadNo: referenceLead?.spectrum?.leadNo,
      name,
      ownerLoginNo: resolvedOwner,
      salesOrganizationNo,
      stageName: dealStage,
      statusName: status,
      businessEntityNo: entity?.businessEntityNo,
      currencyNo,
      closingDate,
      value: Number(dealValue) || 0,
      contactPersonDetailNos: contactDetailNos(entityContacts),
      productNos: selectedProducts.map((item) => item.id),
      attachmentNos: attachments.map((a) => a.id),
    }, oppFill)
    if (built.errors) {
      setErrors(built.errors)
      setSaving(false)
      return
    }
    try {
      const opportunityNo = await saveOpportunity(built.body)
      const created = await refreshServerOpportunity(opportunityNo)
      setSubmittedId(created.id)
      setTimeout(() => onSuccess(created.id), embedded ? 700 : 1200)
    } catch (error) {
      setErrors({ form: `Could not save the opportunity: ${toApiError(error).message}` })
      setSaving(false)
    }
  }

  async function handleSave() {
    if (saving || !validate()) return
    if (uploadsBusy) {
      setErrors({ form: 'Please wait for all attachments to finish uploading before saving the opportunity.' })
      return
    }
    if (!(await confirm(saveConfirm('Opportunity')))) return
    setSaving(true)
    // Opportunities are saved on the server only (no in-app copies).
    if (!serverMode) {
      setErrors({ form: 'Sign in with your Spectrum account to create opportunities.' })
      setSaving(false)
      return
    }
    void handleServerSave()
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
    <div className="bg-canvas form-labels-as-written">
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
          <SpectrumRequiredNotice what="Opportunities and their lists" />

          <Section title="Opportunity Info" icon={SECTION_ICONS.info}>
            <FormGrid>
              <TextField
                fieldClassName="lg:col-span-2"
                label="Opportunity Name"
                maxLength={FIELD_LIMITS.opportunityName}
                required
                error={errors.name}
                value={name}
                onValueChange={setName}
                placeholder="Enter opportunity name"
              />
              {/* {serverMode ? (
                <TableSearchSelectField
                  label="Reference Lead"
                  required
                  error={errors.lead}
                  placeholder="Search lead…"
                  options={serverLeads}
                  value={referenceLead}
                  onChange={pickReferenceLead}
                  getKey={(l) => l.id}
                  getLabel={(l) => `${l.spectrum?.code ?? l.id} · ${l.leadName}`}
                  filterItem={(l, q) => `${l.spectrum?.code ?? ''} ${l.leadName} ${l.companyName} ${l.assignedSalesperson}`.toLowerCase().includes(q.trim().toLowerCase())}
                  columns={LEAD_COLUMNS}
                  searchPlaceholder="Search by code, lead, business entity or owner"
                  loading={leadsLoading}
                  onOpenChange={onLeadFieldOpen}
                  emptyText="No leads found"
                />
              ) : null} */}
              <div className="lg:col-span-2">
                <ProductPicker
                  label="Products Required"
                  catalog={productCatalog.products}
                  showUnit={!productCatalog.remote}
                  selected={selectedProducts}
                  onChange={setSelectedProducts}
                />
              </div>
            </FormGrid>
          </Section>

          <Section title="Business Entity & Contacts" icon={SECTION_ICONS.contact}>
            <EntityContactsFields
              value={entityContacts}
              onChange={(next) => {
                setEntityContacts(next)
                setErrors(({ companyName: _entity, contactPerson: _contact, ...rest }) => rest)
              }}
              errors={{ entity: errors.companyName, contact: errors.contactPerson }}
            />
          </Section>

          <Section title="Opportunity Details" icon={SECTION_ICONS.deal}>
            <FormGrid>
              <OptionLookupField
                label="Opportunity Stage"
                required
                error={errors.stage}
                placeholder="Select stage"
                detailHeader="Win %"
                value={dealStage}
                onValueChange={(value) => setDealStage(value as DealStage)}
                options={serverStages.map((stage) => ({ value: stage.opportunityStageName, label: stage.opportunityStageName, code: stage.code, detail: `${stageWeight(stage)}%` }))}
              />
              <OptionLookupField
                label="Opportunity Status"
                sortByCode
                required
                error={errors.status}
                placeholder="Select status"
                value={status}
                onValueChange={(value) => setStatus(value as OpportunityStatus)}
                options={(oppFill?.opportunityStatuses ?? []).map((st) => ({ value: st.opportunityStatusName, label: st.opportunityStatusName, code: st.code }))}
              />
              {serverMode ? (
                <OptionLookupField
                  label="Sales Organization"
                  required
                  error={errors.salesOrganization}
                  placeholder="Select sales organization"
                  value={salesOrganizationNo ? String(salesOrganizationNo) : ''}
                  onValueChange={(value) => setSalesOrganizationNo(Number(value) || undefined)}
                  options={(oppFill?.salesOrganizations ?? []).map((org) => ({
                    value: String(org.salesOrganizationNo),
                    label: org.salesOrganizationName,
                    code: org.code,
                  }))}
                />
              ) : null}
              <UserSelectField
                label="Opportunity Owner"
                required
                error={errors.owner}
                placeholder="Select owner"
                value={owner}
                onValueChange={(value, loginNo) => {
                  setOwner(value)
                  setOwnerLoginNo(loginNo)
                }}
              />
              <CurrencyAmountField
                label="Opportunity Value"
                required
                error={errors.dealValue ?? errors.currency}
                amount={dealValue}
                onAmountChange={setDealValue}
                currencies={oppFill?.currencies ?? []}
                currencyNo={currencyNo}
                onCurrencyNoChange={setCurrencyNo}
              />
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

          <Section title="Documents / Attachments" icon={SECTION_ICONS.documents}>
            <AttachmentsField
              noun="opportunity"
              formNo={ATTACHMENT_FORM_NO.opportunity}
              companyNo={spectrumCompany.headOfficeNo}
              value={attachments}
              onChange={setAttachments}
              onBusyChange={setUploadsBusy}
            />
          </Section>

          {Object.keys(errors).length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3" role="alert">
              <p className="text-xs w-full font-bold text-accent">Please fix the following before saving:</p>
              <ul className="space-y-0.5 w-full">
                {Object.values(errors).map((item) => (
                  <li key={item} className="text-xs text-accent">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cancel / Create at the right of the breadcrumb line (in place inside the Quick Create drawer). */}
          <BreadcrumbActions inline={embedded}>
            <Button variant="secondary" onClick={onBack} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" onClick={handleSave} disabled={saving || !serverMode}>
              {saving ? 'Creating…' : 'Create Opportunity'}
            </Button>
          </BreadcrumbActions>
        </div>
      </div>
    </div>
  )
}
