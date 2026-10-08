/**
 * Business card reading (Task Management's scanner):
 *
 *   POST /api/utility/google-vision/images/annotate
 *
 * The server forwards a Gemini-style `generateContent` request (image + instruction + JSON schema)
 * and returns its raw response; the card fields are the JSON text in `candidates[0].content.parts[0].text`.
 * When that is unavailable the image is read on the device (Tesseract) and the text is parsed here.
 */
import { spectrumEndpoints } from './endpoints'
import { fail } from './errors'
import { http } from './http'

export interface BusinessCardData {
  name?: string
  designation?: string
  company?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
}

const INSTRUCTION =
  'Extract all contact and address details from this business card. If the address mentions abbreviations or codes for ' +
  'country, state/province, or city (e.g., "USA" -> "United States", "CA" -> "California", "TX" -> "Texas"), expand them ' +
  'to their full official names in the corresponding fields.'

const str = (description: string) => ({ type: 'STRING', description })

export function visionRequest(base64Jpeg: string) {
  return {
    contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } }, { text: INSTRUCTION }] }],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: {
        type: 'OBJECT',
        properties: {
          full_name: str('Full name of the person'),
          job_title: str('Job title or designation'),
          company_name: str('Company or organization name'),
          email: str('Email address'),
          phone_numbers: { type: 'ARRAY', items: { type: 'STRING' }, description: 'List of phone numbers' },
          website: str('Website URL'),
          address: str('Full raw physical address as printed'),
          city: str('Full name of the city (expand abbreviations if any)'),
          state: str('Full name of the state or province (e.g., expand CA to California, MH to Maharashtra)'),
          country: str('Full name of the country (e.g., expand US/USA to United States, IN to India, UK to United Kingdom)'),
          postal_code: str('ZIP or postal code'),
          social_links: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Social media profiles or links' },
        },
        required: ['full_name'],
      },
      temperature: 0.1,
    },
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  // In chunks: spreading a large image into one call overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

interface VisionResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  error?: { message?: string } | string | null
}

/** The card's JSON text from the server, or '' when it read nothing. */
export async function readCardWithVision(image: Blob, signal?: AbortSignal): Promise<string> {
  const response = await http.post<VisionResponse>(spectrumEndpoints.utility.visionAnnotate, visionRequest(await blobToBase64(image)), { signal })
  if (response?.error) {
    const message = typeof response.error === 'string' ? response.error : response.error.message
    fail('SERVER', message || 'The card reader is unavailable.')
  }
  return response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

function asText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ')
  return ''
}

/** Card fields from the server's JSON text (fenced or bare). Unreadable → empty. */
export function parseVisionCard(jsonText: string): BusinessCardData {
  try {
    const cleaned = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const phone = Array.isArray(parsed.phone_numbers) ? parsed.phone_numbers[0] : parsed.phone_numbers
    return {
      name: asText(parsed.full_name),
      designation: asText(parsed.job_title),
      company: asText(parsed.company_name),
      email: asText(parsed.email),
      phone: asText(phone),
      website: asText(parsed.website),
      address: asText(parsed.address),
      city: asText(parsed.city),
      state: asText(parsed.state),
      country: asText(parsed.country),
      zipCode: asText(parsed.postal_code),
    }
  } catch {
    return {}
  }
}

const ADDRESS_WORDS = /road|street|st|avenue|ave|floor|fl|room|rm|building|bldg/i
const NOT_A_NAME = /road|street|st|avenue|ave|floor|fl|room|rm|building|bldg|park|center|inc|ltd|limited|corp|corporation|company|co\.|pvt|private|services|solutions|technologies|tech|motors|bank|group/i
const DESIGNATION = /manager|director|engineer|developer|officer|president|ceo|cto|coo|cfo|executive|head|lead|supervisor|consultant|associate/i

