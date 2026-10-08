import { cloneElement, isValidElement, useId, type MouseEvent, type ReactElement, type ReactNode } from 'react'

type FieldControlProps = {
  id?: string
  className?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * Label + control + error/hint. Keep business logic out; pass any control as `children`.
 * Use `layout="inline"` for settings-style rows (label left, control right).
 */
export interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: string
  layout?: 'stack' | 'inline'
  className?: string
  children: ReactNode
}

/** A dropdown opens from its own control only — clicking its label does not open it. */
function keepDropdownClosed(event: MouseEvent<HTMLLabelElement>) {
  const control = event.currentTarget.control
  if (control?.matches('[aria-haspopup], [role="combobox"]')) event.preventDefault()
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  layout = 'stack',
  className = '',
  children,
}: FieldProps) {
  const autoId = useId()
  const controlId = htmlFor ?? autoId
  const errorId = error ? `${controlId}-error` : undefined
  const hintId = hint ? `${controlId}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        id: (children as ReactElement<FieldControlProps>).props.id ?? controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        className: [(children as ReactElement<FieldControlProps>).props.className, error ? 'error' : '']
          .filter(Boolean)
          .join(' '),
      })
    : children

  const labelNode = (
    <label htmlFor={controlId} onClick={keepDropdownClosed} className={layout === 'inline' ? 'text-xs font-semibold text-ink-muted pt-2' : 'form-label'}>
      {label}
      {required ? <span className="form-required" aria-hidden="true">*</span> : null}
    </label>
  )

  const body = (
    <>
      {control}
      {error ? (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={hintId} className="form-hint">
          {hint}
        </p>
      ) : null}
    </>
  )

  if (layout === 'inline') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-start py-3 border-b border-line-subtle ${className}`.trim()}>
        <div className="sm:col-span-1">{labelNode}</div>
        <div className="sm:col-span-2">{body}</div>
      </div>
    )
  }

  return (
    <div className={className}>
      {labelNode}
      {body}
    </div>
  )
}
