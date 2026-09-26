import type { ButtonHTMLAttributes } from 'react'
import { IconTooltip } from './IconTooltip'

export type ButtonVariant = 'primary' | 'solid' | 'secondary' | 'danger' | 'icon'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn btn-primary',
  solid: 'btn btn-solid',
  secondary: 'btn btn-secondary',
  danger: 'btn btn-danger',
  icon: 'btn-icon',
}

/**
 * Shared action control. Covers default / hover / active / disabled / focus-visible via `.btn*`.
 * Use for all clicks that submit or trigger a command — do not invent a local `<button>` style.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. `icon` is a compact square for close/dismiss controls. */
  variant?: ButtonVariant
  /** Stretch to the parent width (login, dialogs). */
  block?: boolean
}

export function Button({
  variant = 'primary',
  block,
  className = '',
  type = 'button',
  title,
  ...props
}: ButtonProps) {
  const size = block ? 'btn-block' : variant === 'icon' ? '' : 'btn-md'
  const tip = (typeof props['aria-label'] === 'string' && props['aria-label']) || title
  const button = (
    <button
      type={type}
      className={`${VARIANT[variant]} ${size} ${className}`.trim()}
      {...props}
    />
  )
  if (variant === 'icon' && tip) {
    return <IconTooltip label={tip}>{button}</IconTooltip>
  }
  return button
}
