import { useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { controlClass } from './controlClass'

/**
 * Native text-like control. `type` covers text, email, password, tel, date, time, number, search, url.
 */
export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  invalid?: boolean
  /** Called with the string value; use alongside or instead of `onChange`. */
  onValueChange?: (value: string) => void
  leading?: ReactNode
  /** Extra content anchored to the right inside the control (e.g. clear). */
  trailing?: ReactNode
  /**
   * When `type="password"`, show an eye toggle to reveal/hide the value.
   * Defaults to true for password inputs.
   */
  revealable?: boolean
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    )
  }
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  )
}

export function TextInput({
  invalid,
  className = '',
  onValueChange,
  onChange,
  leading,
  trailing,
  revealable,
  type = 'text',
  style,
  disabled,
  ...props
}: TextInputProps) {
  const leadRef = useRef<HTMLSpanElement>(null)
  const [padLeft, setPadLeft] = useState<number | undefined>(undefined)
  const [revealed, setRevealed] = useState(false)
  const showReveal = type === 'password' && revealable !== false
  const inputType = showReveal ? (revealed ? 'text' : 'password') : type
  const hasTrailing = Boolean(trailing) || showReveal

  useLayoutEffect(() => {
    if (!leading || !leadRef.current) {
      setPadLeft(undefined)
      return
    }
    setPadLeft(leadRef.current.offsetWidth + 20)
  }, [leading])

  const padRightClass = hasTrailing ? '!pr-10' : ''
  const input = (
    <input
      type={inputType}
      disabled={disabled}
      className={controlClass({
        invalid,
        className: `${padRightClass} ${className}`.trim(),
      })}
      style={leading && padLeft != null ? { ...style, paddingLeft: padLeft } : style}
      aria-invalid={invalid || undefined}
      onChange={(event) => {
        onChange?.(event)
        onValueChange?.(event.target.value)
      }}
      {...props}
    />
  )

  if (!leading && !hasTrailing) return input

  return (
    <div className="relative">
      {leading ? (
        <span
          ref={leadRef}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-bold text-ink-soft"
        >
          {leading}
        </span>
      ) : null}
      {input}
      {showReveal ? (
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          onClick={() => setRevealed((prev) => !prev)}
        >
          <EyeIcon open={revealed} />
        </button>
      ) : trailing ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>
      ) : null}
    </div>
  )
}
