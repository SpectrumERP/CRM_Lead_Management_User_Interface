import { useCallback, useEffect, useRef, useState } from 'react'

const SHEET_OUT_MS = 280
const SHEET_OUT_REDUCED_MS = 140

export function useSheetClose(onClose: () => void) {
  const [closing, setClosing] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const requestClose = useCallback(() => {
    setClosing(true)
  }, [])

  useEffect(() => {
    if (!closing) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(
      () => onCloseRef.current(),
      reduced ? SHEET_OUT_REDUCED_MS : SHEET_OUT_MS,
    )
    return () => window.clearTimeout(t)
  }, [closing])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  return { closing, requestClose }
}