function cleanGarbage(text: string) {
  return text
    .replace(/[|()[\]{}_\-\\]/g, ' ')
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const isLabel = (text: string) => /^(email|e-mail|tel|telephone|phone|mobile|mob|cell|website|web|url)$/i.test(text.replace(/[^a-zA-Z]/g, ''))
const stripBrackets = (text: string) => text.replace(/[|()[\]{}_\-\\]/g, '').trim()

/** Card fields from raw OCR text, by pattern (email, phone, website) and line heuristics. */
export function parseCardText(rawText: string): BusinessCardData {
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 1 && /[A-Za-z]/.test(l))
  const data: BusinessCardData = {}
  const emailRegex = /([a-zA-Z0-9._,-]+\s*(?:@|at|\[at\])\s*[a-zA-Z0-9._,-]+\s*\.\s*[a-zA-Z0-9_-]+)/i
  const phoneRegex = /(?:\+?\d[\d\s\-().]{7,20})/
  const websiteRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i
  const remaining: string[] = []
  let emailDomain = ''

  for (let line of lines) {
    if (line.replace(/[^A-Za-z]/g, '').length < 2) continue
    // OCR often reads letters as extra "@": keep only the last one.
    if ((line.match(/@/g) ?? []).length > 1) line = line.replace(/@/g, (_m, offset: number, s: string) => (offset === s.lastIndexOf('@') ? '@' : 'a'))

    if (!data.email) {
      const match = line.match(emailRegex)?.[1]
      if (match) {
        let email = match.replace(/\b(?:at)\b|\[at\]/gi, '@').replace(/\s+/g, '').replace(/,/g, '.')
        email = email.replace(/@/g, (_m, offset: number, s: string) => (offset === s.indexOf('@') ? '@' : 'a'))
        data.email = email
        emailDomain = email.split('@')[1]?.split('.')[0]?.toLowerCase() ?? ''
        line = line.replace(emailRegex, '')
      }
    }
    if (!data.phone) {
      const match = line.match(phoneRegex)
      if (match && match[0].replace(/[\s\-().]/g, '').length >= 8) {
        // Keep the "+" of a country code (the clean-up would drop it).
        data.phone = `${match[0].trim().startsWith('+') ? '+' : ''}${cleanGarbage(match[0])}`
        line = line.replace(phoneRegex, '')
      }
    }
    if (!data.website && !line.includes('@')) {
      const match = line.match(websiteRegex)?.[0]
      if (match && (!data.email || !data.email.includes(match))) {
        data.website = cleanGarbage(match)
        line = line.replace(websiteRegex, '')
      }
    }

    line = cleanGarbage(line)
    if (line.replace(/[^A-Za-z0-9]/g, '').length > 2 && !isLabel(line)) {
      // Keep lines with a real word, or a long number (PIN code / part of an address).
      const hasWord = line.split(/\s+/).some((w) => w.replace(/[^a-zA-Z]/g, '').length >= 3)
      if (hasWord || /\d{3,}/.test(line)) remaining.push(line)
    }
  }

  // Name: 2–4 words, no digits, not an address or company line.
  const nameIndex = remaining.findIndex((line) => {
    const words = line.split(/\s+/).length
    return !NOT_A_NAME.test(line) && !/\d/.test(line) && words >= 2 && words <= 4
  })
  if (nameIndex !== -1) data.name = remaining.splice(nameIndex, 1)[0]

  const designationIndex = remaining.findIndex((line) => DESIGNATION.test(line))
  if (designationIndex !== -1) data.designation = cleanGarbage(remaining.splice(designationIndex, 1)[0])

  // Company: the line containing the email's domain, else a short non-address line.
  let companyIndex = emailDomain ? remaining.findIndex((l) => l.toLowerCase().replace(/\s/g, '').includes(emailDomain)) : -1
  if (companyIndex === -1) companyIndex = remaining.findIndex((l) => l.length < 30 && !ADDRESS_WORDS.test(l))
  if (companyIndex !== -1) data.company = stripBrackets(remaining.splice(companyIndex, 1)[0])

  if (remaining.length) data.address = remaining.map(stripBrackets).join(', ')
  return data
}
