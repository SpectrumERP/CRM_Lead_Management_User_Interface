import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { QuickCreateProvider, useQuickCreate } from '../contexts/QuickCreateContext'
import { useCrmSelector } from '../contexts/CrmStoreContext'
import { useToast } from '../contexts/ToastContext'
import { matchAppPage, recordIdFromPath } from './paths'
import { onIdle, prefetchShellRoutes } from './prefetch'
import { PAGE_COPY } from '../constants/messages'
import { SkeletonPage, type SkeletonPageKind } from '../ui'

const QuickCreateHost = lazy(() => import('../components/QuickCreateHost'))

/** The shape of the page whose code is loading, from its path. */
function skeletonKind(pathname: string): SkeletonPageKind {
  const page = matchAppPage(pathname)
  if (page === 'dashboard') return 'dashboard'
  if (page.endsWith('-detail')) return 'detail'
  if (page.startsWith('create-') || page.startsWith('edit-') || page === 'settings' || page === 'my-profile') return 'form'
  return 'list'
}

function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  // Flex column filling <main>: list pages (root `flex-1 min-h-0`) get exactly the screen height, so
  // their grid scrolls inside with the header and pagination kept in view; longer pages still scroll.
  // A page whose code is still loading shows its shape; a page already loaded opens at once (no cover over it).
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<SkeletonPage kind={skeletonKind(pathname)} label={PAGE_COPY.pageLoading} />}>{children}</Suspense>
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
