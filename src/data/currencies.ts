import { matchesAny } from '../utils/text'

export interface Currency {
  code: string
  symbol: string
  name: string
  countries: string[]
}

/** ISO 4217 national currencies with symbol + countries (for search). */
const ROWS: readonly [code: string, symbol: string, name: string, countries: string][] = [
  ['AED', 'د.إ', 'UAE Dirham', 'United Arab Emirates'],
  ['AFN', '؋', 'Afghan Afghani', 'Afghanistan'],
  ['ALL', 'L', 'Albanian Lek', 'Albania'],
  ['AMD', '֏', 'Armenian Dram', 'Armenia'],
  ['AOA', 'Kz', 'Angolan Kwanza', 'Angola'],
  ['ARS', '$', 'Argentine Peso', 'Argentina'],
  ['AUD', 'A$', 'Australian Dollar', 'Australia, Kiribati, Nauru, Tuvalu'],
  ['AWG', 'ƒ', 'Aruban Florin', 'Aruba'],
  ['AZN', '₼', 'Azerbaijani Manat', 'Azerbaijan'],
  ['BAM', 'KM', 'Bosnia-Herzegovina Convertible Mark', 'Bosnia and Herzegovina'],
  ['BBD', 'Bds$', 'Barbadian Dollar', 'Barbados'],
  ['BDT', '৳', 'Bangladeshi Taka', 'Bangladesh'],
  ['BGN', 'лв', 'Bulgarian Lev', 'Bulgaria'],
  ['BHD', 'د.ب.', 'Bahraini Dinar', 'Bahrain'],
  ['BIF', 'FBu', 'Burundian Franc', 'Burundi'],
  ['BMD', '$', 'Bermudian Dollar', 'Bermuda'],
  ['BND', 'B$', 'Brunei Dollar', 'Brunei'],
  ['BOB', 'Bs', 'Bolivian Boliviano', 'Bolivia'],
  ['BRL', 'R$', 'Brazilian Real', 'Brazil'],
  ['BSD', 'B$', 'Bahamian Dollar', 'Bahamas'],
  ['BTN', 'Nu', 'Bhutanese Ngultrum', 'Bhutan'],
  ['BWP', 'P', 'Botswana Pula', 'Botswana'],
  ['BYN', 'Br', 'Belarusian Ruble', 'Belarus'],
  ['BZD', 'BZ$', 'Belize Dollar', 'Belize'],
  ['CAD', 'C$', 'Canadian Dollar', 'Canada'],
  ['CDF', 'FC', 'Congolese Franc', 'Democratic Republic of the Congo'],
  ['CHF', 'CHF', 'Swiss Franc', 'Switzerland, Liechtenstein'],
  ['CLP', '$', 'Chilean Peso', 'Chile'],
  ['CNY', '¥', 'Chinese Yuan', 'China'],
  ['COP', '$', 'Colombian Peso', 'Colombia'],
  ['CRC', '₡', 'Costa Rican Colón', 'Costa Rica'],
  ['CUP', '$', 'Cuban Peso', 'Cuba'],
  ['CVE', '$', 'Cape Verdean Escudo', 'Cabo Verde'],
  ['CZK', 'Kč', 'Czech Koruna', 'Czechia'],
  ['DJF', 'Fdj', 'Djiboutian Franc', 'Djibouti'],
  ['DKK', 'kr', 'Danish Krone', 'Denmark, Faroe Islands, Greenland'],
  ['DOP', 'RD$', 'Dominican Peso', 'Dominican Republic'],
  ['DZD', 'د.ج', 'Algerian Dinar', 'Algeria'],
  ['EGP', 'E£', 'Egyptian Pound', 'Egypt'],
  ['ERN', 'Nfk', 'Eritrean Nakfa', 'Eritrea'],
  ['ETB', 'Br', 'Ethiopian Birr', 'Ethiopia'],
  ['EUR', '€', 'Euro', 'Austria, Belgium, Croatia, Cyprus, Estonia, Finland, France, Germany, Greece, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Portugal, Slovakia, Slovenia, Spain, Andorra, Monaco, Montenegro, Kosovo, Vatican City'],
  ['FJD', 'FJ$', 'Fijian Dollar', 'Fiji'],
  ['GBP', '£', 'British Pound', 'United Kingdom'],
  ['GEL', '₾', 'Georgian Lari', 'Georgia'],
  ['GHS', '₵', 'Ghanaian Cedi', 'Ghana'],
  ['GIP', '£', 'Gibraltar Pound', 'Gibraltar'],
  ['GMD', 'D', 'Gambian Dalasi', 'Gambia'],
  ['GNF', 'FG', 'Guinean Franc', 'Guinea'],
  ['GTQ', 'Q', 'Guatemalan Quetzal', 'Guatemala'],
  ['GYD', '$', 'Guyanese Dollar', 'Guyana'],
  ['HKD', 'HK$', 'Hong Kong Dollar', 'Hong Kong'],
  ['HNL', 'L', 'Honduran Lempira', 'Honduras'],
  ['HTG', 'G', 'Haitian Gourde', 'Haiti'],
  ['HUF', 'Ft', 'Hungarian Forint', 'Hungary'],
  ['IDR', 'Rp', 'Indonesian Rupiah', 'Indonesia'],
  ['ILS', '₪', 'Israeli New Shekel', 'Israel'],
  ['INR', '₹', 'Indian Rupee', 'India'],
  ['IQD', 'ع.د', 'Iraqi Dinar', 'Iraq'],
  ['IRR', '﷼', 'Iranian Rial', 'Iran'],
  ['ISK', 'kr', 'Icelandic Króna', 'Iceland'],
  ['JMD', 'J$', 'Jamaican Dollar', 'Jamaica'],
  ['JOD', 'د.ا', 'Jordanian Dinar', 'Jordan'],
  ['JPY', '¥', 'Japanese Yen', 'Japan'],
  ['KES', 'KSh', 'Kenyan Shilling', 'Kenya'],
  ['KGS', 'сом', 'Kyrgyzstani Som', 'Kyrgyzstan'],
  ['KHR', '៛', 'Cambodian Riel', 'Cambodia'],
  ['KMF', 'CF', 'Comorian Franc', 'Comoros'],
  ['KRW', '₩', 'South Korean Won', 'South Korea'],
  ['KWD', 'د.ك', 'Kuwaiti Dinar', 'Kuwait'],
  ['KYD', '$', 'Cayman Islands Dollar', 'Cayman Islands'],
  ['KZT', '₸', 'Kazakhstani Tenge', 'Kazakhstan'],
  ['LAK', '₭', 'Lao Kip', 'Laos'],
  ['LBP', 'ل.ل', 'Lebanese Pound', 'Lebanon'],
  ['LKR', 'Rs', 'Sri Lankan Rupee', 'Sri Lanka'],
  ['LRD', '$', 'Liberian Dollar', 'Liberia'],
  ['LSL', 'L', 'Lesotho Loti', 'Lesotho'],
  ['LYD', 'ل.د', 'Libyan Dinar', 'Libya'],
  ['MAD', 'د.م.', 'Moroccan Dirham', 'Morocco'],
  ['MDL', 'L', 'Moldovan Leu', 'Moldova'],
  ['MGA', 'Ar', 'Malagasy Ariary', 'Madagascar'],
  ['MKD', 'ден', 'Macedonian Denar', 'North Macedonia'],
  ['MMK', 'K', 'Myanmar Kyat', 'Myanmar'],
  ['MNT', '₮', 'Mongolian Tögrög', 'Mongolia'],
  ['MOP', 'MOP$', 'Macanese Pataca', 'Macau'],
  ['MRU', 'UM', 'Mauritanian Ouguiya', 'Mauritania'],
  ['MUR', '₨', 'Mauritian Rupee', 'Mauritius'],
  ['MVR', 'Rf', 'Maldivian Rufiyaa', 'Maldives'],
  ['MWK', 'MK', 'Malawian Kwacha', 'Malawi'],
  ['MXN', 'MX$', 'Mexican Peso', 'Mexico'],
  ['MYR', 'RM', 'Malaysian Ringgit', 'Malaysia'],
  ['MZN', 'MT', 'Mozambican Metical', 'Mozambique'],
  ['NAD', 'N$', 'Namibian Dollar', 'Namibia'],
  ['NGN', '₦', 'Nigerian Naira', 'Nigeria'],
  ['NIO', 'C$', 'Nicaraguan Córdoba', 'Nicaragua'],
  ['NOK', 'kr', 'Norwegian Krone', 'Norway'],
  ['NPR', 'रू', 'Nepalese Rupee', 'Nepal'],
  ['NZD', 'NZ$', 'New Zealand Dollar', 'New Zealand, Cook Islands, Niue, Pitcairn, Tokelau'],
  ['OMR', 'ر.ع.', 'Omani Rial', 'Oman'],
  ['PAB', 'B/.', 'Panamanian Balboa', 'Panama'],
  ['PEN', 'S/', 'Peruvian Sol', 'Peru'],
  ['PGK', 'K', 'Papua New Guinean Kina', 'Papua New Guinea'],
  ['PHP', '₱', 'Philippine Peso', 'Philippines'],
  ['PKR', '₨', 'Pakistani Rupee', 'Pakistan'],
  ['PLN', 'zł', 'Polish Zloty', 'Poland'],
  ['PYG', '₲', 'Paraguayan Guaraní', 'Paraguay'],
  ['QAR', 'ر.ق', 'Qatari Riyal', 'Qatar'],
  ['RON', 'lei', 'Romanian Leu', 'Romania'],
  ['RSD', 'дин', 'Serbian Dinar', 'Serbia'],
  ['RUB', '₽', 'Russian Ruble', 'Russia'],
  ['RWF', 'FRw', 'Rwandan Franc', 'Rwanda'],
  ['SAR', '﷼', 'Saudi Riyal', 'Saudi Arabia'],
  ['SBD', 'SI$', 'Solomon Islands Dollar', 'Solomon Islands'],
  ['SCR', '₨', 'Seychellois Rupee', 'Seychelles'],
  ['SDG', 'ج.س.', 'Sudanese Pound', 'Sudan'],
  ['SEK', 'kr', 'Swedish Krona', 'Sweden'],
  ['SGD', 'S$', 'Singapore Dollar', 'Singapore'],
  ['SLE', 'Le', 'Sierra Leonean Leone', 'Sierra Leone'],
  ['SOS', 'Sh', 'Somali Shilling', 'Somalia'],
  ['SRD', '$', 'Surinamese Dollar', 'Suriname'],
  ['SSP', '£', 'South Sudanese Pound', 'South Sudan'],
  ['STN', 'Db', 'São Tomé and Príncipe Dobra', 'Sao Tome and Principe'],
  ['SYP', '£', 'Syrian Pound', 'Syria'],
  ['SZL', 'L', 'Eswatini Lilangeni', 'Eswatini'],
  ['THB', '฿', 'Thai Baht', 'Thailand'],
  ['TJS', 'ЅМ', 'Tajikistani Somoni', 'Tajikistan'],
  ['TMT', 'm', 'Turkmenistani Manat', 'Turkmenistan'],
  ['TND', 'د.ت', 'Tunisian Dinar', 'Tunisia'],
  ['TOP', 'T$', 'Tongan Paʻanga', 'Tonga'],
  ['TRY', '₺', 'Turkish Lira', 'Turkey'],
  ['TTD', 'TT$', 'Trinidad and Tobago Dollar', 'Trinidad and Tobago'],
  ['TWD', 'NT$', 'New Taiwan Dollar', 'Taiwan'],
  ['TZS', 'TSh', 'Tanzanian Shilling', 'Tanzania'],
  ['UAH', '₴', 'Ukrainian Hryvnia', 'Ukraine'],
  ['UGX', 'USh', 'Ugandan Shilling', 'Uganda'],
  ['USD', '$', 'US Dollar', 'United States, Ecuador, El Salvador, Timor-Leste, Zimbabwe, Puerto Rico'],
  ['UYU', '$U', 'Uruguayan Peso', 'Uruguay'],
  ['UZS', "so'm", 'Uzbekistani Som', 'Uzbekistan'],
  ['VES', 'Bs', 'Venezuelan Bolívar', 'Venezuela'],
  ['VND', '₫', 'Vietnamese Dong', 'Vietnam'],
  ['VUV', 'VT', 'Vanuatu Vatu', 'Vanuatu'],
  ['WST', 'T', 'Samoan Tala', 'Samoa'],
  ['XAF', 'FCFA', 'Central African CFA Franc', 'Cameroon, Central African Republic, Chad, Republic of the Congo, Equatorial Guinea, Gabon'],
  ['XCD', 'EC$', 'East Caribbean Dollar', 'Antigua and Barbuda, Dominica, Grenada, Saint Kitts and Nevis, Saint Lucia, Saint Vincent and the Grenadines'],
  ['XOF', 'CFA', 'West African CFA Franc', 'Benin, Burkina Faso, Côte d’Ivoire, Guinea-Bissau, Mali, Niger, Senegal, Togo'],
  ['XPF', '₣', 'CFP Franc', 'French Polynesia, New Caledonia, Wallis and Futuna'],
  ['YER', '﷼', 'Yemeni Rial', 'Yemen'],
  ['ZAR', 'R', 'South African Rand', 'South Africa, Lesotho, Namibia'],
  ['ZMW', 'ZK', 'Zambian Kwacha', 'Zambia'],
  ['ZWG', 'ZiG', 'Zimbabwe Gold', 'Zimbabwe'],
]

