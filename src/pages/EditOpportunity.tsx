import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DealStage, Opportunity, OpportunityStatus } from '../data/opportunities'
import { useCrmActions } from '../contexts/CrmStoreContext'
import { saveConfirm, useConfirm } from '../contexts/ConfirmContext'
import { useOpportunityFillValues } from '../components/useOpportunityFillValues'
import { spectrumEntityId } from '../components/useBusinessEntityOptions'
import EntityContactsFields, {
  contactDetailNos,
  fromContactEntries,
  toContactEntries,
  type EntityContactsValue,
} from '../components/EntityContactsFields'
import { stageWeight } from '../api/opportunityFormFillValues'
import { OptionLookupField } from '../components/OptionLookupField'
import CurrencyAmountField from '../components/CurrencyAmountField'
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice'
import { bySequence, guessIsoCurrency } from '../api/fillValues'
import { Button, Card, FormGrid, TextField } from '../ui'
import { UserSelectField } from '../components/UserSelect'
import ProductPicker, { useProductCatalog } from '../components/ProductPicker'
import { productsFromText, productsToText, type Product } from '../data/products'
import { FIELD_LIMITS } from '../constants/fieldLimits'
import AttachmentsField from '../components/AttachmentsField'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'
import { ATTACHMENT_FORM_NO, type Attachment } from '../api/attachments'
import { formatDate } from '../utils/dateFormat'

interface EditOpportunityProps {
  existing: Opportunity
  onBack: () => void
  onSuccess: () => void
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

export default function EditOpportunity({ existing, onBack, onSuccess }: EditOpportunityProps) {
  const { patchOpportunity } = useCrmActions()
  const confirm = useConfirm()
  const [name, setName] = useState(existing.name)
  // Business entity (fixed after creation) + primary / secondary contacts, shared with the lead form.
  const [entityContacts, setEntityContacts] = useState<EntityContactsValue>(() => ({
    entity: {
      id: existing.spectrum?.businessEntityNo ? spectrumEntityId(existing.spectrum.businessEntityNo) : `name:${existing.companyName}`,
      name: existing.companyName,
      type: '',
      city: '',
      source: existing.spectrum ? 'spectrum' : 'local',
      businessEntityNo: existing.spectrum?.businessEntityNo,
    },
    ...fromContactEntries(
      existing.contacts?.length
        ? existing.contacts
        : [{ name: existing.contactPerson, email: existing.email, phones: existing.phone ? [existing.phone] : [], primary: true }],
    ),
  }))
  const contactsTouched = useRef(false)
  const productCatalog = useProductCatalog()
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(() =>
    productsFromText(existing.productsRequired, productCatalog.products),
  )
  const productsTouched = useRef(false)
  // Server products arrive after the first render — re-match the saved text until the user edits it.
  useEffect(() => {
    if (!productsTouched.current) setSelectedProducts(productsFromText(existing.productsRequired, productCatalog.products))
  }, [existing.productsRequired, productCatalog.products])
  const [dealValue, setDealValue] = useState(String(existing.dealValue))
  const [dealStage, setDealStage] = useState<DealStage>(existing.dealStage)
  const [status, setStatus] = useState<OpportunityStatus>(existing.status ?? 'Open')
  const [closingDate, setClosingDate] = useState(existing.closingDate)
  const [owner, setOwner] = useState(existing.owner)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  // Uploaded to the document store as they are picked; the save links them by docNo.
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadsBusy, setUploadsBusy] = useState(false)
  const spectrumCompany = useSpectrumCompany()
  const [submitted, setSubmitted] = useState(false)
  // Server opportunity → server lists; contacts are read-only (they come from the business entity).
  const serverRef = existing.spectrum
  const { values: oppFill } = useOpportunityFillValues()
  const serverMode = Boolean(serverRef && oppFill)
  const [currencyNo, setCurrencyNo] = useState<number | undefined>(serverRef?.currencyNo)
  const [ownerLoginNo, setOwnerLoginNo] = useState<number | undefined>(serverRef?.ownerLoginNo)

