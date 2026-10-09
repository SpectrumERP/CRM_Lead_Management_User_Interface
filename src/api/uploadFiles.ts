/**
 * Which files may be attached (same rules as the Task Management app, so both write the same store).
 * Extensions are always checked; the MIME type only when the browser reports one.
 */
/** Same limit as Task Management (one attachment API for both apps). */
export const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024
const MAX_UPLOAD_MB = MAX_UPLOAD_FILE_BYTES / (1024 * 1024)

export const ALLOWED_UPLOAD_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'tif', 'pdf', 'doc', 'docx', 'xlsx', 'csv', 'txt',
] as const

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
}

/** Browsers report some types loosely (CSV as Excel, etc.), so these are accepted too. */
const EXTRA_MIME_TYPES = ['application/vnd.ms-excel', 'application/csv', 'text/x-csv', 'image/x-tiff', 'image/pjpeg']

const ALLOWED_MIME_TYPES = new Set([...Object.values(MIME_BY_EXTENSION), ...EXTRA_MIME_TYPES])

export const UPLOAD_TYPES_LABEL = 'PNG, JPG, JPEG, WebP, AVIF, TIFF, PDF, DOC, DOCX, XLSX, CSV, TXT'
export const UPLOAD_HELP_TEXT = `${UPLOAD_TYPES_LABEL} · Max ${MAX_UPLOAD_MB}MB each`

/** `accept` attribute for the file input. */
export const UPLOAD_ACCEPT_ATTR = [
  ...ALLOWED_UPLOAD_EXTENSIONS.map((ext) => `.${ext}`),
  ...Object.values(MIME_BY_EXTENSION),
].filter((v, i, all) => all.indexOf(v) === i).join(',')

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function isImageFileName(name: string): boolean {
  return ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'tif'].includes(getFileExtension(name))
}

/** PDFs and images open in a tab; everything else downloads. */
export function isInlineViewableUpload(name: string): boolean {
  return getFileExtension(name) === 'pdf' || isImageFileName(name)
}

export function mimeFromFileName(name: string): string | undefined {
  return MIME_BY_EXTENSION[getFileExtension(name)]
}

export type UploadValidation = { ok: true } | { ok: false; reason: string }

export function validateUploadFile(file: File | null | undefined): UploadValidation {
  if (!file || !file.name) return { ok: false, reason: 'Invalid file.' }
  if (file.size > MAX_UPLOAD_FILE_BYTES) return { ok: false, reason: `File size exceeds the ${MAX_UPLOAD_MB}MB limit.` }
  const ext = getFileExtension(file.name)
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, reason: `Unsupported file type. Allowed: ${UPLOAD_TYPES_LABEL}.` }
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, reason: `Unsupported file content type (${file.type}). Allowed: ${UPLOAD_TYPES_LABEL}.` }
  }
  return { ok: true }
}

export function formatUploadSize(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