export const CURRENCIES: Currency[] = (() => {
  const items = ROWS.map(([code, symbol, name, countries]) => ({
    code,
    symbol,
    name,
    countries: countries.split(', ').filter(Boolean),
  }))
  return [...items].sort((left, right) =>
    left.code.localeCompare(right.code, 'en', { sensitivity: 'base' }),
  )
})()

/**
 * Currencies shown in CRM forms — India + common trade partners that have a
 * distinct currency symbol (not letter-only codes like CHF / MYR).
 * Full ISO list stays in CURRENCIES for lookup / legacy values.
 */
const MAIN_CURRENCY_CODES = [
  'AED',
  'AUD',
  'BHD',
  'CAD',
  'CHF',
  'CNY',
  'EUR',
  'GBP',
  'HKD',
  'INR',
  'JPY',
  'KWD',
  'MYR',
  'NZD',
  'OMR',
  'QAR',
  'SAR',
  'SGD',
  'THB',
  'USD',
] as const

function findCurrencyLoose(code: string): Currency | undefined {
  return CURRENCIES.find((item) => item.code === code)
}

/** True when the symbol is a real glyph (₹, $, €…), not letters-only (R, CHF). */
export function hasDistinctCurrencySymbol(symbol: string | undefined): boolean {
  const text = symbol?.trim() ?? ''
  return Boolean(text) && !/^[A-Za-z.\s]+$/.test(text)
}

