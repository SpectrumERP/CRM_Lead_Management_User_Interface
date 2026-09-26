import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAdmin } from '../auth/users'
import { paths } from './paths'
import { FullPageSpinner } from '../ui'

/** Spectrum shell hosts CRM under /crm — use shared Spectrum login, not CRM's own. */
const SPECTRUM_LOGIN =
  String(import.meta.env.VITE_CRM_ROUTE_BASE ?? '')
    .trim()
    .replace(/\/+$/, '') !== ''
    ? '/login'
    : paths.login

export function AuthGuard() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <FullPageSpinner />
  if (!user) {
    return <Navigate to={SPECTRUM_LOGIN} replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function AdminGuard() {
  const { user, ready } = useAuth()
  if (!ready) return <FullPageSpinner />
  if (!isAdmin(user?.role)) {
    return <Navigate to={paths.forbidden} replace />
  }
  return <Outlet />
}
