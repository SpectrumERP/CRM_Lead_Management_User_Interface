import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '../components/CRMStates'
import { resolveError } from '../api/errorPolicy'

interface Props {
  children: ReactNode
  onError?: (error: unknown) => 'handled' | 'crash'
  /** Clears a caught error when it changes (e.g. the route), so navigating away recovers. */
  resetKey?: string
}

interface State {
  error: Error | null
}

const RELOAD_AT = 'crm:chunk-reload-at'
/** Don't auto-reload again within this window: the chunk is truly missing, show the card instead. */
const RELOAD_COOLDOWN_MS = 10_000

/**
 * A lazy page chunk failed to download: a deploy replaced the hashed files under an open tab, the
 * network dropped, or (in dev) Vite re-optimized deps. React.lazy caches the rejection, so only a
 * full reload recovers.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|Failed to load module script/i.test(
    `${error.name} ${error.message}`,
  )
}

/** Reload once to pick up the current build; returns false if we just did (avoids a reload loop). */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_AT) ?? 0)
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(RELOAD_AT, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnce()) return
    this.props.onError?.(error)
  }

  private retry = () => {
    if (isChunkLoadError(this.state.error)) window.location.reload()
    else this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    const action = resolveError(this.state.error)
    return (
      <div className="ui-page-center px-4">
        <div className="ui-crash-card" role="alert">
          <ErrorState title={action.title} message={action.message} onRetry={this.retry} />
        </div>
      </div>
    )
  }
}
