import type { InputHTMLAttributes } from 'react'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** Labeled checkbox. Use for boolean flags (primary contact, agree, etc.). */
export function Checkbox({ label, checked, onCheckedChange, className = '', id, disabled, ...props }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-2.5 select-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${className}`.trim()}>
      <input
        id={id}
        type="checkbox"
        className="size-4 shrink-0 rounded-sm border-line accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        {...props}
      />
      <span className="text-xs font-medium text-ink">{label}</span>
    </label>
  )
}
