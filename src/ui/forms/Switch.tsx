export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  id?: string
}

/** On/off control. Prefer Checkbox when the value is a form field; Switch for settings. */
export function Switch({ checked, onCheckedChange, label, description, disabled, id }: SwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      {label ? (
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{label}</p>
          {description ? <p className="text-xs mt-0.5 text-ink-faint">{description}</p> : null}
        </div>
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={`relative h-[1.375rem] w-10 flex-shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          checked ? 'bg-primary' : 'bg-line'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span
          className={`absolute top-1 size-3.5 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-1'}`}
        />
      </button>
    </div>
  )
}
