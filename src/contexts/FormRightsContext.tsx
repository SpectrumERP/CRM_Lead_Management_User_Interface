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
}

const INITIAL: FormRightsState = { ready: false, source: 'fallback', map: {} }

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
      setState({ ready: true, source: 'fallback', map: {} })
      return
    }
    let cancelled = false
    setState(INITIAL)
    fetchFormRights()
      .then((map) => {
        if (!cancelled) setState({ ready: true, source: 'server', map })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.warn('Form rights could not be loaded; using role-based rights instead.', error)
        setState({ ready: true, source: 'fallback', map: {} })
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
