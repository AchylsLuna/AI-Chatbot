import { Component, type ErrorInfo, type ReactNode } from 'react'
import { stateCardClass } from '../../styles/uiClassNames'

type AppErrorBoundaryProps = {
  children: ReactNode
  section: string
  resetKey?: string
}

type AppErrorBoundaryState = {
  hasError: boolean
  message: string
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unexpected UI error',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Error boundary caught in ${this.props.section}`, error, info)
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' })
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <section className="mx-auto w-full px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className={`${stateCardClass} p-6`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--agent-danger)]">
            Protected UI Recovery
          </p>
          <h2 className="ui-display-state-title mt-3 text-2xl font-semibold text-[color:var(--agent-ink)]">
            {this.props.section} failed safely
          </h2>
          <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
            A rendering error was contained to prevent the whole page from crashing.
          </p>
          {this.state.message ? (
            <p className="agent-alert agent-alert--error mt-3">{this.state.message}</p>
          ) : null}
          <button
            type="button"
            onClick={this.handleReset}
            className="agent-button mt-4 px-4 py-2.5 text-sm text-[color:var(--agent-on-accent)]"
          >
            Retry section
          </button>
        </div>
      </section>
    )
  }
}

export default AppErrorBoundary
