import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAdmin } from '../auth/users'
import { paths } from './paths'
import { BootShell } from '../ui'

/**
 * The CRM has no login page: the Spectrum ERP shell's login signs in to every app. Inside the shell
 * (VITE_CRM_ROUTE_BASE) that is its /login, on this origin. Run on its own, the CRM points to it.
 */
const IN_SPECTRUM = String(import.meta.env.VITE_CRM_ROUTE_BASE ?? '').trim() !== ''
const SPECTRUM_LOGIN_URL = `${String(import.meta.env.VITE_SPECTRUM_URL || 'http://localhost:5173').replace(/\/+$/, '')}/login`

/** Run on its own and signed out: no form here, a way to the one Spectrum ERP login. */
function SignInWithSpectrum() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 text-center shadow-card">
        <img src="/spectrum-erp-logo.png" alt="Spectrum ERP" className="mx-auto h-9 w-auto" />
        <h1 className="ui-title mt-5 text-lg">Sign in with Spectrum ERP</h1>
        <p className="ui-subtitle mt-1 text-sm">The CRM uses your Spectrum ERP account. Sign in there, then open the CRM.</p>
        <a href={SPECTRUM_LOGIN_URL} className="btn btn-solid btn-block mt-5">
          Go to Spectrum ERP login
        </a>
      </div>
    </div>
  )
}

export function AuthGuard() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <BootShell label="Checking session" />
  if (!user) {
    if (!IN_SPECTRUM) return <SignInWithSpectrum />
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function AdminGuard() {
  const { user, ready } = useAuth()
  if (!ready) return <BootShell label="Checking session" />
  if (!isAdmin(user?.role)) {
    return <Navigate to={paths.forbidden} replace />
  }
  return <Outlet />
}
