/**
 * A scanned business card into the entity form (Task Management rules): only empty fields are
 * filled; a card for another person or address is kept as an extra contact / location instead.
 */
import type { BusinessCardData } from '../../api/businessCard'
import { emptyContact, emptyLocation, type BusinessEntityDraft, type LocationDraft } from '../../api/businessEntities'
import type { BusinessEntityFillValues } from '../../api/businessEntityFillValues'
import { defaultLocationTypeNo } from '../../api/businessEntityFillValues'
import { fetchStatesByCountry, searchCities } from '../../api/geo'
import { suggestLocationTimeZoneNo } from '../../utils/timeZones/locationTimeZone'

const v = (text?: string) => (text ?? '').trim()
const same = (a: string, b: string) => Boolean(a) && Boolean(b) && a.trim().toLowerCase() === b.trim().toLowerCase()

export interface ScannedMerge {
  draft: BusinessEntityDraft
  /** The card's place, to look up for the primary address (it had no city or country yet). */
  placeForPrimary: { city: string; state: string; country: string } | null
}

export function mergeScannedCard(
  draft: BusinessEntityDraft,
  card: BusinessCardData,
  fill: Pick<BusinessEntityFillValues, 'countries' | 'locationTypes' | 'timeZones'>,
): ScannedMerge {
  const next: BusinessEntityDraft = { ...draft }
  if (v(card.company) && !next.name.trim()) next.name = v(card.company)
  // Cards often list several sites ("a.org, b.in"): keep the first.
  const website = v(card.website).split(/[,\s]+/)[0]
  if (website && !next.website.trim()) next.website = website

  const name = v(card.name)
  const designation = v(card.designation)
  const phone = v(card.phone)
  const email = v(card.email)
  if (name || designation || phone || email) {
    const primary = next.primaryContact
    if (!primary.name.trim() || same(name, primary.name)) {
      next.primaryContact = {
        ...primary,
        name: primary.name.trim() ? primary.name : name,
        designation: primary.designation.trim() ? primary.designation : designation,
        phone: primary.phone.trim() ? primary.phone : phone,
        email: primary.email.trim() ? primary.email : email,
      }
    } else {
      next.contacts = [...next.contacts, { ...emptyContact(), name, designation, phone, email }]
    }
  }

  const address = v(card.address)
  const city = v(card.city)
  const state = v(card.state)
  const country = v(card.country)
  const pin = v(card.zipCode)
  let placeForPrimary: ScannedMerge['placeForPrimary'] = null
  if (address || city || state || country) {
    const primary = next.primaryLocation
    if (!primary.address.trim() || same(address, primary.address)) {
      next.primaryLocation = {
        ...primary,
        address: primary.address.trim() ? primary.address : address,
        pinCode: primary.pinCode.trim() ? primary.pinCode : pin,
      }
      if (!primary.cityNo && !primary.countryNo && (city || state || country)) placeForPrimary = { city, state, country }
    } else {
      const known = fill.countries.find((c) => same(c.countryName, country))
      const zone = suggestLocationTimeZoneNo(fill.timeZones, known?.countryNo ?? null, country, state, city)
      const extra: LocationDraft = {
        ...emptyLocation(defaultLocationTypeNo(fill)),
        address,
        countryNo: known ? String(known.countryNo) : '',
        countryName: known?.countryName ?? country,
        stateName: state,
        cityName: city,
        pinCode: pin,
        timeZoneNo: zone ?? '',
      }
      next.locations = [...next.locations, extra]
    }
  }
  return { draft: next, placeForPrimary }
}

/**
 * Look up the card's place: a city matching by name (and state or country) brings its state and
 * country; otherwise the country, and its state when one matches. Null when nothing matches.
 */
export async function resolveScannedPlace(
  place: { city: string; state: string; country: string },
  fill: Pick<BusinessEntityFillValues, 'countries' | 'timeZones'>,
): Promise<Partial<LocationDraft> | null> {
  const zoneFor = (countryNo: number | null, country: string, state: string, city: string) =>
    suggestLocationTimeZoneNo(fill.timeZones, countryNo, country, state, city) ?? ''

  if (place.city) {
    const rows = await searchCities(place.city).catch(() => [])
    const match =
      rows.find((r) => same(r.cityName, place.city) && same(r.stateName, place.state)) ??
      rows.find((r) => same(r.cityName, place.city) && same(r.countryName, place.country)) ??
      (!place.state && !place.country ? rows.find((r) => same(r.cityName, place.city)) : undefined)
    if (match) {
      const countryName = fill.countries.find((c) => c.countryNo === match.countryNo)?.countryName || match.countryName
      return {
        cityNo: String(match.cityNo),
        cityName: match.cityName,
        stateNo: match.stateNo ? String(match.stateNo) : '',
        stateName: match.stateName,
        countryNo: match.countryNo ? String(match.countryNo) : '',
        countryName,
        timeZoneNo: zoneFor(match.countryNo, countryName, match.stateName, match.cityName),
        timeZoneName: '',
      }
    }
  }

  const country = fill.countries.find((c) => same(c.countryName, place.country))
  if (!country) return null
  const states = await fetchStatesByCountry(country.countryNo).catch(() => [])
  const state = states.find((s) => same(s.stateName, place.state))
  return {
    countryNo: String(country.countryNo),
    countryName: country.countryName,
    stateNo: state ? String(state.stateNo) : '',
    stateName: state?.stateName ?? '',
    timeZoneNo: zoneFor(country.countryNo, country.countryName, state?.stateName ?? '', ''),
    timeZoneName: '',
  }
}