  function validate() {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Opportunity name is required'
    if (!entityContacts.primary?.name.trim()) next.contactPerson = 'Select the primary contact person'
    const value = Number(dealValue)
    if (!Number.isFinite(value) || value < 0) next.dealValue = 'Enter a valid opportunity value'
    if (!closingDate) next.closingDate = 'Expected closure date is required'
    if (!owner.trim()) next.owner = 'Opportunity owner is required'
    if (!status) next.status = 'Opportunity status is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (saving || !validate()) return
    // Only server opportunities can be edited (no in-app copies).
    if (!serverMode || !serverRef) {
      setErrors({ form: 'Sign in with your Spectrum account to edit this opportunity.' })
      return
    }
    if (uploadsBusy) {
      setErrors({ form: 'Please wait for all attachments to finish uploading before saving the opportunity.' })
      return
    }
    if (!(await confirm(saveConfirm('Opportunity', true)))) return
    setSaving(true)
    const pickedCurrency = oppFill?.currencies.find((c) => c.currencyNo === currencyNo)
    patchOpportunity(existing.id, {
      name: name.trim(),
      contactPerson: entityContacts.primary?.name.trim() ?? '',
      email: entityContacts.primary?.email.trim() ?? '',
      phone: entityContacts.primary?.phone.trim() ?? '',
      contacts: toContactEntries(entityContacts),
      productsRequired: productsToText(selectedProducts),
      dealValue: Number(dealValue),
      valueCurrency: pickedCurrency
        ? guessIsoCurrency({ currencyName: pickedCurrency.currencyName, symbol: pickedCurrency.symbol ?? '' })
        : existing.valueCurrency,
      dealStage,
      status,
      closingDate,
      owner: owner.trim(),
      // Numbers picked from the server lists. Contacts only when changed here, so an opportunity whose
      // detail never loaded keeps its server contacts.
      spectrum: {
        ...serverRef,
        currencyNo,
        ownerLoginNo,
        ...(contactsTouched.current ? { contactPersonDetailNos: contactDetailNos(entityContacts) } : {}),
        attachmentNos: attachments.map((a) => a.id),
      },
    })
    setTimeout(() => {
      setSubmitted(true)
      setTimeout(onSuccess, 1200)
    }, 400)
  }

  if (submitted) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center bg-canvas">
        <Card className="max-w-sm px-10 py-12 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="ui-title mb-1 text-lg">Opportunity Updated!</h2>
          <p className="ui-subtitle mb-6 text-sm">{existing.companyName} has been saved.</p>
          <p className="text-xs text-ink-faint">Redirecting…</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-canvas form-labels-as-written">
      <div className="page-gutter py-4 pb-4">
        <div className="mb-5">
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Opportunity
          </button>
          <h1 className="ui-title text-xl">Edit Opportunity</h1>
          <p className="ui-subtitle mt-0.5 text-xs">
            Editing <span className="font-mono font-semibold text-primary">{existing.id}</span>
            <span className="mx-1.5">·</span>
            {existing.companyName}
          </p>
        </div>

        <div className="space-y-5">
          <SpectrumRequiredNotice what="Opportunities and their lists" />
          <Section title="System fields" icon={SECTION_ICONS.system}>
            <FormGrid>
              <TextField label="Opportunity No" value={existing.id} disabled />
              <TextField
                label="Reference Lead No"
                value={existing.leadId?.trim() || '—'}
                disabled
              />
              <TextField label="Creation Date" value={formatDate(existing.createdAt)} disabled />
              <TextField label="Created By" value={existing.createdBy || '—'} disabled />
            </FormGrid>
          </Section>

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
              <div className="lg:col-span-2">
                <ProductPicker
                  label="Products Required"
                  catalog={productCatalog.products}
                  showUnit={!productCatalog.remote}
                  selected={selectedProducts}
                  onChange={(next) => {
                    productsTouched.current = true
                    setSelectedProducts(next)
                  }}
                />
              </div>
            </FormGrid>
          </Section>

          <Section title="Business Entity & Contacts" icon={SECTION_ICONS.contact}>
            <EntityContactsFields
              value={entityContacts}
              entityLocked
              onChange={(next) => {
                contactsTouched.current = true
                setEntityContacts(next)
                setErrors(({ contactPerson: _cleared, ...rest }) => rest)
              }}
              errors={{ contact: errors.contactPerson }}
            />
          </Section>

          <Section title="Opportunity Details" icon={SECTION_ICONS.deal}>
            <FormGrid>
              <OptionLookupField
                label="Opportunity Stage"
                required
                placeholder="Select stage"
                detailHeader="Win %"
                value={dealStage}
                onValueChange={(value) => setDealStage(value as DealStage)}
                options={bySequence(oppFill?.opportunityStages ?? []).map((stage) => ({ value: stage.opportunityStageName, label: stage.opportunityStageName, code: stage.code, detail: `${stageWeight(stage)}%` }))}
              />
              <OptionLookupField
                label="Opportunity Status"
                required
                error={errors.status}
                placeholder="Select status"
                value={status}
                onValueChange={(value) => setStatus(value as OpportunityStatus)}
                options={(oppFill?.opportunityStatuses ?? []).map((st) => ({ value: st.opportunityStatusName, label: st.opportunityStatusName, code: st.code }))}
              />
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
                error={errors.dealValue}
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
              <TextField
                label="Weighted Value (auto)"
                type="number"
                value={String(
                  Math.round(((Number(dealValue) || 0) * stageWeight(oppFill?.opportunityStages.find((st) => st.opportunityStageName === dealStage))) / 100),
                )}
                disabled
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
              transactionId={serverRef?.opportunityNo}
              onBusyChange={setUploadsBusy}
            />
          </Section>

          {Object.keys(errors).length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3" role="alert">
              <p className="text-xs font-bold w-full text-accent">Please fix the following before saving:</p>
              <ul className="space-y-0.5 w-full">
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
            <Button variant="solid" onClick={handleSave} disabled={saving || !serverMode}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
