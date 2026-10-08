import { useMemo } from 'react'
import { TableSearchSelectField, type TableSearchColumn } from '../ui'

export interface LookupOption {
  value: string
  label: string
  code?: string
  /** Optional third column, e.g. a stage's win %. */
  detail?: string
}

export interface OptionLookupFieldProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: readonly (string | LookupOption)[]
  required?: boolean
  error?: string
  hint?: string
  placeholder?: string
  /** Header for the `detail` column when options carry one. */
  detailHeader?: string
  disabled?: boolean
  fieldClassName?: string
}

function toOption(option: string | LookupOption): LookupOption {
  return typeof option === 'string' ? { value: option, label: option } : option
}

/**
 * Searchable table lookup for a simple list (masters, currencies, …) — the same look as the entity and
 * product lookups. Shows Code | Name when the options have codes, otherwise just Name.
 */
export function OptionLookupField({
  label,
  value,
  onValueChange,
  options,
  required,
  error,
  hint,
  placeholder = 'Select…',
  detailHeader,
  disabled,
  fieldClassName,
}: OptionLookupFieldProps) {
  const items = useMemo(() => options.map(toOption), [options])
  const columns = useMemo(() => {
    const cols: TableSearchColumn<LookupOption>[] = []
    if (items.some((o) => o.code)) cols.push({ header: 'Code', getValue: (o) => o.code || '—', width: '6.5rem' })
    cols.push({ header: 'Name', getValue: (o) => o.label, truncate: true })
    if (detailHeader && items.some((o) => o.detail)) cols.push({ header: detailHeader, getValue: (o) => o.detail ?? '', width: '5rem' })
    return cols
  }, [items, detailHeader])
  // A saved value that is no longer offered still shows as selected.
  const selected = items.find((o) => o.value === value) ?? (value ? { value, label: value } : null)

  return (
    <TableSearchSelectField
      label={label}
      required={required}
      error={error}
      hint={hint}
      fieldClassName={fieldClassName}
      options={items}
      value={selected}
      onChange={(item) => {
        if (item) onValueChange(item.value)
      }}
      getKey={(o) => o.value}
      getLabel={(o) => o.label}
      filterItem={(o, q) => `${o.code ?? ''} ${o.label} ${o.detail ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())}
      columns={columns}
      placeholder={placeholder}
      searchPlaceholder="Search…"
      emptyText="No matches"
      clearable={false}
      disabled={disabled}
    />
  )
}
