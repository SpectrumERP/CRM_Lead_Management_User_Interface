/** Windows-style timezone display: (UTC±HH:mm) Cities — keyed by Windows TZ id. */
export type WindowsTimeZoneMeta = { offset: string; cities: string };

export const WINDOWS_TIMEZONE_META: Record<string, WindowsTimeZoneMeta> = {
  'Afghanistan Standard Time': { offset: '+04:30', cities: 'Kabul' },
  'Alaskan Standard Time': { offset: '-09:00', cities: 'Alaska' },
  'Aleutian Standard Time': { offset: '-10:00', cities: 'Aleutian Islands' },
  'Altai Standard Time': { offset: '+07:00', cities: 'Barnaul, Gorno-Altaysk' },
  'Arab Standard Time': { offset: '+03:00', cities: 'Kuwait, Riyadh' },
  'Arabian Standard Time': { offset: '+04:00', cities: 'Abu Dhabi, Muscat' },
  'Arabic Standard Time': { offset: '+03:00', cities: 'Baghdad' },
  'Argentina Standard Time': { offset: '-03:00', cities: 'City of Buenos Aires' },
  'Astrakhan Standard Time': { offset: '+04:00', cities: 'Astrakhan, Ulyanovsk' },
  'Atlantic Standard Time': { offset: '-04:00', cities: 'Atlantic Time (Canada)' },
  'AUS Central Standard Time': { offset: '+09:30', cities: 'Darwin' },
  'Aus Central W. Standard Time': { offset: '+08:45', cities: 'Eucla' },
  'AUS Eastern Standard Time': { offset: '+10:00', cities: 'Canberra, Melbourne, Sydney' },
  'Azerbaijan Standard Time': { offset: '+04:00', cities: 'Baku' },
  'Azores Standard Time': { offset: '-01:00', cities: 'Azores' },
  'Bahia Standard Time': { offset: '-03:00', cities: 'Salvador' },
  'Bangladesh Standard Time': { offset: '+06:00', cities: 'Dhaka' },
  'Belarus Standard Time': { offset: '+03:00', cities: 'Minsk' },
  'Bougainville Standard Time': { offset: '+11:00', cities: 'Bougainville Island' },
  'Canada Central Standard Time': { offset: '-06:00', cities: 'Saskatchewan' },
  'Cape Verde Standard Time': { offset: '-01:00', cities: 'Cabo Verde Is.' },
  'Caucasus Standard Time': { offset: '+04:00', cities: 'Yerevan' },
  'Cen. Australia Standard Time': { offset: '+09:30', cities: 'Adelaide' },
  'Central America Standard Time': { offset: '-06:00', cities: 'Central America' },
  'Central Asia Standard Time': { offset: '+06:00', cities: 'Astana' },
  'Central Brazilian Standard Time': { offset: '-04:00', cities: 'Cuiaba' },
  'Central Europe Standard Time': { offset: '+01:00', cities: 'Belgrade, Bratislava, Budapest, Ljubljana, Prague' },
  'Central European Standard Time': { offset: '+01:00', cities: 'Sarajevo, Skopje, Warsaw, Zagreb' },
  'Central Pacific Standard Time': { offset: '+11:00', cities: 'Solomon Is., New Caledonia' },
  'Central Standard Time': { offset: '-06:00', cities: 'Central Time (US & Canada)' },
  'Central Standard Time (Mexico)': { offset: '-06:00', cities: 'Guadalajara, Mexico City, Monterrey' },
  'Chatham Islands Standard Time': { offset: '+12:45', cities: 'Chatham Islands' },
  'China Standard Time': { offset: '+08:00', cities: 'Beijing, Chongqing, Hong Kong SAR, Urumqi' },
  'Cuba Standard Time': { offset: '-05:00', cities: 'Havana' },
  'Dateline Standard Time': { offset: '-12:00', cities: 'International Date Line West' },
  'E. Africa Standard Time': { offset: '+03:00', cities: 'Nairobi' },
  'E. Australia Standard Time': { offset: '+10:00', cities: 'Brisbane' },
  'E. Europe Standard Time': { offset: '+02:00', cities: 'Chisinau' },
  'E. South America Standard Time': { offset: '-03:00', cities: 'Brasilia' },
  'Easter Island Standard Time': { offset: '-06:00', cities: 'Easter Island' },
  'Eastern Standard Time': { offset: '-05:00', cities: 'Eastern Time (US & Canada)' },
  'Eastern Standard Time (Mexico)': { offset: '-05:00', cities: 'Chetumal' },
  'Egypt Standard Time': { offset: '+02:00', cities: 'Cairo' },
  'Ekaterinburg Standard Time': { offset: '+05:00', cities: 'Ekaterinburg' },
  'Fiji Standard Time': { offset: '+12:00', cities: 'Fiji' },
  'FLE Standard Time': { offset: '+02:00', cities: 'Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius' },
  'Georgian Standard Time': { offset: '+04:00', cities: 'Tbilisi' },
  'GMT Standard Time': { offset: '+00:00', cities: 'Dublin, Edinburgh, Lisbon, London' },
  'Greenland Standard Time': { offset: '-03:00', cities: 'Greenland' },
  'Greenwich Standard Time': { offset: '+00:00', cities: 'Monrovia, Reykjavik' },
  'GTB Standard Time': { offset: '+02:00', cities: 'Athens, Bucharest' },
  'Haiti Standard Time': { offset: '-05:00', cities: 'Haiti' },
  'Hawaiian Standard Time': { offset: '-10:00', cities: 'Hawaii' },
  'India Standard Time': { offset: '+05:30', cities: 'Chennai, Kolkata, Mumbai, New Delhi' },
  'Iran Standard Time': { offset: '+03:30', cities: 'Tehran' },
  'Israel Standard Time': { offset: '+02:00', cities: 'Jerusalem' },
  'Jordan Standard Time': { offset: '+02:00', cities: 'Amman' },
  'Kaliningrad Standard Time': { offset: '+02:00', cities: 'Kaliningrad' },
  'Kamchatka Standard Time': { offset: '+12:00', cities: 'Petropavlovsk-Kamchatsky - Old' },
  'Korea Standard Time': { offset: '+09:00', cities: 'Seoul' },
  'Libya Standard Time': { offset: '+02:00', cities: 'Tripoli' },
  'Line Islands Standard Time': { offset: '+14:00', cities: 'Kiritimati Island' },
  'Lord Howe Standard Time': { offset: '+10:30', cities: 'Lord Howe Island' },
  'Magadan Standard Time': { offset: '+11:00', cities: 'Magadan' },
  'Magallanes Standard Time': { offset: '-03:00', cities: 'Punta Arenas' },
  'Marquesas Standard Time': { offset: '-09:30', cities: 'Marquesas Islands' },
  'Mauritius Standard Time': { offset: '+04:00', cities: 'Port Louis' },
  'Mid-Atlantic Standard Time': { offset: '-02:00', cities: 'Mid-Atlantic - Old' },
  'Middle East Standard Time': { offset: '+02:00', cities: 'Beirut' },
  'Montevideo Standard Time': { offset: '-03:00', cities: 'Montevideo' },
  'Morocco Standard Time': { offset: '+01:00', cities: 'Casablanca' },
  'Mountain Standard Time': { offset: '-07:00', cities: 'Mountain Time (US & Canada)' },
  'Mountain Standard Time (Mexico)': { offset: '-07:00', cities: 'Chihuahua, La Paz, Mazatlan' },
  'Myanmar Standard Time': { offset: '+06:30', cities: 'Yangon (Rangoon)' },
  'N. Central Asia Standard Time': { offset: '+07:00', cities: 'Novosibirsk' },
  'Namibia Standard Time': { offset: '+02:00', cities: 'Windhoek' },
  'Nepal Standard Time': { offset: '+05:45', cities: 'Kathmandu' },
  'New Zealand Standard Time': { offset: '+12:00', cities: 'Auckland, Wellington' },
  'Newfoundland Standard Time': { offset: '-03:30', cities: 'Newfoundland' },
  'Norfolk Standard Time': { offset: '+11:00', cities: 'Norfolk Island' },
  'North Asia East Standard Time': { offset: '+08:00', cities: 'Irkutsk' },
  'North Asia Standard Time': { offset: '+07:00', cities: 'Krasnoyarsk' },
  'North Korea Standard Time': { offset: '+09:00', cities: 'Pyongyang' },
  'Omsk Standard Time': { offset: '+06:00', cities: 'Omsk' },
  'Pacific SA Standard Time': { offset: '-04:00', cities: 'Santiago' },
  'Pacific Standard Time': { offset: '-08:00', cities: 'Pacific Time (US & Canada)' },
  'Pacific Standard Time (Mexico)': { offset: '-08:00', cities: 'Baja California' },
  'Pakistan Standard Time': { offset: '+05:00', cities: 'Islamabad, Karachi' },
  'Paraguay Standard Time': { offset: '-04:00', cities: 'Asuncion' },
  'Qyzylorda Standard Time': { offset: '+05:00', cities: 'Qyzylorda' },
  'Romance Standard Time': { offset: '+01:00', cities: 'Brussels, Copenhagen, Madrid, Paris' },
  'Russia Time Zone 10': { offset: '+11:00', cities: 'Chokurdakh' },
  'Russia Time Zone 11': { offset: '+12:00', cities: 'Anadyr, Petropavlovsk-Kamchatsky' },
  'Russia Time Zone 3': { offset: '+04:00', cities: 'Izhevsk, Samara' },
  'Russian Standard Time': { offset: '+03:00', cities: 'Moscow, St. Petersburg' },
  'SA Eastern Standard Time': { offset: '-03:00', cities: 'Cayenne, Fortaleza' },
  'SA Pacific Standard Time': { offset: '-05:00', cities: 'Bogota, Lima, Quito, Rio Branco' },
  'SA Western Standard Time': { offset: '-04:00', cities: 'Georgetown, La Paz, Manaus, San Juan' },
  'Saint Pierre Standard Time': { offset: '-03:00', cities: 'Saint Pierre and Miquelon' },
  'Sakhalin Standard Time': { offset: '+11:00', cities: 'Sakhalin' },
  'Samoa Standard Time': { offset: '+13:00', cities: 'Samoa' },
  'Sao Tome Standard Time': { offset: '+00:00', cities: 'Sao Tome' },
  'Saratov Standard Time': { offset: '+04:00', cities: 'Saratov' },
  'SE Asia Standard Time': { offset: '+07:00', cities: 'Bangkok, Hanoi, Jakarta' },
  'Singapore Standard Time': { offset: '+08:00', cities: 'Kuala Lumpur, Singapore' },
  'South Africa Standard Time': { offset: '+02:00', cities: 'Harare, Pretoria' },
  'South Sudan Standard Time': { offset: '+02:00', cities: 'Juba' },
  'Sri Lanka Standard Time': { offset: '+05:30', cities: 'Sri Jayawardenepura' },
  'Sudan Standard Time': { offset: '+02:00', cities: 'Khartoum' },
  'Syria Standard Time': { offset: '+02:00', cities: 'Damascus' },
  'Taipei Standard Time': { offset: '+08:00', cities: 'Taipei' },
  'Tasmania Standard Time': { offset: '+10:00', cities: 'Hobart' },
  'Tocantins Standard Time': { offset: '-03:00', cities: 'Araguaina' },
  'Tokyo Standard Time': { offset: '+09:00', cities: 'Osaka, Sapporo, Tokyo' },
  'Tomsk Standard Time': { offset: '+07:00', cities: 'Tomsk' },
  'Tonga Standard Time': { offset: '+13:00', cities: "Nuku'alofa" },
  'Transbaikal Standard Time': { offset: '+09:00', cities: 'Chita' },
  'Turkey Standard Time': { offset: '+03:00', cities: 'Istanbul' },
  'Turks And Caicos Standard Time': { offset: '-05:00', cities: 'Turks and Caicos' },
  'Türkiye Standard Time': { offset: '+02:00', cities: 'Istanbul' },
  'Ulaanbaatar Standard Time': { offset: '+08:00', cities: 'Ulaanbaatar' },
  'US Eastern Standard Time': { offset: '-05:00', cities: 'Indiana (East)' },
  'US Mountain Standard Time': { offset: '-07:00', cities: 'Arizona' },
  'UTC': { offset: '+00:00', cities: 'Coordinated Universal Time' },
  'UTC+12': { offset: '+12:00', cities: 'Coordinated Universal Time+12' },
  'UTC+13': { offset: '+13:00', cities: 'Coordinated Universal Time+13' },
  'UTC-02': { offset: '-02:00', cities: 'Coordinated Universal Time-02' },
  'UTC-08': { offset: '-08:00', cities: 'Coordinated Universal Time-08' },
  'UTC-09': { offset: '-09:00', cities: 'Coordinated Universal Time-09' },
  'UTC-11': { offset: '-11:00', cities: 'Coordinated Universal Time-11' },
  'Venezuela Standard Time': { offset: '-04:00', cities: 'Caracas' },
  'Vladivostok Standard Time': { offset: '+10:00', cities: 'Vladivostok' },
  'Volgograd Standard Time': { offset: '+03:00', cities: 'Volgograd' },
  'W. Australia Standard Time': { offset: '+08:00', cities: 'Perth' },
  'W. Central Africa Standard Time': { offset: '+01:00', cities: 'West Central Africa' },
  'W. Europe Standard Time': { offset: '+01:00', cities: 'Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna' },
  'W. Mongolia Standard Time': { offset: '+07:00', cities: 'Hovd' },
  'West Asia Standard Time': { offset: '+05:00', cities: 'Ashgabat, Tashkent' },
  'West Bank Standard Time': { offset: '+02:00', cities: 'Gaza, Hebron' },
  'West Pacific Standard Time': { offset: '+10:00', cities: 'Guam, Port Moresby' },
  'Yakutsk Standard Time': { offset: '+09:00', cities: 'Yakutsk' },
  'Yukon Standard Time': { offset: '-07:00', cities: 'Yukon' },
};

