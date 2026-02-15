import type { ReactNode } from 'react'
import AppLogoBadge from '../branding/AppLogoBadge'

type AuthSplitLayoutProps = {
  children: ReactNode
  layout?: 'split' | 'center'
}

const AuthShowcase = () => (
  <div className="space-y-8" data-reveal>
    <div className="flex items-center gap-3">
      <AppLogoBadge className="h-11 w-11" />
      <span className="text-lg font-semibold tracking-wide">AI Health Care</span>
    </div>

    <div className="space-y-4">
      <h1 className="text-4xl font-display font-semibold leading-tight text-white md:text-5xl">
        Your AI-Powered Health Companion
      </h1>
      <p className="max-w-xl text-base text-white/60">
        Intelligent diagnostics, personalized insights, and proactive wellness - all powered by
        advanced artificial intelligence.
      </p>
    </div>
  </div>
)

const AuthSplitLayout = ({ children, layout = 'split' }: AuthSplitLayoutProps) => {
  if (layout === 'center') {
    return (
      <div className="auth-shell">
        <div className="pointer-events-none absolute inset-0">
          <div className="auth-orb auth-orb--a animate-drift" />
          <div className="auth-orb auth-orb--b animate-drift-slow" />
          <div className="auth-orb auth-orb--c animate-float-slow" />
          <div className="auth-vignette" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
          <div className="w-full p-1 sm:p-2" data-reveal>
            {children}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <div className="pointer-events-none absolute inset-0">
        <div className="auth-orb auth-orb--a animate-drift" />
        <div className="auth-orb auth-orb--b animate-drift-slow" />
        <div className="auth-orb auth-orb--c animate-float-slow" />
        <div className="auth-vignette" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr]">
        <AuthShowcase />
        <div className="rounded-3xl agent-card p-8 backdrop-blur" data-reveal>
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthSplitLayout
