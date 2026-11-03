import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  fetchFormRights,
  rightsFor,
  type FormRights,
  type FormRightsMap,
  type FormRightsSource,
} from '../api/formRights'

interface FormRightsState {
  /** False until the menu has loaded (or failed) for the current user. */
  ready: boolean
  source: FormRightsSource
  map: FormRightsMap
  /** Modules with an openable form (server menu only). */
  modules: number[]
}

const INITIAL: FormRightsState = { ready: false, source: 'fallback', map: {}, modules: [] }

const FormRightsContext = createContext<FormRightsState>(INITIAL)

/** Spectrum logins have `SPX-` ids; demo accounts have no token to ask the server with. */
function isSpectrumUser(id: string | undefined) {
  return Boolean(id?.startsWith('SPX-'))
}

/** Loads the signed-in user's form rights once per login (see api/formRights.ts). */
export function FormRightsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<FormRightsState>(INITIAL)
  const userId = user?.id

  useEffect(() => {
    if (!userId) {
      setState(INITIAL)
      return
    }
    if (!isSpectrumUser(userId)) {
      setState({ ready: true, source: 'fallback', map: {}, modules: [] })
      return
    }
    let cancelled = false
    setState(INITIAL)
    fetchFormRights()
      .then(({ map, modules }) => {
        if (!cancelled) setState({ ready: true, source: 'server', map, modules })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.warn('Form rights could not be loaded; using role-based rights instead.', error)
        setState({ ready: true, source: 'fallback', map: {}, modules: [] })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return <FormRightsContext.Provider value={state}>{children}</FormRightsContext.Provider>
}

/** Rights for one Spectrum form (see FORM_NO), plus `ready` while they load. */
export function useFormRights(formNo: number): FormRights & { ready: boolean } {
  const state = useContext(FormRightsContext)
  const { user } = useAuth()
  return useMemo(
    () => ({ ...rightsFor(formNo, state, user?.role), ready: state.ready }),
    [formNo, state, user?.role],
  )
}

/** Rights lookup for several forms at once (e.g. the sidebar's menu items). */
export function useFormRightsOf(): (formNo: number) => FormRights {
  const state = useContext(FormRightsContext)
  const { user } = useAuth()
  return useMemo(() => (formNo: number) => rightsFor(formNo, state, user?.role), [state, user?.role])
}

/**
 * Whether the ERP app launcher shows a module: the server menu gives the user an openable form in it.
 * Without the menu (demo login, menu failed) every module shows, as before.
 */
export function useMenuModules(): { ready: boolean; hasModule: (moduleNo: number) => boolean } {
  const state = useContext(FormRightsContext)
  return useMemo(
    () => ({
      ready: state.ready,
      hasModule: (moduleNo: number) => state.source === 'fallback' || state.modules.includes(moduleNo),
    }),
    [state],
  )
}
