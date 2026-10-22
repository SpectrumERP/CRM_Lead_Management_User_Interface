/**
 * Read a business card image: the business-card scan API first, then the vision (annotate) API if
 * that fails or reads nothing; if they read nothing, Tesseract on the device (after OpenCV clean-up)
 * and the text parser. If both server readers fail, the error is shown and the user can retry or
 * read on the device.
 */
import { parseCardText, parseVisionCard, readCardWithVision, scanBusinessCard, type BusinessCardData } from '../../api/businessCard'
import { toApiError } from '../../api/errors'
import { loadOpenCv, preprocessForOcr } from './imaging'

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>

let worker: Promise<TesseractWorker> | null = null
let onProgress: ((progress: number) => void) | null = null

function tesseract(): Promise<TesseractWorker> {
  if (!worker) {
    worker = (async () => {
      const { createWorker, PSM } = await import('tesseract.js')
      const w = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') onProgress?.(m.progress)
        },
      })
      // Cards are sparse text, not paragraphs.
      await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
      return w
    })()
    worker.catch(() => { worker = null })
  }
  return worker
}

/** Stop the on-device reader (frees its memory when the scanner closes). */
export async function stopCardReader() {
  const pending = worker
  worker = null
  if (pending) await (await pending.catch(() => null))?.terminate()
}

export interface CardReading {
  data: BusinessCardData
  /** Which reader produced it. */
  source: 'server' | 'device'
  /** The reader's raw text (the server's JSON, or the OCR text) — kept for the clipboard. */
  text: string
}

/** The server's card reader failed; `message` is for the user. Reading on the device is still possible. */
export class CardReaderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CardReaderError'
  }
}

const hasAny = (data: BusinessCardData) => Object.values(data).some(Boolean)

/** The server readers in order: each returns the card fields and its raw text, or throws. */
const SERVER_READERS: { name: string; read: (image: Blob) => Promise<{ data: BusinessCardData; text: string }> }[] = [
  { name: 'business-card scan', read: scanBusinessCard },
  {
    name: 'vision annotate',
    read: async (image) => {
      const text = await readCardWithVision(image)
      return { data: text ? parseVisionCard(text) : {}, text }
    },
  },
]

/**
 * `onDevice`: skip the server (the user chose to after it failed). The server readers are tried in
 * turn; when every one fails, CardReaderError (the first failure's message) so it can be shown. When
 * one answers but reads nothing, the device reader takes over silently.
 */
export async function readCard(image: Blob, progress: (fraction: number) => void, { onDevice = false } = {}): Promise<CardReading> {
  progress(0.1)
  if (!onDevice) {
    const failures: string[] = []
    for (const reader of SERVER_READERS) {
      try {
        const { data, text } = await reader.read(image)
        if (hasAny(data)) return { data, source: 'server', text }
      } catch (err) {
        const message = toApiError(err).message
        failures.push(message)
        console.warn(`Business card: the ${reader.name} API failed — ${message}`)
      }
    }
    if (failures.length === SERVER_READERS.length) {
      throw new CardReaderError(failures[0] || 'The card reader is unavailable.')
    }
  }

  progress(0.15)
  const { cv } = await loadOpenCv()
  const cleaned = await preprocessForOcr(cv, image)
  onProgress = (p) => progress(0.15 + p * 0.8)
  try {
    const w = await tesseract()
    const { data } = await w.recognize(cleaned)
    return { data: parseCardText(data.text), source: 'device', text: data.text }
  } finally {
    onProgress = null
    progress(1)
  }
}
