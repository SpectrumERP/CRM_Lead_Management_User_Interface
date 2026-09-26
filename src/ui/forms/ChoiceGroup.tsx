import { useId } from 'react'
import type { FormOption } from './options'
import { CountBadge } from '../CountBadge'

export type ChoiceOption<T extends string = string> = FormOption<T> & {
  count?: number
}

export interface ChoiceGroupProps<T extends string = string> {
  options: readonly (string | ChoiceOption<T>)[]
  value: T | ''
  onChange: (value: T) => void
  name?: string
  disabled?: boolean
  /** `row` stretches choices; `wrap` is a chip list; `radio` is native radio buttons. */
  layout?: 'row' | 'wrap' | 'radio'
}

/** Exclusive choice list (Yes/No, status, mode). Domain colors stay in the page. */
export function ChoiceGroup<T extends string = string>({
  options,
  value,
  onChange,
  name,
  disabled,
  layout = 'row',
}: ChoiceGroupProps<T>) {
  const autoName = useId()
  const groupName = name ?? autoName
  const items = options.map((option) =>
    typeof option === 'string' ? ({ value: option as T, label: option }) : option,
  )

  if (layout === 'radio') {
    return (
      <div role="radiogroup" className="flex flex-wrap items-center gap-5">
        {items.map((item) => {
          const selected = value === item.value
          const optionId = `${groupName}-${item.value}`
          return (
            <label
              key={item.value}
              htmlFor={optionId}
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              <input
                id={optionId}
                type="radio"
                name={groupName}
                value={item.value}
                checked={selected}
                disabled={disabled || item.disabled}
                onChange={() => onChange(item.value)}
                className="h-4 w-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>{item.label}</span>
              {item.count != null ? (
                <CountBadge value={item.count} size="sm" tone="primary-soft" />
              ) : null}
            </label>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="radiogroup"
      className={layout === 'wrap' ? 'flex flex-wrap gap-1.5' : 'flex gap-2'}
    >
      {items.map((item) => {
        const selected = value === item.value
        const count = item.count
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            name={groupName}
            aria-checked={selected}
            disabled={disabled || item.disabled}
            onClick={() => onChange(item.value)}
            className={`${
              layout === 'row' ? 'flex-1' : 'shrink-0'
            } inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-line bg-surface text-ink-muted'
            }`}
          >
            {item.label}
            {count != null ? (
              <CountBadge
                value={count}
                size="sm"
                tone={selected ? 'primary' : 'primary-soft'}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
