import { Component, type ErrorInfo, type ReactNode } from 'react'

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
        <div className="rounded-3xl border border-rose-400/35 bg-[rgba(72,16,24,0.62)] p-6 shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200/85">
            Protected UI Recovery
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-rose-100">
            {this.props.section} failed safely
          </h2>
          <p className="mt-2 text-sm text-rose-100/85">
            A rendering error was contained to prevent the whole workspace from crashing.
          </p>
          {this.state.message ? (
            <p className="mt-2 text-xs font-semibold text-rose-200">{this.state.message}</p>
          ) : null}
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 rounded-xl border border-rose-300/45 bg-rose-300/20 px-4 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-300/30"
          >
            Retry section
          </button>
        </div>
      </section>
    )
  }
}

export default AppErrorBoundary
