import { BrowserRouter } from 'react-router-dom'
import { Suspense, type ReactNode } from 'react'
import { AppProviders } from './app/providers'
import { AppRouter } from './app/routes'
import { ErrorHandlerProvider, useErrorHandler } from './app/ErrorHandler'
import { AppErrorBoundary } from './app/ErrorBoundary'
import { BootShell, FullPageSpinner } from './ui'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

/** First route chunk: keep the app chrome painted (as index.html does) except on the login page. */
function RouteFallback() {
  return window.location.pathname.endsWith('/login') ? <FullPageSpinner /> : <BootShell />
}

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
            <Suspense fallback={<RouteFallback />}>
              <AppRouter />
            </Suspense>
          </AppErrors>
        </ErrorHandlerProvider>
      </BrowserRouter>
    </AppProviders>
  )
}
