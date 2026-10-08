/**
 * Spectrum document store (same flow as the Task Management app).
 *
 * Upload, per file, as soon as it is picked:
 *   1. POST /api/document-attachments          [{ fileName, companyNo, formNo }] → entry id (docNo)
 *   2. PUT  /api/document-attachments          multipart: id + file
 *   3. GET  /api/document-attachments/status   ?DocNo=
 * The parent record's save then links the files: `attachment: [{ docNo }]`.
 *
 * Also: list (?transactionId=&formNo=), {docNo}/download, rename, delete.
 */
import { spectrumEndpoints } from './endpoints'
import { fail } from './errors'
import { assertSuccess, type SpectrumResponse } from './fillValues'
import { http } from './http'
import { withQuery } from './query'
import { isInlineViewableUpload, mimeFromFileName, validateUploadFile } from './uploadFiles'

function formNoFromEnv(raw: string | undefined, fallback: number): number {
  const no = Number(raw)
  return Number.isInteger(no) && no > 0 ? no : fallback
}

/**
 * Spectrum form numbers the store files attachments under: Lead 377, Opportunity 380, Business Entity 1550
 * (shared with Task Management, which also uses Task 1547). VITE_LEAD_FORM_NO / VITE_OPPORTUNITY_FORM_NO /
 * VITE_BUSINESS_ENTITY_FORM_NO override.
 */
export const ATTACHMENT_FORM_NO = {
  lead: formNoFromEnv(import.meta.env.VITE_LEAD_FORM_NO, 377),
  opportunity: formNoFromEnv(import.meta.env.VITE_OPPORTUNITY_FORM_NO, 380),
  businessEntity: formNoFromEnv(import.meta.env.VITE_BUSINESS_ENTITY_FORM_NO, 1550),
} as const

/** An uploaded file, as the forms keep it. `id` is the store's docNo. */
export interface Attachment {
  id: number
  name: string
  size?: number
  type?: string
}

/** Link rows for a parent save body. */
export function attachmentLinks(items: readonly Attachment[]): { docNo: number }[] {
  return items.filter((a) => a.id > 0).map((a) => ({ docNo: a.id }))
}

interface EntryRow {
  id: number
  name?: string | null
  storedFileName?: string | null
  storedFilePath?: string | null
  relativePath?: string | null
}

interface ListRow {
  docNo: number
  docName?: string | null
  docType?: string | null
  docSize?: number | null
}

/** Step 1: register the file; returns its docNo. */
export async function createAttachmentEntry(fileName: string, companyNo: number, formNo: number): Promise<number> {
  const response = await http.post<SpectrumResponse<EntryRow[] | null>>(spectrumEndpoints.attachments.root, [
    { fileName, companyNo, formNo },
  ])
  assertSuccess(response)
  const id = Number(response.data?.[0]?.id)
  if (!id) fail('VALIDATION', 'The server did not return an attachment number.')
  return id
}

/** Step 2: send the bytes for that entry. */
export async function uploadAttachmentFile(id: number, file: File): Promise<void> {
  const check = validateUploadFile(file)
  if (!check.ok) fail('VALIDATION', check.reason)
  const form = new FormData()
  // Both shapes, as the backend model binder accepts either.
  form.append('id', String(id))
  form.append('file', file)
  form.append('Attachment[0].id', String(id))
  form.append('Attachment[0].file', file)
  const response = await http.put<SpectrumResponse<boolean>>(spectrumEndpoints.attachments.root, form)
  assertSuccess(response)
  if (response.data === false) fail('VALIDATION', 'The server did not accept the file.')
}

/** Step 3: confirm the store has it. */
export async function checkAttachmentStatus(id: number): Promise<void> {
  const response = await http.get<SpectrumResponse<unknown>>(withQuery(spectrumEndpoints.attachments.status, { DocNo: id }))
  if (!response?.success) fail('VALIDATION', 'Upload status could not be verified by the server.')
}

