/**
 * Number fields change only by typing: the mouse wheel and ↑ / ↓ keys must not step the value.
 * One document-level guard covers every `<input type="number">` in the app.
 */
export function installNumberInputGuards(doc: Document = document) {
  const isNumberInput = (target: EventTarget | null): target is HTMLInputElement =>
    target instanceof HTMLInputElement && target.type === 'number'

  // A focused number field steps its value on wheel; blurring first lets the page scroll instead.
  const onWheel = (event: WheelEvent) => {
    if (isNumberInput(event.target) && doc.activeElement === event.target) event.target.blur()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (isNumberInput(event.target) && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) event.preventDefault()
  }

  doc.addEventListener('wheel', onWheel, { passive: true, capture: true })
  doc.addEventListener('keydown', onKeyDown, { capture: true })
  return () => {
    doc.removeEventListener('wheel', onWheel, { capture: true })
    doc.removeEventListener('keydown', onKeyDown, { capture: true })
  }
}
