/**
 * Image work for the business card scanner (OpenCV in the browser), ported from Task Management:
 * live card detection on camera frames, a steadiness check before auto-capture, OCR preprocessing,
 * and crops. OpenCV is ~10 MB, so only the lazily loaded scanner imports this file.
 */
import cvModule from '@techstark/opencv-js'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Detection {
  detected: boolean
  confidence: number
  rect?: Rect
}

type CV = typeof cvModule

let ready: Promise<{ cv: CV }> | null = null

/**
 * OpenCV once its WebAssembly runtime has started, wrapped in an object. The module is an
 * Emscripten "thenable" whose `then` resolves to itself: awaiting it or returning it from an async
 * function unwraps it forever and freezes the tab. So it is never awaited — readiness is polled
 * (as Task Management does) and the module is handed back inside `{ cv }`.
 */
export function loadOpenCv(): Promise<{ cv: CV }> {
  if (!ready) {
    ready = new Promise((resolve) => {
      const check = () => {
        if ((cvModule as { Mat?: unknown }).Mat) resolve({ cv: cvModule })
        else window.setTimeout(check, 100)
      }
      check()
    })
  }
  return ready
}

/**
 * The largest card-shaped block in a video frame (15–95 % of the frame, aspect 1.4–1.9 or its
 * inverse), in video pixels. Frames are scaled down to 400 px wide for speed.
 */
export function detectCard(cv: CV, video: HTMLVideoElement, canvas: HTMLCanvasElement): Detection {
  if (!video.videoWidth || !video.videoHeight) return { detected: false, confidence: 0 }
  const scale = video.videoWidth > 400 ? 400 / video.videoWidth : 1
  const width = Math.floor(video.videoWidth * scale)
  const height = Math.floor(video.videoHeight * scale)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { detected: false, confidence: 0 }
  ctx.drawImage(video, 0, 0, width, height)

  const src = new cv.Mat(height, width, cv.CV_8UC4)
  src.data.set(ctx.getImageData(0, 0, width, height).data)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const kernel = cv.Mat.ones(15, 15, cv.CV_8U)
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
    cv.Canny(blurred, edges, 75, 200)
    // Join text and card edges into one solid block.
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel)
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const total = width * height
    let best: Rect | undefined
    let bestArea = 0
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const r = cv.boundingRect(contour)
      contour.delete()
      const area = r.width * r.height
      const ratio = r.width / r.height
      const cardLike = (ratio >= 1.4 && ratio <= 1.9) || (ratio >= 0.5 && ratio <= 0.75)
      if (area > total * 0.15 && area < total * 0.95 && cardLike && area > bestArea) {
        bestArea = area
        best = { x: r.x, y: r.y, width: r.width, height: r.height }
      }
    }
    if (!best) return { detected: false, confidence: 0 }
    return {
      detected: true,
      confidence: bestArea / total,
      rect: { x: best.x / scale, y: best.y / scale, width: best.width / scale, height: best.height / scale },
    }
  } catch {
    return { detected: false, confidence: 0 }
  } finally {
    for (const mat of [src, gray, blurred, edges, hierarchy, kernel]) mat.delete()
    contours.delete()
  }
}

/** True once the detected card has stayed put (±20 px) for a second. */
export class Steadiness {
  private last: Rect | null = null
  private since = 0

  check(rect: Rect | undefined, now = performance.now()): boolean {
    if (!rect) {
      this.reset()
      return false
    }
    const close = (a: number, b: number) => Math.abs(a - b) < 20
    const last = this.last
    if (last && close(last.x, rect.x) && close(last.y, rect.y) && close(last.width, rect.width) && close(last.height, rect.height)) {
      return now - this.since >= 1000
    }
    this.last = rect
    this.since = now
    return false
  }

  reset() {
    this.last = null
    this.since = 0
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the image.'))
    img.src = src
  })
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), type, quality)
  })
}

/** Grayscale, denoise and adaptive threshold — clearer text for Tesseract. Falls back to the original. */
export async function preprocessForOcr(cv: CV, image: Blob): Promise<Blob> {
  const url = URL.createObjectURL(image)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return image
    ctx.drawImage(img, 0, 0)
    const src = cv.imread(canvas)
    const dst = new cv.Mat()
    try {
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0)
      cv.GaussianBlur(dst, dst, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT)
      cv.medianBlur(dst, dst, 3)
      cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10)
      cv.imshow(canvas, dst)
    } finally {
      src.delete()
      dst.delete()
    }
    return await canvasBlob(canvas, 'image/jpeg', 1)
  } catch {
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A region of an image as a new image file. */
export async function cropImage(source: string | HTMLVideoElement, rect: Rect | null, type = 'image/jpeg'): Promise<Blob> {
  const media = typeof source === 'string' ? await loadImage(source) : source
  const fullWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth
  const fullHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight
  const r = rect ?? { x: 0, y: 0, width: fullWidth, height: fullHeight }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(r.width))
  canvas.height = Math.max(1, Math.round(r.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not crop the image.')
  ctx.drawImage(media, r.x, r.y, r.width, r.height, 0, 0, canvas.width, canvas.height)
  return canvasBlob(canvas, type, 0.95)
}
