/**
 * Read a business card image: the server's card reader first; if it fails or reads nothing,
 * Tesseract on the device (after OpenCV clean-up) and the text parser.
 */
import { parseCardText, parseVisionCard, readCardWithVision, type BusinessCardData } from '../../api/businessCard'
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

export async function readCard(image: Blob, progress: (fraction: number) => void): Promise<CardReading> {
  progress(0.1)
  try {
    const text = await readCardWithVision(image)
    if (text) {
      const data = parseVisionCard(text)
      if (Object.values(data).some(Boolean)) return { data, source: 'server', text }
    }
  } catch {
    // Fall through to the on-device reader.
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
