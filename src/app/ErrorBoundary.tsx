import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '../components/CRMStates'
import { resolveError } from '../api/errorPolicy'

interface Props {
  children: ReactNode
  onError?: (error: unknown) => 'handled' | 'crash'
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    const action = resolveError(this.state.error)
    return (
      <div className="ui-page-center px-4">
        <div className="ui-crash-card" role="alert">
          <ErrorState
            title={action.title}
            message={action.message}
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      </div>
    )
  }
}
