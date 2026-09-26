import { BrowserRouter } from 'react-router-dom'
import { Suspense, type ReactNode } from 'react'
import { AppProviders } from './app/providers'
import { AppRouter } from './app/routes'
import { ErrorHandlerProvider, useErrorHandler } from './app/ErrorHandler'
import { AppErrorBoundary } from './app/ErrorBoundary'
import { FullPageSpinner } from './ui'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

function AppErrors({ children }: { children: ReactNode }) {
  const { handleError } = useErrorHandler()
  return <AppErrorBoundary onError={handleError}>{children}</AppErrorBoundary>
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter basename={basename}>
        <ErrorHandlerProvider>
          <AppErrors>
            <Suspense fallback={<FullPageSpinner />}>
              <AppRouter />
            </Suspense>
          </AppErrors>
        </ErrorHandlerProvider>
      </BrowserRouter>
    </AppProviders>
  )
}
