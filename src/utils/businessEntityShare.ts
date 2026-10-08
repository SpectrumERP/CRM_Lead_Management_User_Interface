/**
 * Share a business entity contact or attachment: WhatsApp (wa.me), email (mailto:) or the device
 * share sheet. Attachments are shared as files where the browser allows it, else downloaded so the
 * user can attach them. Returns a note for the caller to show, or null when nothing needs saying.
 */
import { fetchAttachmentBlob } from '../api/attachments'

export interface ShareContactInfo {
  companyName?: string
  companyCode?: string
  name?: string
  designation?: string
  department?: string
  phone?: string
  email?: string
}

export interface ShareNote {
  type: 'info' | 'error'
  title: string
  message?: string
}

const TITLE = 'Business Entity Contact'

function clean(value?: string | null): string {
  const v = String(value ?? '').trim()
  return !v || v === 'N/A' || v === '-' || v === '—' ? '' : v
}

/** wa.me wants the number with country code and no `+`. */
export function whatsAppNumber(phone?: string): string {
  return clean(phone).replace(/[^\d+]/g, '').replace(/^\+/, '')
}

export function formatContactShareText(info: ShareContactInfo): string {
  const company = clean(info.companyName)
  const code = clean(info.companyCode)
  const lines = [TITLE]
  if (company) lines.push(`Company: ${company}${code ? ` (${code})` : ''}`)
  const fields: [string, string | undefined][] = [
    ['Name', info.name],
    ['Designation', info.designation],
    ['Department', info.department],
    ['Phone', info.phone],
    ['Email', info.email],
  ]
  for (const [label, value] of fields) if (clean(value)) lines.push(`${label}: ${clean(value)}`)
  return lines.join('\n')
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

const NOTHING: ShareNote = { type: 'info', title: 'Nothing to share', message: 'Add contact details first.' }

export function shareContactViaWhatsApp(info: ShareContactInfo): ShareNote | null {
  const text = formatContactShareText(info)
  if (text === TITLE) return NOTHING
  const phone = whatsAppNumber(info.phone)
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  return null
}

export function shareContactViaEmail(info: ShareContactInfo): ShareNote | null {
  const text = formatContactShareText(info)
  if (text === TITLE) return NOTHING
  const name = clean(info.name) || 'Contact'
  const company = clean(info.companyName)
  const subject = company ? `${name} — ${company}` : name
  const qs = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
  // The address goes in as typed (mail apps do not all decode %40); only URL-breaking characters are dropped.
  window.location.href = `mailto:${clean(info.email).replace(/[?&#\s]/g, '')}?${qs}`
  return null
}

export async function shareContactNative(info: ShareContactInfo): Promise<ShareNote | null> {
  if (!canNativeShare()) return shareContactViaWhatsApp(info)
  try {
    await navigator.share({ title: clean(info.name) || TITLE, text: formatContactShareText(info) })
    return null
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return null
    return { type: 'error', title: 'Share failed', message: 'Could not open the share sheet.' }
  }
}

export interface ShareAttachmentInfo {
  docNo: number
  fileName: string
  companyName?: string
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function attachmentFile(info: ShareAttachmentInfo): Promise<File> {
  const name = clean(info.fileName) || 'attachment'
  const blob = await fetchAttachmentBlob(info.docNo, name)
  return new File([blob], name, { type: blob.type })
}

/** Share the file itself where the browser can; else download it so it can be attached. */
async function shareAttachment(
  info: ShareAttachmentInfo,
  channel: 'whatsapp' | 'email',
): Promise<ShareNote | null> {
  const company = clean(info.companyName)
  const fileName = clean(info.fileName) || 'attachment'
  const caption = [company ? `Business Entity: ${company}` : 'Business Entity attachment', `File: ${fileName}`].join('\n')
  try {
    const file = await attachmentFile(info)
    if (canNativeShare() && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: fileName, text: caption, files: [file] })
      return null
    }
    download(file)
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank', 'noopener,noreferrer')
      return { type: 'info', title: 'File downloaded', message: 'Attach the downloaded file in WhatsApp.' }
    }
    const subject = company ? `${company} — ${fileName}` : fileName
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(caption)}`
    return { type: 'info', title: 'File downloaded', message: 'Attach the downloaded file to your email.' }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return null
    return { type: 'error', title: 'Share failed', message: 'Could not prepare the attachment.' }
  }
}

export function shareAttachmentViaWhatsApp(info: ShareAttachmentInfo) {
  return shareAttachment(info, 'whatsapp')
}

export function shareAttachmentViaEmail(info: ShareAttachmentInfo) {
  return shareAttachment(info, 'email')
}
