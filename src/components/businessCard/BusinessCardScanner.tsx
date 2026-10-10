import { useCallback, useEffect, useRef, useState } from 'react'
import ReactCrop, { type Crop, type PercentCrop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { uploadAttachment, type Attachment } from '../../api/attachments'
import type { BusinessCardData } from '../../api/businessCard'
import { toApiError } from '../../api/errors'
import { Button, FormGrid, Spinner } from '../../ui'
import FormDrawer from '../FormDrawer'
import { ICON, Icon } from '../../pages/businessEntities/ui'
import { cropImage, defaultLogoCrop, detectCard, detectLogo, loadOpenCv, Steadiness, type Detection, type Rect } from './imaging'
import { readCard, stopCardReader } from './readCard'
import ClipboardField from './ClipboardField'
import { addClipboardEntry } from './clipboardStore'

export interface ScanResult {
  /** Reviewed card details; null when the image was only uploaded. */
  data: BusinessCardData | null
  /** Card image and logo, uploaded to the document store. */
  attachments: Attachment[]
}

export interface BusinessCardScannerProps {
  /** Read this image instead of using the camera. */
  file?: File
  /** Upload `file` on confirm — false when it is already an attachment being re-read. */
  uploadFile?: boolean
  companyNo: number
  formNo: number
  onDone: (result: ScanResult) => void
  onClose: () => void
}

type Step = 'idle' | 'requesting' | 'denied' | 'live' | 'preview' | 'reading' | 'review' | 'logo' | 'uploading'

/** `paste` names the field on the clipboard's "Paste …" button. */
const FIELDS: { key: keyof BusinessCardData; label: string; paste: string; wide?: boolean }[] = [
  { key: 'name', label: 'Contact Person Name', paste: 'Name' },
  { key: 'designation', label: 'Designation', paste: 'Designation' },
  { key: 'company', label: 'Company', paste: 'Company', wide: true },
  { key: 'email', label: 'Email', paste: 'Email' },
  { key: 'phone', label: 'Phone', paste: 'Phone' },
  { key: 'website', label: 'Website', paste: 'Website', wide: true },
  { key: 'address', label: 'Address', paste: 'Address', wide: true },
  { key: 'city', label: 'City', paste: 'City' },
  { key: 'state', label: 'State', paste: 'State' },
  { key: 'country', label: 'Country', paste: 'Country' },
  { key: 'zipCode', label: 'PIN / ZIP Code', paste: 'PIN / ZIP Code' },
]

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

function percentOf(rect: Rect, width: number, height: number): PercentCrop {
  const x = Math.max(0, Math.min(100, (rect.x / width) * 100))
  const y = Math.max(0, Math.min(100, (rect.y / height) * 100))
  return {
    unit: '%',
    x,
    y,
    width: Math.max(0, Math.min(100 - x, (rect.width / width) * 100)),
    height: Math.max(0, Math.min(100 - y, (rect.height / height) * 100)),
  }
}

/** Crop in natural pixels of `img` from a percent crop. */
function pixelsOf(crop: PercentCrop | undefined, img: HTMLImageElement): Rect | null {
  if (!crop || !crop.width || !crop.height) return null
  return {
    x: (crop.x / 100) * img.naturalWidth,
    y: (crop.y / 100) * img.naturalHeight,
    width: (crop.width / 100) * img.naturalWidth,
    height: (crop.height / 100) * img.naturalHeight,
  }
}

/**
 * Business card scanner (Task Management's camera): live camera with automatic capture when a card
 * is held steady, crop, read (server, else on the device), review, optional logo, then upload.
 */
export default function BusinessCardScanner({ file, uploadFile = true, companyNo, formNo, onDone, onClose }: BusinessCardScannerProps) {
  const [step, setStep] = useState<Step>(file ? 'preview' : 'idle')
  const [error, setError] = useState('')
  const [cvReady, setCvReady] = useState(false)
  const [image, setImage] = useState<{ file: File; url: string } | null>(() => (file ? { file, url: URL.createObjectURL(file) } : null))
  const [crop, setCrop] = useState<Crop>()
  const [percentCrop, setPercentCrop] = useState<PercentCrop>()
  const [progress, setProgress] = useState(0)
  const [data, setData] = useState<BusinessCardData | null>(null)
  const [source, setSource] = useState<'server' | 'device' | null>(null)
  const [readImage, setReadImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [logo, setLogo] = useState<{ blob: Blob; url: string } | null>(null)
  const [logoCrop, setLogoCrop] = useState<Crop>()
  const [logoPixels, setLogoPixels] = useState<PixelCrop>()
  const [mirrored, setMirrored] = useState(false)
  const [detection, setDetection] = useState<Detection>({ detected: false, confidence: 0 })
  const [steady, setSteady] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const frameCanvas = useRef<HTMLCanvasElement>(null)
  const previewImg = useRef<HTMLImageElement>(null)
  const logoImg = useRef<HTMLImageElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const steadiness = useRef(new Steadiness())
  const readFor = useRef<File | null>(null)

  // Object URLs are released when replaced or on close.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])
  useEffect(() => () => { if (readImage) URL.revokeObjectURL(readImage.url) }, [readImage])
  useEffect(() => () => { if (logo) URL.revokeObjectURL(logo.url) }, [logo])

  useEffect(() => {
    let cancelled = false
    loadOpenCv().then(() => { if (!cancelled) setCvReady(true) }).catch(() => { if (!cancelled) setCvReady(false) })
    return () => { cancelled = true }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => () => {
    stopCamera()
    void stopCardReader()
  }, [stopCamera])

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser. Use "Choose image" instead.')
      return
    }
    setError('')
    setStep('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      setStep('live')
    } catch (err) {
      setError((err as Error)?.message || 'Camera permission was denied.')
      setStep('denied')
    }
  }

  // Attach the stream once the video element is on screen.
  useEffect(() => {
    if (step !== 'live' || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => undefined)
  }, [step])

  const read = useCallback(async (target: { file: File; url: string }, cropRect: Rect | null) => {
    setStep('reading')
    setError('')
    setProgress(0)
    try {
      const blob = cropRect ? await cropImage(target.url, cropRect) : target.file
      const reading = await readCard(blob, setProgress)
      // Every read goes to the clipboard, as in Task Management.
      addClipboardEntry({ source: 'BusinessCard', data: reading.data, formattedText: reading.text })
      const url = URL.createObjectURL(blob)
      setReadImage({ blob, url })
      setData(reading.data)
      setSource(reading.source)
      // The logo guess is the card's top-left corner (as in Task Management); it can be adjusted or removed.
      const guess = await defaultLogoCrop(url)
      setLogo(guess ? { blob: guess, url: URL.createObjectURL(guess) } : null)
      setStep('review')
    } catch (err) {
      setError(toApiError(err).message || 'The card could not be read. Adjust the crop and try again.')
      setStep('preview')
    }
  }, [])

  // A picked image is read straight away (no crop), as in Task Management.
  useEffect(() => {
    if (file && image && readFor.current !== file) {
      readFor.current = file
      void read(image, null)
    }
  }, [file, image, read])

  const capture = useCallback(async (found?: Detection) => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const blob = await cropImage(video, null)
    stopCamera()
    const captured = new File([blob], `business-card-${stamp()}.jpg`, { type: 'image/jpeg' })
    const next = { file: captured, url: URL.createObjectURL(captured) }
    setImage(next)
    if (found?.detected && found.rect) {
      const p = percentOf(found.rect, video.videoWidth, video.videoHeight)
      setCrop(p)
      setPercentCrop(p)
      setStep('preview')
      // A steadily held card is read at once.
      void read(next, { x: found.rect.x, y: found.rect.y, width: found.rect.width, height: found.rect.height })
    } else {
      const p: PercentCrop = { unit: '%', x: 10, y: 20, width: 80, height: 60 }
      setCrop(p)
      setPercentCrop(p)
      setStep('preview')
    }
  }, [read, stopCamera])

  // Live detection at ~10 frames a second; a card held steady for a second is captured.
  useEffect(() => {
    if (step !== 'live' || !cvReady) return
    let frame = 0
    let last = 0
    let stopped = false
    steadiness.current.reset()
    void loadOpenCv().then(({ cv }) => {
      const tick = (now: number) => {
        if (stopped) return
        if (now - last >= 100 && videoRef.current && frameCanvas.current) {
          last = now
          const result = detectCard(cv, videoRef.current, frameCanvas.current)
          setDetection(result)
          const isSteady = steadiness.current.check(result.detected ? result.rect : undefined, now)
          setSteady(isSteady)
          if (isSteady) {
            stopped = true
            void capture(result)
            return
          }
        }
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    })
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
    }
  }, [step, cvReady, capture])

  function retake() {
    setData(null)
    setLogo(null)
    setReadImage(null)
    setCrop(undefined)
    setPercentCrop(undefined)
    if (file) {
      setStep('preview')
    } else {
      setImage(null)
      void openCamera()
    }
  }

  function startLogo() {
    setStep('logo')
    setLogoCrop(undefined)
  }

  function onLogoImageLoad() {
    const img = logoImg.current
    if (!img) return
    void loadOpenCv().then(({ cv }) => {
      const found = detectLogo(cv, img)
      const p = found ? percentOf(found, img.naturalWidth, img.naturalHeight) : ({ unit: '%', x: 5, y: 5, width: 40, height: 30 } as PercentCrop)
      setLogoCrop(p)
      setLogoPixels({ unit: 'px', x: (p.x / 100) * img.width, y: (p.y / 100) * img.height, width: (p.width / 100) * img.width, height: (p.height / 100) * img.height })
    })
  }

  async function saveLogo() {
    const img = logoImg.current
    if (!img || !readImage || !logoPixels?.width || !logoPixels.height) return
    const sx = img.naturalWidth / img.width
    const sy = img.naturalHeight / img.height
    const blob = await cropImage(readImage.url, { x: logoPixels.x * sx, y: logoPixels.y * sy, width: logoPixels.width * sx, height: logoPixels.height * sy }, 'image/png')
    setLogo({ blob, url: URL.createObjectURL(blob) })
    setStep('review')
  }

  /** Upload the card (and logo), then hand back the details. */
  async function confirm(withData: boolean) {
    if (!image) return
    setStep('uploading')
    setError('')
    try {
      const uploaded: Attachment[] = []
      if (!file || uploadFile) {
        // A picked image goes up as picked; a camera shot as cropped.
        let card: File = image.file
        if (!file) {
          const rect = previewImg.current ? pixelsOf(percentCrop, previewImg.current) : null
          const blob = readImage?.blob ?? (rect ? await cropImage(image.url, rect) : image.file)
          card = new File([blob], `business-card-${stamp()}.jpg`, { type: 'image/jpeg' })
        }
        uploaded.push(await uploadAttachment(card, companyNo, formNo))
      }
      if (withData && logo) {
        uploaded.push(await uploadAttachment(new File([logo.blob], `logo-${stamp()}.png`, { type: 'image/png' }), companyNo, formNo))
      }
      onDone({ data: withData ? data : null, attachments: uploaded })
    } catch (err) {
      setError(toApiError(err).message)
      setStep(withData ? 'review' : 'preview')
    }
  }

  function close() {
    stopCamera()
    onClose()
  }

  const footer = (requestClose: () => void) => {
    if (step === 'idle' || step === 'denied') {
      return (
        <Button variant="solid" onClick={() => void openCamera()} disabled={!cvReady}>
          {!cvReady ? 'Loading Scanner…' : step === 'denied' ? 'Try Camera Again' : 'Open Camera'}
        </Button>
      )
    }
    if (step === 'requesting') return <Button variant="solid" disabled>Requesting permission…</Button>
    if (step === 'live') {
      return (
        <>
          <Button variant="secondary" onClick={() => { stopCamera(); requestClose() }}>Cancel</Button>
          <Button variant="solid" onClick={() => void capture(detection.detected ? detection : undefined)}>Capture Manually</Button>
        </>
      )
    }
    if (step === 'preview') {
      return (
        <>
          <Button variant="secondary" onClick={retake}>{file ? 'Reset Crop' : 'Retake'}</Button>
          {!file || uploadFile ? <Button variant="secondary" onClick={() => void confirm(false)}>Upload Image Only</Button> : null}
          <Button variant="solid" onClick={() => {
            if (image) void read(image, previewImg.current ? pixelsOf(percentCrop, previewImg.current) : null)
          }}>Read Details</Button>
        </>
      )
    }
    if (step === 'logo') {
      return (
        <>
          <Button variant="secondary" onClick={() => setStep('review')}>Cancel</Button>
          <Button variant="solid" onClick={() => void saveLogo()} disabled={!logoPixels?.width}>Save Logo</Button>
        </>
      )
    }
    if (step === 'review' || step === 'uploading') {
      return (
        <>
          {!file ? <Button variant="secondary" onClick={retake} disabled={step === 'uploading'}>Retake</Button> : null}
          <Button variant="solid" onClick={() => void confirm(true)} disabled={step === 'uploading'}>
            {step === 'uploading' ? 'Uploading…' : file && !uploadFile ? 'Use Details' : 'Confirm & Upload'}
          </Button>
        </>
      )
    }
    return null
  }

  const rect = detection.rect
  const video = videoRef.current

  return (
    <FormDrawer
      title={file ? 'Analyze Attachment' : 'Capture Attachment'}
      subtitle={file ? 'Review and extract data from the selected document.' : 'Take a photo and upload it as a Business Entity attachment.'}
      icon={<Icon d={ICON.camera} size={17} />}
      widthClass="w-[60rem]"
      // Opens over the attachments drawer when re-reading an attachment.
      zClass="z-[70]"
      onClose={close}
      footer={(requestClose) => footer(() => { stopCamera(); requestClose() })}
    >
      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-xs text-accent" role="alert">{error}</div> : null}

        {step === 'idle' || step === 'requesting' || step === 'denied' ? (
          <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface-muted p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-ink">{step === 'denied' ? 'Camera access blocked' : 'Camera access is required'}</p>
            <p className="max-w-sm text-xs text-ink-muted">
              {step === 'denied'
                ? 'Allow camera permission in your browser, then try again to scan a business card.'
                : 'Allow camera permission to scan a business card and attach the photo.'}
            </p>
            {step === 'requesting' ? <Spinner label="Requesting permission" /> : null}
          </div>
        ) : null}

        {step === 'live' ? (
          <div className="relative overflow-hidden rounded-xl bg-ink" style={{ aspectRatio: '16 / 9' }}>
            <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 h-full w-full object-contain ${mirrored ? '-scale-x-100' : ''}`} />
            {rect && video?.videoWidth ? (
              <div className={`pointer-events-none absolute inset-0 ${mirrored ? '-scale-x-100' : ''}`}>
                <div
                  className={`absolute border-4 transition-all duration-100 ${steady ? 'border-success' : 'border-warning'}`}
                  style={{
                    left: `${(rect.x / video.videoWidth) * 100}%`,
                    top: `${(rect.y / video.videoHeight) * 100}%`,
                    width: `${(rect.width / video.videoWidth) * 100}%`,
                    height: `${(rect.height / video.videoHeight) * 100}%`,
                  }}
                />
              </div>
            ) : null}
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-ink/80 px-3 py-1 text-xs font-semibold text-surface">
              {!cvReady ? 'Loading scanner…' : detection.detected ? (steady ? 'Card detected — capturing' : 'Hold the card steady') : 'Show a business card'}
            </div>
            <button type="button" onClick={() => setMirrored((m) => !m)}
              className="absolute right-3 top-3 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] font-semibold text-surface hover:bg-ink/80">
              Mirror
            </button>
          </div>
        ) : null}

        {(step === 'preview' || step === 'reading') && image ? (
          <div className="relative flex justify-center overflow-hidden rounded-xl bg-ink p-2">
            <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={(_, p) => setPercentCrop(p)} disabled={step === 'reading'}>
              <img ref={previewImg} src={image.url} alt="Business card" className="block max-h-[55vh] max-w-full object-contain" />
            </ReactCrop>
            {step === 'reading' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
                <div className="flex flex-col items-center gap-2 rounded-xl bg-ink/80 px-5 py-4 text-surface">
                  <Spinner label="Reading card" />
                  <span className="text-xs font-semibold">Reading card… {Math.round(progress * 100)}%</span>
                </div>
              </div>
            ) : (
              <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-ink/80 px-3 py-1 text-xs font-semibold text-surface">
                Crop to the card, then Read Details
              </div>
            )}
          </div>
        ) : null}

        {(step === 'review' || step === 'uploading') && data ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {readImage ? <img src={readImage.url} alt="Card read" className="max-h-72 w-full rounded-xl border border-line object-contain" /> : null}
              <div className="rounded-xl border border-line bg-surface-muted p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ink-muted">Logo</span>
                  <div className="flex gap-2">
                    <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={startLogo}>
                      {logo ? 'Adjust' : 'Extract Logo'}
                    </button>
                    {logo ? <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => setLogo(null)}>Remove</button> : null}
                  </div>
                </div>
                {logo ? (
                  <div className="flex justify-center rounded-lg bg-surface p-2"><img src={logo.url} alt="Logo" className="max-h-20 object-contain" /></div>
                ) : (
                  <p className="text-xs text-ink-faint">No logo — it will not be uploaded.</p>
                )}
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs text-ink-muted">
                {source === 'device' ? 'Read on this device — please check every field.' : 'Check the details before using them.'}
                {' '}Only empty fields of the form are filled.
              </p>
              <FormGrid cols={2}>
                {FIELDS.map((f) => (
                  <ClipboardField
                    key={f.key}
                    fieldClassName={f.wide ? 'lg:col-span-2' : undefined}
                    label={f.label}
                    pasteLabel={f.paste}
                    field={f.key}
                    value={data[f.key] ?? ''}
                    onValueChange={(v) => setData((prev) => ({ ...(prev ?? {}), [f.key]: v }))}
                  />
                ))}
              </FormGrid>
            </div>
          </div>
        ) : null}

        {step === 'logo' && readImage ? (
          <div className="space-y-2">
            <p className="text-xs text-ink-muted">Adjust the box around the logo. The first guess is automatic.</p>
            <div className="flex justify-center rounded-xl bg-surface-muted p-3">
              <ReactCrop crop={logoCrop} onChange={(c) => setLogoCrop(c)} onComplete={(c) => setLogoPixels(c)}>
                <img ref={logoImg} src={readImage.url} alt="Card" className="block max-h-[50vh] object-contain" onLoad={onLogoImageLoad} />
              </ReactCrop>
            </div>
          </div>
        ) : null}

        <canvas ref={frameCanvas} className="hidden" aria-hidden="true" />
      </div>
    </FormDrawer>
  )
}
