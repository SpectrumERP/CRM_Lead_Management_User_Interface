/**
 * Time zone helpers for business entity locations (same rules as the Task Management form):
 * a country with one zone gets it; a country with several gets the first, refined by state / city.
 */
import { guessWindowsTimeZone } from './timezoneGuesser'
import { buildTimeZoneComboboxOptions, formatTimeZoneDisplay } from './windowsTimeZones'

/** Business entity fill-values time zone row, normalised (see businessEntities.ts). */
export interface LocationTimeZone {
  timeZoneNo: number
  timeZoneName: string
  countryNo: number | null
}

function inCountry(timeZones: readonly LocationTimeZone[], countryNo: number | null) {
  if (countryNo == null) return []
  return timeZones.filter((tz) => tz.countryNo === countryNo)
}

function asOptionLike(timeZones: readonly LocationTimeZone[]) {
  return timeZones.map((tz) => ({ timeZoneNo: tz.timeZoneNo, timeZoneName: tz.timeZoneName }))
}

/**
 * Zone to pre-select: the country's only zone. A country with several zones gets the one its state / city
 * points to, else the first in the list (by UTC offset). A country with no zones mapped gets the guessed one.
 */
export function suggestLocationTimeZoneNo(
  timeZones: readonly LocationTimeZone[],
  countryNo: number | null,
  country: string,
  state: string,
  city: string,
): string | null {
  const zones = inCountry(timeZones, countryNo)
  if (zones.length === 1) return String(zones[0].timeZoneNo)
  const first = zones.length ? buildTimeZoneComboboxOptions(asOptionLike(zones))[0].value : null
  // Without a state or city the guess is only the country's, so the list's first zone is the default.
  if (first && !state.trim() && !city.trim()) return first
  const guessed = guessWindowsTimeZone(country, state, city)
  const match = guessed ? (zones.length ? zones : timeZones).find((tz) => tz.timeZoneName === guessed) : undefined
  return match ? String(match.timeZoneNo) : first
}

/** True when the country has more than one zone, so state / city can change the pick. */
export function countryHasMultipleTimeZones(timeZones: readonly LocationTimeZone[], countryNo: number | null) {
  return inCountry(timeZones, countryNo).length > 1
}

/**
 * The zone after the country, state or city of a location changes. A new country always re-picks
 * (and clears when nothing fits); within a country only multi-zone countries re-pick.
 */
export function nextLocationTimeZoneNo(
  timeZones: readonly LocationTimeZone[],
  current: string,
  place: { countryNo: number | null; country: string; state: string; city: string },
  countryChanged: boolean,
): string {
  if (!countryChanged && !countryHasMultipleTimeZones(timeZones, place.countryNo)) return current
  const suggested = suggestLocationTimeZoneNo(timeZones, place.countryNo, place.country, place.state, place.city)
  return suggested ?? (countryChanged ? '' : current)
}

/** "(UTC+05:30) Chennai, Kolkata…" for a zone number, falling back to the given name. */
export function locationTimeZoneLabel(
  timeZones: readonly LocationTimeZone[],
  timeZoneNo: string | number | null | undefined,
  fallbackName?: string,
): string {
  if (timeZoneNo == null || timeZoneNo === '') return ''
  const tz = timeZones.find((t) => String(t.timeZoneNo) === String(timeZoneNo))
  return formatTimeZoneDisplay(tz?.timeZoneName ?? fallbackName) || fallbackName || ''
}

/** Options limited to the country's zones (all zones when the country has none mapped), by UTC offset. */
export function locationTimeZoneOptions(
  timeZones: readonly LocationTimeZone[],
  countryNo: number | null,
  selectedNo: string,
  selectedName?: string,
): { value: string; label: string }[] {
  const zones = inCountry(timeZones, countryNo)
  const options = buildTimeZoneComboboxOptions(asOptionLike(zones.length ? zones : timeZones))
  if (selectedNo && !options.some((o) => o.value === selectedNo)) {
    options.push({ value: selectedNo, label: locationTimeZoneLabel(timeZones, selectedNo, selectedName) })
  }
  return options
}
