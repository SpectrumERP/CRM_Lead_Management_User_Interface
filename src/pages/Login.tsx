import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { paths, taskAppReturnPath } from '../app/paths'
import { isEmail } from '../api/sanitize'
import { getErrorTitle, PAGE_COPY } from '../constants/messages'
import ToastContainer, { type ToastMessage } from '../components/Toast'
import { Button, Card, FullPageSpinner, TextField } from '../ui'

export default function Login() {
  const { user, ready, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // After login: back to the page that asked for it, else the Leads list (Dashboard hidden for now).
  const from = (location.state as { from?: string } | null)?.from || paths.leads
  // Task Management (/task) shares this sign-in and sends users here with ?next=/task/... to return to.
  const taskReturn = taskAppReturnPath(new URLSearchParams(location.search).get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<ToastMessage | null>(null)
  const [pending, setPending] = useState(false)
  const copy = PAGE_COPY.login

  // Already signed in: Task Management only needed the shared session — go straight back.
  useEffect(() => {
    if (ready && user && taskReturn) window.location.replace(taskReturn)
  }, [ready, user, taskReturn])

  if (!ready) return <FullPageSpinner label="Checking session" />
  // When hosted in Spectrum ERP, use the shared Spectrum login page only
  if (import.meta.env.VITE_CRM_ROUTE_BASE) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (user && taskReturn) return <FullPageSpinner label="Opening Tasks" />
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
    if (taskReturn) {
      window.location.assign(taskReturn)
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
          src="/spectrum-erp-logo.png"
          alt="Spectrum ERP"
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
      </Card>
    </div>
  )
}
