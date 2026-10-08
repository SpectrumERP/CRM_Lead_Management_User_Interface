import { useEffect, useMemo, useRef, useState } from 'react'
import { BUSINESS_ENTITY_LIMITS, type LocationDraft } from '../../api/businessEntities'
import type { CountryOption, LocationTypeOption, TimeZoneOption } from '../../api/businessEntityFillValues'
import { fetchStatesByCountry, searchCities, toNo, type CityComboRow, type StateOption } from '../../api/geo'
import { SearchSelectField, SelectField, TextAreaField, TextField } from '../../ui'
import { locationTimeZoneOptions, nextLocationTimeZoneNo } from '../../utils/timeZones/locationTimeZone'

export interface LocationFieldsProps {
  value: LocationDraft
  /** Applies a change; one call may set several fields (a city also sets its state and country). */
  onChange: (patch: Partial<LocationDraft>) => void
  /** Keys as in `locationErrors` (address, locationTypeNo, pinCode, latitude…). */
  errors: Record<string, string>
  countries: readonly CountryOption[]
  timeZones: readonly TimeZoneOption[]
  /** Show the Location Type field (extra locations; the primary one uses the default type). */
  locationTypes?: readonly LocationTypeOption[]
  /** Opens "Add city" with the current country / state; absent without rights to add cities. */
  onAddCity?: () => void
  /** `primary`: four columns on the form; `modal`: two columns in the location dialog (map fields always shown). */
  layout?: 'primary' | 'modal'
}

/** City option: the picked city plus the search results. */
function cityOption(value: LocationDraft): CityComboRow | null {
  const cityNo = toNo(value.cityNo)
  if (!cityNo) return null
  return {
    cityNo,
    cityName: value.cityName,
    stateNo: toNo(value.stateNo),
    stateName: value.stateName,
    countryNo: toNo(value.countryNo),
    countryName: value.countryName,
  }
}

/**
 * Address, country → state → city, PIN, time zone and map position for one location.
 * Picking a city fills its state and country; the time zone follows the place (see locationTimeZone.ts).
 */
