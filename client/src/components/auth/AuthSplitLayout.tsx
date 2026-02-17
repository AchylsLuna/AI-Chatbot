import type { ReactNode } from 'react'
import AppLogoBadge from '../branding/AppLogoBadge'

type AuthSplitLayoutProps = {
  children: ReactNode
  layout?: 'split' | 'center'
  centerBorderless?: boolean
}

const AuthShowcase = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-2.5">
      <AppLogoBadge className="h-10 w-10" />
      <span className="text-base font-semibold text-[color:var(--agent-ink)]">AI Health Care</span>
    </div>
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold leading-tight text-[color:var(--agent-ink)] sm:text-4xl">
        Secure access for appointment and care workflows
      </h1>
      <p className="max-w-xl text-sm text-[color:var(--agent-muted)]">
        Sign in to continue with role-based access, appointment tracking, and staff dashboards.
      </p>
    </div>
  </div>
)

const AuthSplitLayout = ({
  children,
  layout = 'split',
  centerBorderless = false,
}: AuthSplitLayoutProps) => {
  if (layout === 'center') {
    const centerCardClass = centerBorderless
      ? 'w-full rounded-2xl bg-[color:var(--agent-surface)] p-4 shadow-[var(--card-shadow-soft)] sm:p-6'
      : 'w-full rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-4 shadow-[var(--card-shadow-soft)] sm:p-6'
    return (
      <div className="min-h-screen bg-[color:var(--agent-bg)] px-4 py-10 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
          <div className={centerCardClass}>
            {children}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[color:var(--agent-bg)] px-4 py-10 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <AuthShowcase />
        <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-4 shadow-[var(--card-shadow-soft)] sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthSplitLayout
