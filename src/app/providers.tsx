import type { ReactNode } from 'react'
import { MasterDataProvider } from '../contexts/MasterDataContext'
import { NotificationsProvider } from '../contexts/NotificationsContext'
import { CrmStoreProvider } from '../contexts/CrmStoreContext'
import { ToastProvider } from '../contexts/ToastContext'
import { AuthProvider } from '../auth/AuthContext'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <MasterDataProvider>
          <CrmStoreProvider>
            <ToastProvider>{children}</ToastProvider>
          </CrmStoreProvider>
        </MasterDataProvider>
      </NotificationsProvider>
    </AuthProvider>
  )
}
