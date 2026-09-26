import type { TextareaHTMLAttributes } from 'react'
import { controlClass } from './controlClass'

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  onValueChange?: (value: string) => void
}

export function TextArea({
  invalid,
  className = '',
  rows = 3,
  onValueChange,
  onChange,
  ...props
}: TextAreaProps) {
  return (
    <textarea
      rows={rows}
      className={controlClass({ invalid, className: `resize-none ${className}` })}
      aria-invalid={invalid || undefined}
      onChange={(event) => {
        onChange?.(event)
        onValueChange?.(event.target.value)
      }}
      {...props}
    />
  )
}