/** All three steps. */
export async function uploadAttachment(file: File, companyNo: number, formNo: number): Promise<Attachment> {
  const id = await createAttachmentEntry(file.name, companyNo, formNo)
  await uploadAttachmentFile(id, file)
  await checkAttachmentStatus(id)
  return { id, name: file.name, size: file.size, type: file.type || undefined }
}

/** Files already linked to a saved record (leadNo / opportunityNo). */
export async function listAttachments(transactionId: number, formNo: number): Promise<Attachment[]> {
  const response = await http.get<SpectrumResponse<ListRow[] | null>>(
    withQuery(spectrumEndpoints.attachments.root, { transactionId, formNo }),
  )
  assertSuccess(response)
  return (response.data ?? [])
    .filter((row) => row && row.docNo)
    .map((row) => ({
      id: row.docNo,
      name: row.docName || 'attachment',
      size: row.docSize ?? undefined,
      type: row.docType ?? undefined,
    }))
}

export async function renameAttachment(docNo: number, docName: string, formNo: number): Promise<void> {
  const response = await http.put<SpectrumResponse<boolean>>(spectrumEndpoints.attachments.rename, { docNo, docName, formNo })
  assertSuccess(response)
}

export async function deleteAttachment(docNo: number): Promise<void> {
  const response = await http.delete<SpectrumResponse<boolean>>(withQuery(spectrumEndpoints.attachments.delete, { docNo }))
  assertSuccess(response)
}

interface ImageRow {
  docNo?: number
  id?: number
  imageBase64?: string | null
  base64?: string | null
  contentType?: string | null
  mimeType?: string | null
}

/** Image thumbnails as data URLs, by docNo. Files the server has no image for are left out. */
export async function fetchAttachmentImages(docNos: readonly number[], signal?: AbortSignal): Promise<Map<number, string>> {
  const images = new Map<number, string>()
  const ids = docNos.filter((no) => Number.isInteger(no) && no > 0)
  if (!ids.length) return images
  const response = await http.post<SpectrumResponse<ImageRow[] | null>>(spectrumEndpoints.attachments.images, ids, { signal })
  assertSuccess(response)
  for (const row of response.data ?? []) {
    const docNo = Number(row.docNo ?? row.id)
    const base64 = row.imageBase64 ?? row.base64
    if (!docNo || !base64) continue
    images.set(docNo, base64.startsWith('data:') ? base64 : `data:${row.contentType || row.mimeType || 'image/jpeg'};base64,${base64}`)
  }
  return images
}

/** The file with the auth header, typed from its name so PDFs / images render inline. */
export async function fetchAttachmentBlob(docNo: number, name: string): Promise<Blob> {
  const raw = await http.getBlob(spectrumEndpoints.attachments.download(docNo))
  const mime = mimeFromFileName(name)
  return mime ? new Blob([raw], { type: mime }) : raw
}

function loadingPage(name: string) {
  const safe = name.replace(/[<>&"]/g, '')
  return `<!doctype html><title>Loading ${safe}…</title>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;color:#64748b;background:#f8fafc">
<p>Loading ${safe}…</p></body>`
}

/**
 * View (PDF / image → new tab) or download (other types). Call from the click handler: the tab is
 * opened synchronously so popup blockers allow it, then pointed at the blob once it arrives.
 */
export async function openAttachment(item: Pick<Attachment, 'id' | 'name'>): Promise<void> {
  const inline = isInlineViewableUpload(item.name)
  const tab = inline ? window.open('about:blank', '_blank') : null
  tab?.document.write(loadingPage(item.name))
  try {
    const blob = await fetchAttachmentBlob(item.id, item.name)
    const url = URL.createObjectURL(blob)
    if (tab) {
      tab.location.href = url
    } else {
      const link = document.createElement('a')
      link.href = url
      link.download = item.name
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    tab?.close()
    throw error
  }
}
