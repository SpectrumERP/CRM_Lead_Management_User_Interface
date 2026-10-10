import { describe, expect, it } from 'vitest'
import {
  locationTimeZoneLabel,
  locationTimeZoneOptions,
  nextLocationTimeZoneNo,
  suggestLocationTimeZoneNo,
  type LocationTimeZone,
} from './locationTimeZone'

const ZONES: LocationTimeZone[] = [
  { timeZoneNo: 1, timeZoneName: 'India Standard Time', countryNo: 91 },
  { timeZoneNo: 2, timeZoneName: 'Eastern Standard Time', countryNo: 1 },
  { timeZoneNo: 3, timeZoneName: 'Pacific Standard Time', countryNo: 1 },
  { timeZoneNo: 4, timeZoneName: 'GMT Standard Time', countryNo: null },
]

describe('location time zones', () => {
  it('picks a country’s only zone, else guesses from the state', () => {
    expect(suggestLocationTimeZoneNo(ZONES, 91, 'India', '', '')).toBe('1')
    expect(suggestLocationTimeZoneNo(ZONES, 1, 'United States', 'California', '')).toBe('3')
    expect(suggestLocationTimeZoneNo(ZONES, 1, 'United States', 'New York', '')).toBe('2')
    expect(suggestLocationTimeZoneNo(ZONES, null, 'United Kingdom', '', '')).toBe('4')
    expect(suggestLocationTimeZoneNo(ZONES, null, 'Atlantis', '', '')).toBeNull()
  })

  it('defaults a multi-zone country to the first zone in the list', () => {
    // Pacific (UTC-08:00) lists before Eastern (UTC-05:00).
    expect(suggestLocationTimeZoneNo(ZONES, 1, 'United States', '', '')).toBe('3')
    expect(nextLocationTimeZoneNo(ZONES, '', { countryNo: 1, country: 'United States', state: '', city: '' }, true)).toBe('3')
  })

  it('re-picks only for a new country or a multi-zone country', () => {
    const india = { countryNo: 91, country: 'India', state: 'Goa', city: '' }
    expect(nextLocationTimeZoneNo(ZONES, '4', india, false)).toBe('4')
    expect(nextLocationTimeZoneNo(ZONES, '4', india, true)).toBe('1')
    const us = { countryNo: 1, country: 'United States', state: 'New York', city: '' }
    expect(nextLocationTimeZoneNo(ZONES, '3', us, false)).toBe('2')
    // A new country with nothing to suggest clears the zone.
    expect(nextLocationTimeZoneNo(ZONES, '3', { countryNo: 7, country: 'Atlantis', state: '', city: '' }, true)).toBe('')
  })

  it('lists the country’s zones by offset, keeping a selected zone from elsewhere', () => {
    expect(locationTimeZoneOptions(ZONES, 1, '').map((o) => o.value)).toEqual(['3', '2'])
    expect(locationTimeZoneOptions(ZONES, 1, '1').map((o) => o.value)).toEqual(['3', '2', '1'])
    expect(locationTimeZoneLabel(ZONES, 1)).toBe('(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi')
    expect(locationTimeZoneLabel(ZONES, 99, 'Custom Zone')).toBe('Custom Zone')
  })
})
