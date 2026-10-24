import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Skeleton, SkeletonStatus } from './Skeleton'

export interface ImagePreviewProps {
  /** Image URL; null while it loads. */
  src: string | null
  /** Alt text, e.g. the file name. */
  alt: string
  onClose: () => void
}

/**
 * An image enlarged over the page (dimmed backdrop, Close). A click anywhere or Escape closes it.
 * Above drawers and dialogs, below toasts.
 */
export function ImagePreview({ src, alt, onClose }: ImagePreviewProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[97] flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-label={`Preview of ${alt}`}
      onClick={onClose}>
      {src ? (
        <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain shadow-overlay" />
      ) : (
        // The picture's place, so it opens where the image will be.
        <SkeletonStatus label={`Loading ${alt}`}>
          <Skeleton className="h-[60vh] w-[min(80vw,48rem)] rounded-lg" />
        </SkeletonStatus>
      )}
      <button type="button" className="absolute right-4 top-4 rounded-full bg-surface/90 px-3 py-1 text-xs font-bold text-ink" onClick={(e) => { e.stopPropagation(); onClose() }}>
        Close
      </button>
    </div>,
    document.body,
  )
}