function normalizeOffset(raw: string): string {
  const t = String(raw || '').trim();
  if (!t || t === 'UTC' || t === 'Z') return '+00:00';
  const m = t.match(/^([+-]?)(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return '+00:00';
  const sign = m[1] === '-' ? '-' : '+';
  const hh = String(Number(m[2])).padStart(2, '0');
  const mm = String(m[3] ? Number(m[3]) : 0).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** Parse "+05:30" / "-11:00" into minutes from UTC. */
export function utcOffsetToMinutes(offset: string): number {
  const n = normalizeOffset(offset);
  const m = n.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -mins : mins;
}

function lookupMeta(name: string): WindowsTimeZoneMeta | null {
  const key = String(name || '').trim();
  if (!key) return null;
  if (WINDOWS_TIMEZONE_META[key]) return WINDOWS_TIMEZONE_META[key];
  const found = Object.keys(WINDOWS_TIMEZONE_META).find(
    (k) => k.toLowerCase() === key.toLowerCase()
  );
  return found ? WINDOWS_TIMEZONE_META[found] : null;
}

/**
 * Format like Windows timezone picker: "(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi"
 * Falls back to "(UTC±..) Name" when cities are unknown, or the raw name.
 */
export function formatWindowsTimeZoneLabel(name?: string | null): string {
  const raw = String(name || '').trim();
  if (!raw) return '';

  // Already Windows display format
  if (/^\(UTC[+-]?\d{0,2}/i.test(raw) || /^\(UTC\)/i.test(raw)) {
    return raw.replace(/^\(UTC\)/, '(UTC+00:00)');
  }

  const meta = lookupMeta(raw);
  if (meta) {
    return `(UTC${normalizeOffset(meta.offset)}) ${meta.cities}`;
  }

  // "UTC+05:30" / "UTC-11" style ids
  const utcId = raw.match(/^UTC([+-]?\d{1,2}(?::\d{2})?)$/i);
  if (utcId) {
    const off = normalizeOffset(utcId[1] || '+00:00');
    return `(UTC${off}) Coordinated Universal Time${off === '+00:00' ? '' : off}`;
  }

  if (/^UTC$/i.test(raw)) {
    return '(UTC+00:00) Coordinated Universal Time';
  }

  return raw;
}

export type TimeZoneOptionLike = {
  crmTimeZoneName?: string;
  crmTimeZoneNo?: string | number;
  timeZoneName?: string;
  TimeZoneName?: string;
  timeZoneNo?: string | number;
  TimeZoneNo?: string | number;
  name?: string;
  Name?: string;
  displayName?: string;
  DisplayName?: string;
  standardName?: string;
  utcOffset?: string | number;
  bias?: string | number;
  id?: string | number;
  [key: string]: unknown;
};

function pickName(tz: TimeZoneOptionLike): string {
  return String(
    tz.crmTimeZoneName ||
      tz.timeZoneName ||
      tz.TimeZoneName ||
      tz.standardName ||
      tz.displayName ||
      tz.DisplayName ||
      tz.name ||
      tz.Name ||
      ''
  ).trim();
}

function pickValue(tz: TimeZoneOptionLike): string {
  const v = tz.crmTimeZoneNo ?? tz.timeZoneNo ?? tz.TimeZoneNo ?? tz.id;
  return v === undefined || v === null ? '' : String(v);
}

/**
 * Single display helper for any timezone string/object anywhere in the app.
 * Always returns Windows-style "(UTC±HH:mm) Cities" when resolvable.
 */
export function formatTimeZoneDisplay(
  input?: string | TimeZoneOptionLike | null
): string {
  if (input == null || input === '') return '';
  if (typeof input === 'string') return formatWindowsTimeZoneLabel(input);
  const name = pickName(input);
  return formatWindowsTimeZoneLabel(name) || name;
}

function resolveOffsetMinutes(tz: TimeZoneOptionLike, label: string): number {
  if (tz.utcOffset != null && tz.utcOffset !== '') {
    const n = Number(tz.utcOffset);
    if (Number.isFinite(n) && Math.abs(n) <= 16) return Math.round(n * 60);
    if (Number.isFinite(n) && Math.abs(n) <= 24 * 60) return Math.round(n);
    return utcOffsetToMinutes(String(tz.utcOffset));
  }
  if (tz.bias != null && tz.bias !== '') {
    const bias = Number(tz.bias);
    // Windows bias = minutes to add to local to get UTC → invert for UTC offset
    if (Number.isFinite(bias)) return -Math.round(bias);
  }
  const meta = lookupMeta(pickName(tz));
  if (meta) return utcOffsetToMinutes(meta.offset);
  const fromLabel = label.match(/\(UTC([+-]\d{2}:\d{2}|[+-]\d{1,2}|)\)/i);
  if (fromLabel) return utcOffsetToMinutes(fromLabel[1] || '+00:00');
  return Number.POSITIVE_INFINITY; // unknown → end
}

/** Build Combobox options: Windows label, sorted by UTC offset then city name. */
export function buildTimeZoneComboboxOptions(
  timeZones: TimeZoneOptionLike[] | null | undefined
): { label: string; value: string }[] {
  const rows = (timeZones || []).map((tz) => {
    const name = pickName(tz);
    const label = formatTimeZoneDisplay(tz) || formatWindowsTimeZoneLabel(name);
    const value = pickValue(tz);
    return {
      label: label || name || value,
      value,
      offsetMins: resolveOffsetMinutes(tz, label || name),
    };
  });

  rows.sort((a, b) => {
    if (a.offsetMins !== b.offsetMins) return a.offsetMins - b.offsetMins;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true });
  });

  return rows.map(({ label, value }) => ({ label, value }));
}

