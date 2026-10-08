import type { ReactNode } from 'react'
import { MasterDataProvider } from '../contexts/MasterDataContext'
import { NotificationsProvider } from '../contexts/NotificationsContext'
import { CrmStoreProvider } from '../contexts/CrmStoreContext'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmProvider } from '../contexts/ConfirmContext'
import { AuthProvider } from '../auth/AuthContext'
import { FormRightsProvider } from '../contexts/FormRightsContext'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FormRightsProvider>
        <NotificationsProvider>
          <MasterDataProvider>
            <CrmStoreProvider>
              <ToastProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
              </ToastProvider>
            </CrmStoreProvider>
          </MasterDataProvider>
        </NotificationsProvider>
      </FormRightsProvider>
    </AuthProvider>
  )
}
