/** Pop-ups of the business entity form (as in Task Management): location, contact person, add city. */
import { useEffect, useState } from 'react'
import {
  BUSINESS_ENTITY_LIMITS,
  contactErrors,
  locationErrors,
  type ContactDraft,
  type ContactStatus,
  type LocationDraft,
} from '../../api/businessEntities'
import { clearBusinessEntityFillValuesCache, type CountryOption, type LocationTypeOption, type TimeZoneOption } from '../../api/businessEntityFillValues'
import { toApiError } from '../../api/errors'
import { fetchStatesByCountry, type CityComboRow, type StateOption } from '../../api/geo'
import { LOCATION_MASTER_LIMITS, locationMasterApis } from '../../api/locationMasters'
import { SearchSelectField, SelectField, TextField } from '../../ui'
import LocationFields from './LocationFields'
import FormDrawer from '../../components/FormDrawer'
import { ICON, Icon, OutlineButton, SolidButton } from './ui'

function Footer({ onCancel, onSave, saving, saveLabel }: { onCancel: () => void; onSave: () => void; saving?: boolean; saveLabel: string }) {
  return (
    <>
      <OutlineButton onClick={onCancel} className="h-9">Cancel</OutlineButton>
      <SolidButton onClick={onSave} disabled={saving} className="h-9 px-4">
        <Icon d={ICON.save} size={14} />
        {saving ? 'Saving…' : saveLabel}
      </SolidButton>
    </>
  )
}

function useClearingPatch<T extends object>(initial: T) {
  const [value, setValue] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  function patch(next: Partial<T>) {
    setValue((prev) => ({ ...prev, ...next }))
    setErrors((prev) => {
      const copy = { ...prev }
      for (const key of Object.keys(next)) delete copy[key]
      return copy
    })
  }
  return { value, setValue, errors, setErrors, patch }
}

// ─── Location ────────────────────────────────────────────────────────────────

export function LocationDialog({
  initial,
  isNew,
  countries,
  timeZones,
  locationTypes,
  onAddCity,
  cityCreated,
  onSave,
  onClose,
}: {
  initial: LocationDraft
  isNew: boolean
  countries: readonly CountryOption[]
  timeZones: readonly TimeZoneOption[]
  locationTypes: readonly LocationTypeOption[]
  onAddCity?: (place: LocationDraft) => void
  /** A city just added through "Add city" — applied to this location. */
  cityCreated?: Partial<LocationDraft> | null
  onSave: (location: LocationDraft) => void
  onClose: () => void
}) {
  const { value, setValue, errors, setErrors, patch } = useClearingPatch(initial)

  useEffect(() => {
    if (cityCreated) setValue((prev) => ({ ...prev, ...cityCreated }))
  }, [cityCreated, setValue])

  function save() {
    const e = locationErrors(value, { typeRequired: true })
    if (e.address) e.address = 'Location address is required'
    setErrors(e)
    if (Object.keys(e).length === 0) onSave(value)
  }

  return (
    <FormDrawer
      title={isNew ? 'Add Location' : 'Edit Location'}
      subtitle="Another office, site or warehouse"
      icon={<Icon d={ICON.pin} size={17} />}
      widthClass="w-[36rem]"
      onClose={onClose}
      footer={(requestClose) => <Footer onCancel={requestClose} onSave={save} saveLabel={isNew ? 'Add Location' : 'Update Location'} />}
    >
      <LocationFields
        layout="modal"
        value={value}
        onChange={patch}
        errors={errors}
        countries={countries}
        timeZones={timeZones}
        locationTypes={locationTypes}
        onAddCity={onAddCity ? () => onAddCity(value) : undefined}
      />
    </FormDrawer>
  )
}

// ─── Contact person ──────────────────────────────────────────────────────────

