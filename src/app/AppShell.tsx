import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { QuickCreateProvider, useQuickCreate } from '../contexts/QuickCreateContext'
import { useCrmSelector } from '../contexts/CrmStoreContext'
import { useToast } from '../contexts/ToastContext'
import { matchAppPage, recordIdFromPath } from './paths'
import { onIdle, prefetchShellRoutes } from './prefetch'
import { PAGE_COPY } from '../constants/messages'
import { PageLoader } from '../ui'

const QuickCreateHost = lazy(() => import('../components/QuickCreateHost'))

function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setBusy(true)
    const hide = window.setTimeout(() => setBusy(false), 380)
    return () => window.clearTimeout(hide)
  }, [pathname])

  // Flex column filling <main>: list pages (root `flex-1 min-h-0`) get exactly the screen height, so
  // their grid scrolls inside with the header and pagination kept in view; longer pages still scroll.
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {busy ? <PageLoader label={PAGE_COPY.pageLoading} /> : null}
      <Suspense fallback={<PageLoader label={PAGE_COPY.pageLoading} />}>{children}</Suspense>
    </div>
  )
}

function QuickCreateGate() {
  const { activeKind } = useQuickCreate()
  const { addToast } = useToast()
  if (!activeKind) return null
  return (
    <Suspense fallback={null}>
      <QuickCreateHost onToast={addToast} />
    </Suspense>
  )
}

function useShellDetailName() {
  const { pathname } = useLocation()
  const params = useParams()
  const page = matchAppPage(pathname)
  const id = params.id ?? recordIdFromPath(pathname)
  return useCrmSelector((state) => {
    if (page === 'contact-detail' && id) return state.contacts.find((contact) => contact.id === id)?.name
    if (page === 'lead-detail' && id) return state.leads.find((lead) => lead.id === id)?.companyName
    if ((page === 'opportunity-detail' || page === 'edit-opportunity') && id) {
      return state.opportunities.find((item) => item.id === id)?.name
    }
    return undefined
  })
}

export default function AppShell({ children }: { children?: ReactNode }) {
  const detailName = useShellDetailName()

  useEffect(() => onIdle(prefetchShellRoutes), [])

  return (
    <QuickCreateProvider>
      <Layout detailName={detailName}>
        <RouteTransition>{children ?? <Outlet />}</RouteTransition>
      </Layout>
      <QuickCreateGate />
    </QuickCreateProvider>
  )
}
