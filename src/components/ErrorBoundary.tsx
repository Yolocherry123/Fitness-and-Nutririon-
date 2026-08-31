import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Keeps a single screen crash from blanking the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crash', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="brand">Forge</div>
          <h1>Something went wrong</h1>
          <p className="muted small">{this.state.error.message}</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 12 }}
            onClick={() => {
              this.setState({ error: null })
              window.location.assign('/')
            }}
          >
            Back to Today
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
