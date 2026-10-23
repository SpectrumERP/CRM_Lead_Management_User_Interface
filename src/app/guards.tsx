import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAdmin } from '../auth/users'
import { paths } from './paths'
import { BootShell } from '../ui'

/** CRM sign-in is owned by the Spectrum ERP shell in every environment. */
const IN_SPECTRUM = String(import.meta.env.VITE_CRM_ROUTE_BASE ?? '').trim() !== ''
const LOGIN_PATH = IN_SPECTRUM ? '/login' : paths.login

export function AuthGuard() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <BootShell label="Checking session" />
  if (!user) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />
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
