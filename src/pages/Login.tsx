import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { paths } from '../app/paths'
import { isEmail } from '../api/sanitize'
import { getErrorTitle, PAGE_COPY } from '../constants/messages'
import ToastContainer, { type ToastMessage } from '../components/Toast'
import { Button, Card, FullPageSpinner, TextField } from '../ui'

export default function Login() {
  const { user, ready, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || paths.dashboard
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<ToastMessage | null>(null)
  const [pending, setPending] = useState(false)
  const copy = PAGE_COPY.login

  if (!ready) return <FullPageSpinner label="Checking session" />
  // When hosted in Spectrum ERP, use the shared Spectrum login page only
  if (import.meta.env.VITE_CRM_ROUTE_BASE) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (user) return <Navigate to={from} replace />

  function showError(title: string, message: string) {
    setNotice({
      id: `${Date.now()}`,
      type: 'error',
      title,
      message,
    })
  }

  function clearNotice() {
    setNotice(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail) {
      showError(getErrorTitle('VALIDATION'), copy.emailRequired)
      return
    }
    // No "@" means a Spectrum login ID (e.g. "edp"); only validate email-shaped input as an email.
    if (nextEmail.includes('@') && !isEmail(nextEmail)) {
      showError(getErrorTitle('VALIDATION'), copy.emailInvalid)
      return
    }
    if (!password) {
      showError(getErrorTitle('VALIDATION'), copy.passwordRequired)
      return
    }
    setPending(true)
    const result = await login(nextEmail, password)
    setPending(false)
    if (!result.ok) {
      showError(getErrorTitle('INVALID_CREDENTIALS'), result.message)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="ui-page-center relative px-4">
      <ToastContainer
        placement="top-right"
        toasts={notice ? [notice] : []}
        onDismiss={clearNotice}
      />
      <Card className="w-full max-w-sm px-6 py-8">
        <img
          src="/force-intellect-logo.png"
          alt="Force Intellect"
          className="mx-auto mb-6 h-10 w-auto max-w-[12rem] object-contain"
        />
        <h1 id="login-heading" className="ui-title text-center text-lg">
          {copy.headline}
        </h1>
        <p className="ui-subtitle mb-6 mt-1 text-center text-sm">{copy.subtitle}</p>
        <form onSubmit={onSubmit} className="space-y-4" aria-labelledby="login-heading" noValidate>
          <TextField
            label="Email or Login ID"
            htmlFor="login-email"
            type="text"
            value={email}
            onValueChange={(value) => {
              setEmail(value)
              clearNotice()
            }}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
          <TextField
            label="Password"
            htmlFor="login-password"
            type="password"
            value={password}
            onValueChange={(value) => {
              setPassword(value)
              clearNotice()
            }}
            autoComplete="current-password"
            required
          />
          <Button type="submit" variant="primary" block disabled={pending}>
            {pending ? copy.pending : copy.submit}
          </Button>
        </form>

        {import.meta.env.DEV ? (
          <div className="mt-5 rounded-xl border border-line bg-surface-muted/70 px-3.5 py-3 text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">Demo accounts</p>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-soft">
              <li>
                <span className="font-semibold text-ink">Admin</span>
                <span className="text-ink-faint"> — </span>
                <button
                  type="button"
                  className="rounded-sm font-mono text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onClick={() => {
                    setEmail('rajiv.anand@forceintellect.com')
                    setPassword('Admin@123')
                    clearNotice()
                  }}
                >
                  rajiv.anand@forceintellect.com
                </button>
                <span className="text-ink-faint"> / </span>
                <span className="font-mono">Admin@123</span>
              </li>
              <li>
                <span className="font-semibold text-ink">Sales</span>
                <span className="text-ink-faint"> — </span>
                <button
                  type="button"
                  className="rounded-sm font-mono text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onClick={() => {
                    setEmail('priya.mehta@forceintellect.com')
                    setPassword('Force@123')
                    clearNotice()
                  }}
                >
                  priya.mehta@forceintellect.com
                </button>
                <span className="text-ink-faint"> / </span>
                <span className="font-mono">Force@123</span>
              </li>
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
