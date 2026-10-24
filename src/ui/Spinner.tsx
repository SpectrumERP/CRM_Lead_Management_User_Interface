/**
 * Indeterminate progress of an action (saving, uploading, reading a card). For content on its way use the skeletons
 * in ./Skeleton instead. `label` is announced to assistive tech (visual spinner stays decorative).
 */
export interface SpinnerProps {
  /** Accessible status text. Not shown visually. */
  label?: string
}

export function Spinner({ label = 'Loading' }: SpinnerProps) {
  return <div className="ui-spinner" role="status" aria-live="polite" aria-label={label} />
}
