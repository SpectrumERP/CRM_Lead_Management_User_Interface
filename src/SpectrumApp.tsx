import { Suspense } from 'react'
import { AppErrors, RouteFallback } from './App'
import { AppProviders } from './app/providers'
import { AppRouter } from './app/routes'
import { ErrorHandlerProvider } from './app/ErrorHandler'
import { installNumberInputGuards } from './app/numberInputs'
import { installTableScrollEdges } from './utils/tableScrollEdges'
import './index.css'

installNumberInputGuards()
installTableScrollEdges()

/**
 * The CRM as a Spectrum ERP module (Module Federation remote `crm/App`, see vite.config.ts). The shell
 * owns the router and mounts this under /crm, so there is no BrowserRouter here; routes resolve below
 * the shell's match and src/app/paths.ts prefixes links with VITE_CRM_ROUTE_BASE.
 */
export default function SpectrumApp() {
  return (
    <AppProviders>
      <ErrorHandlerProvider>
        <AppErrors>
          <Suspense fallback={<RouteFallback />}>
            <AppRouter />
          </Suspense>
        </AppErrors>
      </ErrorHandlerProvider>
    </AppProviders>
  )
}