export function ContactDialog({
  initial,
  isNew,
  onSave,
  onClose,
}: {
  initial: ContactDraft
  isNew: boolean
  /** May save on the server (editing a saved entity); the drawer shows Saving… until it settles. */
  onSave: (contact: ContactDraft) => void | Promise<void>
  onClose: () => void
}) {
  const { value, errors, setErrors, patch } = useClearingPatch(initial)
  const [saving, setSaving] = useState(false)
  const L = BUSINESS_ENTITY_LIMITS

  async function save() {
    if (saving) return
    const e = contactErrors(value, { emailRequired: true })
    if (e.name) e.name = 'Representative Name is required'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      await onSave(value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDrawer
      title={isNew ? 'Add Contact Person' : 'Edit Contact Person'}
      subtitle="Another person at this business entity"
      icon={<Icon d={ICON.user} size={17} />}
      widthClass="w-[32rem]"
      onClose={onClose}
      footer={(requestClose) => <Footer onCancel={requestClose} onSave={() => void save()} saving={saving} saveLabel={isNew ? 'Add Contact' : 'Update Contact'} />}
    >
      <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2">
        <TextField fieldClassName="sm:col-span-2" label="Contact Person Name" required error={errors.name} maxLength={L.contactName} autoFocus
          placeholder="Enter contact person name" value={value.name} onValueChange={(name) => patch({ name })} />
        <TextField label="Designation" error={errors.designation} maxLength={L.designation}
          placeholder="Enter designation" value={value.designation} onValueChange={(designation) => patch({ designation })} />
        <TextField label="Phone" required error={errors.phone} type="tel" maxLength={L.phone}
          placeholder="Enter phone" value={value.phone} onValueChange={(phone) => patch({ phone })} />
        <TextField label="Email" required error={errors.email} type="email" maxLength={L.email}
          placeholder="Enter email" value={value.email} onValueChange={(email) => patch({ email })}
          onBlur={() => {
            const message = contactErrors(value, { emailRequired: true }).email
            if (message) setErrors((prev) => ({ ...prev, email: message }))
          }} />
        <div className="sm:col-span-2 sm:max-w-xs">
          <SelectField label="Status" placeholder="Select status" preserveOrder
            options={['Active', 'Inactive']} value={value.status}
            onValueChange={(status) => patch({ status: status as ContactStatus })} />
        </div>
      </div>
    </FormDrawer>
  )
}

// ─── Add city ────────────────────────────────────────────────────────────────

export function CityCreateDialog({
  headOfficeNo,
  countries,
  initialCountryNo,
  initialStateNo,
  onCreated,
  onClose,
  onError,
}: {
  headOfficeNo: number
  countries: readonly CountryOption[]
  initialCountryNo: number | null
  initialStateNo: number | null
  onCreated: (city: CityComboRow) => void
  onClose: () => void
  onError: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [countryNo, setCountryNo] = useState<number | null>(initialCountryNo)
  const [stateNo, setStateNo] = useState<number | null>(initialStateNo)
  const [states, setStates] = useState<StateOption[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStates([])
    if (!countryNo) return
    let cancelled = false
    fetchStatesByCountry(countryNo)
      .then((rows) => { if (!cancelled) setStates(rows) })
      .catch(() => { if (!cancelled) setStates([]) })
    return () => { cancelled = true }
  }, [countryNo])

  async function save() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'City Name is required'
    if (!countryNo) e.countryNo = 'Country is required'
    if (!stateNo) e.stateNo = 'State is required'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const cityNo = await locationMasterApis.city.save({ name, countryNo, stateNo }, headOfficeNo)
      clearBusinessEntityFillValuesCache()
      onCreated({
        cityNo,
        cityName: name.trim(),
        stateNo,
        stateName: states.find((s) => s.stateNo === stateNo)?.stateName ?? '',
        countryNo,
        countryName: countries.find((c) => c.countryNo === countryNo)?.countryName ?? '',
      })
    } catch (err) {
      onError(toApiError(err).message)
      setSaving(false)
    }
  }

  return (
    <FormDrawer
      title="City Master"
      subtitle="Add a city that is missing from the list"
      icon={<Icon d={ICON.building} size={17} />}
      widthClass="w-[30rem]"
      // Opens over the location drawer.
      zClass="z-[70]"
      onClose={onClose}
      footer={(requestClose) => <Footer onCancel={requestClose} onSave={() => void save()} saving={saving} saveLabel="Save" />}
    >
      <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2">
        <TextField fieldClassName="sm:col-span-2" label="City Name" required error={errors.name} maxLength={LOCATION_MASTER_LIMITS.name} autoFocus
          placeholder="Enter city name" value={name} onValueChange={(v) => { setName(v); setErrors((p) => ({ ...p, name: '' })) }} />
        <SearchSelectField<CountryOption>
          label="Country" required error={errors.countryNo}
          options={countries} value={countries.find((c) => c.countryNo === countryNo) ?? null}
          onChange={(c) => { setCountryNo(c?.countryNo ?? null); setStateNo(null); setErrors((p) => ({ ...p, countryNo: '' })) }}
          getKey={(c) => String(c.countryNo)} getLabel={(c) => c.countryName}
          placeholder="Select Country" searchPlaceholder="Search country…" />
        <SearchSelectField<StateOption>
          label="State" required error={errors.stateNo}
          options={states} value={states.find((s) => s.stateNo === stateNo) ?? null}
          onChange={(s) => { setStateNo(s?.stateNo ?? null); setErrors((p) => ({ ...p, stateNo: '' })) }}
          getKey={(s) => String(s.stateNo)} getLabel={(s) => s.stateName}
          disabled={!countryNo} placeholder={countryNo ? 'Select State' : 'Select country first'} searchPlaceholder="Search state…" />
      </div>
    </FormDrawer>
  )
}