export default function LocationFields({ value, onChange, errors, countries, timeZones, locationTypes, onAddCity, layout = 'primary' }: LocationFieldsProps) {
  const [states, setStates] = useState<StateOption[]>([])
  const [cities, setCities] = useState<CityComboRow[]>([])
  const [cityQuery, setCityQuery] = useState('')
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [showMap, setShowMap] = useState(Boolean(value.mapUrl || value.latitude || value.longitude))
  const countryNo = toNo(value.countryNo)
  const stateNo = toNo(value.stateNo)

  // States of the chosen country.
  useEffect(() => {
    setStates([])
    if (!countryNo) return
    let cancelled = false
    fetchStatesByCountry(countryNo)
      .then((rows) => { if (!cancelled) setStates(rows) })
      .catch(() => { if (!cancelled) setStates([]) })
    return () => { cancelled = true }
  }, [countryNo])

  // City search: by keyword across all states, narrowed to the chosen state.
  const searchId = useRef(0)
  useEffect(() => {
    const query = cityQuery.trim()
    if (!query && !stateNo) {
      searchId.current++
      setCities([])
      setCitiesLoading(false)
      return
    }
    const id = ++searchId.current
    setCitiesLoading(true)
    const timer = window.setTimeout(() => {
      searchCities(query, stateNo)
        .then((rows) => { if (id === searchId.current) setCities(rows) })
        .catch(() => { if (id === searchId.current) setCities([]) })
        .finally(() => { if (id === searchId.current) setCitiesLoading(false) })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [cityQuery, stateNo])

  const selectedCountry = countries.find((c) => c.countryNo === countryNo) ?? null
  const selectedState = states.find((s) => s.stateNo === stateNo) ?? (stateNo ? { stateNo, stateName: value.stateName } : null)
  const selectedCity = cityOption(value)
  const cityOptions = useMemo(
    () => (selectedCity && !cities.some((c) => c.cityNo === selectedCity.cityNo) ? [selectedCity, ...cities] : cities),
    [cities, selectedCity],
  )
  const zoneOptions = useMemo(
    () => locationTimeZoneOptions(timeZones, countryNo, value.timeZoneNo, value.timeZoneName),
    [timeZones, countryNo, value.timeZoneNo, value.timeZoneName],
  )

  function zoneFor(place: { countryNo: number | null; country: string; state: string; city: string }, countryChanged: boolean) {
    return nextLocationTimeZoneNo(timeZones, value.timeZoneNo, place, countryChanged)
  }

  function changeCountry(country: CountryOption | null) {
    const next = country?.countryNo ?? null
    const countryChanged = next !== countryNo
    onChange({
      countryNo: next ? String(next) : '',
      countryName: country?.countryName ?? '',
      stateNo: '',
      stateName: '',
      cityNo: '',
      cityName: '',
      timeZoneNo: zoneFor({ countryNo: next, country: country?.countryName ?? '', state: '', city: '' }, countryChanged),
      timeZoneName: '',
    })
  }

  function changeState(state: StateOption | null) {
    onChange({
      stateNo: state ? String(state.stateNo) : '',
      stateName: state?.stateName ?? '',
      cityNo: '',
      cityName: '',
      timeZoneNo: zoneFor({ countryNo, country: value.countryName, state: state?.stateName ?? '', city: '' }, false),
    })
  }

  function changeCity(city: CityComboRow | null) {
    if (!city) {
      onChange({ cityNo: '', cityName: '' })
      return
    }
    // A city from another country or state brings them along.
    const cityCountryNo = city.countryNo ?? countryNo
    const countryChanged = cityCountryNo !== countryNo
    const countryName = countries.find((c) => c.countryNo === cityCountryNo)?.countryName || city.countryName || value.countryName
    const stateName = city.stateName || value.stateName
    onChange({
      cityNo: String(city.cityNo),
      cityName: city.cityName,
      countryNo: cityCountryNo ? String(cityCountryNo) : '',
      countryName,
      stateNo: city.stateNo ? String(city.stateNo) : value.stateNo,
      stateName,
      timeZoneNo: zoneFor({ countryNo: cityCountryNo, country: countryName, state: stateName, city: city.cityName }, countryChanged),
    })
  }

  const L = BUSINESS_ENTITY_LIMITS
  const modal = layout === 'modal'
  const mapVisible = modal || showMap

  const country = (
    <SearchSelectField<CountryOption>
      label="Country"
      options={countries}
      value={selectedCountry}
      onChange={changeCountry}
      getKey={(c) => String(c.countryNo)}
      getLabel={(c) => c.countryName}
      placeholder="Select country"
      searchPlaceholder="Search country…"
    />
  )
  const state = (
    <SearchSelectField<StateOption>
      label="State"
      options={states}
      value={selectedState}
      onChange={changeState}
      getKey={(s) => String(s.stateNo)}
      getLabel={(s) => s.stateName}
      disabled={!countryNo}
      placeholder="Select state"
      searchPlaceholder="Search state…"
    />
  )
  const city = (
    <SearchSelectField<CityComboRow>
      label="City"
      options={cityOptions}
      value={selectedCity}
      onChange={changeCity}
      getKey={(c) => String(c.cityNo)}
      getLabel={(c) => c.cityName}
      renderOption={(c) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{c.cityName}</span>
          <span className="truncate text-[11px] text-ink-faint">{[c.stateName, c.countryName].filter(Boolean).join(', ')}</span>
        </span>
      )}
      onQueryChange={setCityQuery}
      loading={citiesLoading}
      preserveOrder
      placeholder="Select city"
      searchPlaceholder="Search city…"
      emptyText={cityQuery.trim() || stateNo ? 'No cities found' : 'Type to search cities'}
      footer={onAddCity ? (
        <button type="button" className="font-semibold text-primary hover:underline" onClick={onAddCity}>
          + Add new city
        </button>
      ) : undefined}
    />
  )
  const pin = (
    <TextField
      label="PIN / ZIP Code"
      error={errors.pinCode}
      maxLength={L.pinCode}
      placeholder="Enter PIN / ZIP Code"
      value={value.pinCode}
      onValueChange={(pinCode) => onChange({ pinCode })}
    />
  )
  const zone = (
    <SelectField
      fieldClassName="sm:col-span-2"
      label="Timezone"
      placeholder="Select timezone"
      preserveOrder
      options={zoneOptions}
      value={value.timeZoneNo}
      onValueChange={(timeZoneNo) => onChange({ timeZoneNo, timeZoneName: '' })}
    />
  )
  const mapFields = (
    <>
      <TextField
        fieldClassName="sm:col-span-2"
        label="Map Location URL"
        error={errors.mapUrl}
        maxLength={L.mapUrl}
        placeholder="Enter/Paste Map Location URL"
        value={value.mapUrl}
        onValueChange={(mapUrl) => onChange({ mapUrl })}
      />
      <TextField
        label="Latitude"
        error={errors.latitude}
        inputMode="decimal"
        maxLength={L.coordinate}
        placeholder="Enter Latitude"
        value={value.latitude}
        onValueChange={(latitude) => onChange({ latitude })}
      />
      <TextField
        label="Longitude"
        error={errors.longitude}
        inputMode="decimal"
        maxLength={L.coordinate}
        placeholder="Enter Longitude"
        value={value.longitude}
        onValueChange={(longitude) => onChange({ longitude })}
      />
    </>
  )

  if (modal) {
    return (
      <div className="space-y-3.5">
        {locationTypes ? (
          <SelectField
            label="Location Type"
            required
            error={errors.locationTypeNo}
            placeholder="Select Location Type"
            preserveOrder
            options={locationTypes.map((t) => ({ value: String(t.locationTypeNo), label: t.locationTypeName }))}
            value={value.locationTypeNo}
            onValueChange={(locationTypeNo) => onChange({ locationTypeNo })}
          />
        ) : null}
        <TextAreaField
          label="Address"
          required
          error={errors.address}
          rows={3}
          maxLength={500}
          placeholder="Enter address"
          value={value.address}
          onValueChange={(address) => onChange({ address })}
        />
        <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2">
          {country}
          {state}
          {city}
          {pin}
          {zone}
          {mapFields}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <TextAreaField
        fieldClassName="sm:col-span-2 lg:col-span-4"
        label="Address"
        required
        error={errors.address}
        rows={2}
        maxLength={500}
        placeholder="Enter address"
        value={value.address}
        onValueChange={(address) => onChange({ address })}
      />
      {country}
      {state}
      {city}
      {pin}
      {zone}
      {mapVisible ? (
        mapFields
      ) : (
        <div className="flex min-w-0 items-end sm:col-span-2">
          <button type="button" onClick={() => setShowMap(true)}
            className="inline-flex h-10 items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Add map location
          </button>
        </div>
      )}
    </div>
  )
}
