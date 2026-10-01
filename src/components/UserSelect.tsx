import { useEffect, useId, useRef, useState } from 'react'
import { toApiError } from '../api/errors'
import { searchUsers, userDisplayName, type UserOption } from '../api/users'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'
import { Field, TableSearchSelect, type TableSearchColumn } from '../ui'

interface UserPick {
  key: string
  loginNo?: number
  name: string
  loginId: string
  email: string
}

const SEARCH_DEBOUNCE_MS = 300

const USER_COLUMNS: TableSearchColumn<UserPick>[] = [
  { header: 'Name', getValue: (u) => u.name, truncate: true },
  { header: 'Login ID', getValue: (u) => u.loginId || '—', width: '10rem', truncate: true },
  { header: 'Email', getValue: (u) => u.email || '—', width: 'minmax(0,1.2fr)', truncate: true },
]

/** The unfiltered list is shared by every picker on the page — one request, not one per field. */
let firstPage: Promise<UserOption[]> | null = null
function loadUsers(keyword: string) {
  if (keyword) return searchUsers(keyword)
  if (!firstPage) {
    firstPage = searchUsers('')
    firstPage.catch(() => {
      firstPage = null
    })
  }
  return firstPage
}

function toPick(user: UserOption): UserPick {
  return {
    key: `SPX-U-${user.loginNo}`,
    loginNo: user.loginNo,
    name: userDisplayName(user),
    loginId: user.loginId,
    email: user.email ?? '',
  }
}

/** Searches only after the field has been opened once, so opening a form sends no user request. */
function useUserSearch(enabled: boolean) {
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<UserPick[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (!enabled || !opened) return
    const id = ++requestId.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      loadUsers(query.trim())
        .then((users) => {
          if (id !== requestId.current) return
          setOptions(users.map(toPick))
          setError(null)
        })
        .catch((err: unknown) => {
          if (id === requestId.current) setError(toApiError(err).message)
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false)
        })
    }, query ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(timer)
  }, [enabled, opened, query])

  return {
    options,
    loading,
    error,
    setQuery,
    onOpenChange: (open: boolean) => {
      if (open) setOpened(true)
    },
  }
}

export interface UserSelectProps {
  /** Selected user's display name — the same string the forms already store. */
  value: string
  /** `loginNo` is set when a Spectrum user is picked (undefined for demo logins). */
  onValueChange: (name: string, loginNo?: number) => void
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  id?: string
  'aria-label'?: string
}

/**
 * User picker: table lookup (Name / Login ID / Email) searched via `/api/security/users?keywordSearch=`,
 * loaded when first opened. Server users only — disabled without a Spectrum login.
 */
export function UserSelect({ value, onValueChange, placeholder = 'Select user', invalid, disabled, id, ...rest }: UserSelectProps) {
  const company = useSpectrumCompany()
  const remote = company.enabled
  const search = useUserSearch(remote)

  const selected = value
    ? (search.options.find((o) => o.name === value) ?? { key: `name:${value}`, name: value, loginId: '', email: '' })
    : null
  const options = selected && !search.options.some((o) => o.key === selected.key) ? [selected, ...search.options] : search.options

  return (
    <TableSearchSelect
      id={id}
      options={options}
      value={selected}
      onChange={(pick) => onValueChange(pick?.name ?? '', pick?.loginNo)}
      getKey={(o) => o.key}
      getLabel={(o) => o.name}
      columns={USER_COLUMNS}
      // Users come from the server only — without a Spectrum login there is nothing to pick.
      placeholder={remote ? placeholder : 'Sign in with Spectrum to pick a user'}
      searchPlaceholder="Search user by name, login ID or email"
      emptyText="No matching users"
      invalid={invalid}
      disabled={disabled || !remote}
      clearable={false}
      onQueryChange={search.setQuery}
      onOpenChange={search.onOpenChange}
      loading={search.loading}
      footer={search.error ? `Could not load users: ${search.error}` : undefined}
    />
  )
}

export interface UserSelectFieldProps extends UserSelectProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
}

/** `UserSelect` with a label and error (server users only). */
export function UserSelectField({ label, required, error, hint, ...input }: UserSelectFieldProps) {
  const autoId = useId()
  const id = input.id ?? autoId
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <UserSelect {...input} id={id} invalid={Boolean(error) || input.invalid} />
    </Field>
  )
}