export const MAIN_CURRENCIES: Currency[] = MAIN_CURRENCY_CODES.map((code) => findCurrencyLoose(code)).filter(
  (item): item is Currency => item != null && hasDistinctCurrencySymbol(item.symbol),
)

/** Dropdown / validation list — main currencies with symbols, A–Z. Default selection is INR. */
export const LEAD_CURRENCIES: string[] = MAIN_CURRENCIES.map((item) => item.code)

export function findCurrency(code: string | undefined): Currency {
  return CURRENCIES.find((item) => item.code === code) ?? CURRENCIES.find((item) => item.code === 'INR')!
}

export function currencySymbol(code: string | undefined): string {
  return findCurrency(code).symbol
}

/**
 * Prefix for amount inputs. Skip letter-only and Arabic/RTL glyphs —
 * those collide with digits; the currency code in the dropdown is enough.
 */
export function currencyAmountPrefix(code: string | undefined): string | undefined {
  const symbol = currencySymbol(code).trim()
  if (!hasDistinctCurrencySymbol(symbol)) return undefined
  if (/[\u0600-\u06FF]/.test(symbol)) return undefined
  return symbol
}

/** Short label for compact selects: `₹ INR`. */
export function currencyOptionLabel(code: string): string {
  const item = findCurrency(code)
  return hasDistinctCurrencySymbol(item.symbol) ? `${item.symbol} ${item.code}` : item.code
}

export function currencyLabel(item: Currency): string {
  return `${item.code}  ${item.symbol}  ${item.name}`
}

export function matchesCurrency(item: Currency, query: string): boolean {
  return matchesAny([item.code, item.symbol, item.name, ...item.countries], query)
}
