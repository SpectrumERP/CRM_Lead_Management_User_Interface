import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { taskAppReturnPath, taskAppUrl } from '../app/paths'
import { isEmail } from '../api/sanitize'
import { getErrorTitle, PAGE_COPY } from '../constants/messages'
import { Button, FullPageSpinner, TextField } from '../ui'

type LoginField = 'email' | 'password'

export default function Login() {
  const { user, ready, login } = useAuth()
  const location = useLocation()
  // After login: Task Management opens — the /task/... page it sent the user from (?next=), else its first
  // page. It is a separate app under its own path (shared sign-in), so this is a full page load.
  const taskReturn = taskAppReturnPath(new URLSearchParams(location.search).get('next'))
  const afterLogin = taskReturn ?? taskAppUrl
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{ message: string; field?: LoginField } | null>(null)
  // Bumped on each failure so the card re-runs its shake animation.
  const [attempt, setAttempt] = useState(0)
  const [capsLock, setCapsLock] = useState(false)
  const [pending, setPending] = useState(false)
  const copy = PAGE_COPY.login

  // Already signed in: straight to Task Management.
  useEffect(() => {
    if (ready && user) window.location.replace(afterLogin)
  }, [ready, user, afterLogin])

  if (!ready) return <FullPageSpinner label="Checking session" />
  // When hosted in Spectrum ERP, use the shared Spectrum login page only
  if (import.meta.env.VITE_CRM_ROUTE_BASE) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (user) return <FullPageSpinner label="Opening Tasks" />

  function showError(message: string, field?: LoginField) {
    setError({ message, field })
    setAttempt((n) => n + 1)
    if (field) document.getElementById(`login-${field}`)?.focus()
  }

  function clearNotice() {
    setError(null)
  }

  function trackCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState('CapsLock'))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail) {
      showError(copy.emailRequired, 'email')
      return
    }
    // No "@" means a Spectrum login ID (e.g. "edp"); only validate email-shaped input as an email.
    if (nextEmail.includes('@') && !isEmail(nextEmail)) {
      showError(copy.emailInvalid, 'email')
      return
    }
    if (!password) {
      showError(copy.passwordRequired, 'password')
      return
    }
    setPending(true)
    const result = await login(nextEmail, password)
    setPending(false)
    if (!result.ok) {
      showError(result.message || getErrorTitle('INVALID_CREDENTIALS'), 'password')
      return
    }
    window.location.assign(afterLogin)
  }

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Brand panel — CRM blue deepening to navy, faint grid, the ERP statement and its modules. */}
      <section className="page-gutter relative hidden flex-col overflow-hidden py-10 text-white lg:flex">
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#1E56A0_0%,#17457F_55%,#0c1a3a_100%)]" />
        <div aria-hidden className="login-grid absolute inset-0" />
        <div aria-hidden className="absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl" />

        <img
          src="/spectrum-erp-logo-on-dark.png"
          alt="Spectrum ERP"
          className="relative h-10 w-auto self-start object-contain"
        />

        <div className="login-rise relative my-auto max-w-2xl py-10">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            <span className="h-0.5 w-6 rounded-full bg-[#e05252]" />
            <ShieldIcon />
            {copy.heroBadge}
          </p>
          <h2 className="mt-5 text-[2.6rem] font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            {copy.heroTitle}
            <span className="block text-[#a9c4ec]">{copy.heroTitleAccent}</span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75">{copy.brandLead}</p>

          <ul className="mt-10 grid grid-cols-3 gap-3">
            {copy.highlights.map((item, i) => {
              const Icon = MODULE_ICONS[i % MODULE_ICONS.length]
              return (
                <li
                  key={item.title}
                  className="login-rise group relative overflow-hidden rounded-xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm"
                  style={{ animationDelay: `${140 + i * 80}ms` }}
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-white/40 via-white/10 to-transparent" />
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-primary shadow-sm">
                    <Icon />
                  </span>
                  <p className="mt-3.5 text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/65">{item.body}</p>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-white/55">
          <p>
            © {new Date().getFullYear()} {copy.rights}
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldIcon />
            {copy.secure}
          </p>
        </div>
      </section>

      {/* Sign-in panel */}
      <main className="page-gutter relative flex flex-col bg-canvas py-8 lg:bg-surface">
        <img src="/spectrum-erp-logo.png" alt="Spectrum ERP" className="h-9 w-auto self-start object-contain lg:hidden" />

        <div className="login-rise mx-auto my-auto w-full max-w-md py-10" style={{ animationDelay: '80ms' }}>
          <div key={attempt} className={attempt ? 'login-shake' : undefined}>
            <h1 id="login-heading" className="ui-title text-2xl tracking-tight">
              {copy.headline}
            </h1>
            <p className="ui-subtitle mt-1 text-sm">{copy.subtitle}</p>

            <form onSubmit={onSubmit} className="login-form form-labels-as-written mt-7 space-y-4" aria-labelledby="login-heading" noValidate>
              <TextField
                label={copy.idLabel}
                htmlFor="login-email"
                type="text"
                value={email}
                placeholder={copy.idPlaceholder}
                leading={<UserIcon />}
                invalid={error?.field === 'email'}
                onValueChange={(value) => {
                  setEmail(value)
                  clearNotice()
                }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
              />
              <div>
                <TextField
                  label={copy.passwordLabel}
                  htmlFor="login-password"
                  type="password"
                  value={password}
                  placeholder={copy.passwordPlaceholder}
                  leading={<KeyIcon />}
                  invalid={error?.field === 'password'}
                  onValueChange={(value) => {
                    setPassword(value)
                    clearNotice()
                  }}
                  onKeyDown={trackCapsLock}
                  onKeyUp={trackCapsLock}
                  onBlur={() => setCapsLock(false)}
                  autoComplete="current-password"
                  required
                />
                {capsLock && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
                    <AlertIcon />
                    {copy.capsLock}
                  </p>
                )}
              </div>
              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2.5 rounded-control border border-accent/20 bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent"
                >
                  <AlertIcon />
                  {error.message}
                </div>
              )}
              <Button
                type="submit"
                variant="solid"
                block
                disabled={pending}
                aria-busy={pending || undefined}
                className="login-btn group gap-2"
              >
                {pending && <span aria-hidden className="login-btn-spinner" />}
                {pending ? copy.pending : copy.submit}
                {!pending && (
                  <span className="transition-transform group-hover:translate-x-0.5">
                    <ArrowIcon />
                  </span>
                )}
              </Button>
            </form>

          </div>
        </div>

        <p className="text-center text-xs text-ink-muted">{copy.help}</p>
        <p className="mt-1 text-center text-xs text-ink-faint lg:hidden">
          © {new Date().getFullYear()} {copy.rights}
        </p>
      </main>
    </div>
  )
}

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const


/** Finance & Inventory, Sales & CRM, Tasks & Meetings (PAGE_COPY.login.highlights order). */
function FinanceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" {...iconProps}>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-6" />
    </svg>
  )
}

function SalesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  )
}

const MODULE_ICONS = [FinanceIcon, SalesIcon, TasksIcon]

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" {...iconProps}>
      <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" />
    </svg>
  )
}


function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" {...iconProps}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}



function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-faint" {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-faint" {...iconProps}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 8.65-8.65M17 6l2.5 2.5M14.5 8.5 16.5 10.5" />
    </svg>
  )
}




