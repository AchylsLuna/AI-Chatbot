import type { ReactNode } from 'react'
import AppLogoBadge from '../branding/AppLogoBadge'
import { softPanelClass } from '../../styles/uiClassNames'

type AuthSplitLayoutProps = {
  children: ReactNode
  layout?: 'split' | 'center'
  centerBorderless?: boolean
}

const AuthShowcase = () => (
  <div className="rounded-[2rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-6 shadow-[var(--card-shadow)] sm:p-7">
    <div className="flex items-center gap-3">
      <AppLogoBadge className="h-10 w-10" />
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[color:var(--agent-accent)]">
          AI Health Care
        </p>
        <p className="text-sm text-[color:var(--agent-muted)]">Clinical access and appointment operations</p>
      </div>
    </div>
    <div className="mt-8 space-y-4">
      <span className="agent-eyebrow">Secure entry</span>
      <h1 className="font-serif text-4xl font-bold leading-[0.98] tracking-[-0.04em] text-[color:var(--agent-ink)] sm:text-5xl">
        Care operations with a calmer, clearer clinical interface.
      </h1>
      <p className="max-w-xl text-base leading-7 text-[color:var(--agent-muted)]">
        Sign in to continue with role-based access, appointment tracking, operational visibility,
        and staff workspace controls.
      </p>
    </div>

    <div className="mt-6 grid gap-3 lg:grid-cols-2">
      <article className={`${softPanelClass} p-4`}>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
          Role-aware routing
        </p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
          Patients, doctors, and administrators are guided into the correct workspace without extra steps.
        </p>
      </article>
      <article className={`${softPanelClass} p-4`}>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
          Protected sessions
        </p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
          Session checks, OTP flows, and logout safeguards stay intact while the UI becomes more legible.
        </p>
      </article>
      <article className={`${softPanelClass} p-4`}>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
          Faster daily use
        </p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
          Cleaner fields, clearer hierarchy, and stronger feedback reduce friction for repeat workflows.
        </p>
      </article>
      <article className={`${softPanelClass} p-4`}>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
          Clinical visual language
        </p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
          Warm neutrals, disciplined contrast, and measured accent color create a more professional product feel.
        </p>
      </article>
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
      ? 'w-full p-5 sm:p-7'
      : 'w-full rounded-[1.7rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-5 shadow-[var(--card-shadow)] sm:p-7'
    return (
      <div className="min-h-screen bg-[color:var(--agent-bg)] px-4 py-8 text-[color:var(--agent-ink)] sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center justify-center">
          <div className={centerCardClass}>
            {children}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[color:var(--agent-bg)] px-4 py-8 text-[color:var(--agent-ink)] sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <AuthShowcase />
        <div className="rounded-[1.7rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-5 shadow-[var(--card-shadow)] sm:p-7">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthSplitLayout
