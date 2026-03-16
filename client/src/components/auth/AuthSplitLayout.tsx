import type { ReactNode } from 'react'
import AppLogoBadge from '../branding/AppLogoBadge'
import healthHeroImage from '../../assets/auth/health-ai-hero.jpg'

type AuthSplitLayoutProps = {
  children: ReactNode
  layout?: 'split' | 'center'
  centerBorderless?: boolean
  variant?: 'default' | 'lovable'
}

const AuthShowcase = () => (
  <div className="rounded-[1.6rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-6 shadow-[var(--card-shadow-soft)] sm:p-7">
    <div className="flex items-center gap-3">
      <AppLogoBadge className="h-10 w-10" />
      <div>
        <p className="text-sm font-extrabold text-[color:var(--agent-ink)]">AI Health Care</p>
        <p className="text-xs text-[color:var(--agent-muted)]">Clinical access and appointment operations</p>
      </div>
    </div>
    <h1 className="mt-6 max-w-[16ch] text-3xl font-semibold leading-tight text-[color:var(--agent-ink)] sm:text-4xl">
      Secure access for appointment and care workflows
    </h1>
    <p className="mt-3 max-w-[46ch] text-sm leading-7 text-[color:var(--agent-muted)]">
      Sign in to continue with role-based access, appointment tracking, and staff dashboards.
    </p>
  </div>
)

const AuthSplitLayout = ({
  children,
  layout = 'split',
  centerBorderless = false,
  variant = 'default',
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

  if (variant === 'lovable') {
    return (
      <div className="auth-lovable-root min-h-screen">
        <div className="flex min-h-screen">
          <section className="auth-lovable-showcase hidden lg:flex lg:w-1/2">
            <div className="auth-lovable-showcase-media">
              <img src={healthHeroImage} alt="AI healthcare" className="h-full w-full object-cover opacity-40" />
              <div className="auth-lovable-showcase-overlay" />
            </div>

            <div className="auth-lovable-showcase-content">
              <div className="mb-8 flex items-center gap-3">
                <div className="auth-lovable-brand-icon pulse-ring">
                  <AppLogoBadge className="h-6 w-6" />
                </div>
                <span className="auth-lovable-brand-name">AI Health Care</span>
              </div>
              <h1 className="auth-lovable-heading">
                Secure access for appointment and care workflows
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[color:var(--auth-lovable-muted)]">
                Sign in to continue with role-based access, appointment tracking, and staff
                dashboards.
              </p>

              <div className="auth-lovable-preview-grid">
                <div className="auth-lovable-preview-card">
                  <p className="auth-lovable-preview-label">Patient</p>
                  <p className="auth-lovable-preview-title">Book Appointment</p>
                  <p className="auth-lovable-preview-copy">
                    Schedule care, review history, and manage reminders.
                  </p>
                </div>
                <div className="auth-lovable-preview-card">
                  <p className="auth-lovable-preview-label">Verification</p>
                  <p className="auth-lovable-preview-title">OTP before access</p>
                  <p className="auth-lovable-preview-copy">
                    Protected routes stay locked until the session is verified.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="auth-lovable-form-wrap w-full lg:w-1/2">
            <div className="auth-lovable-form-inner">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <div className="auth-lovable-mobile-icon">
                  <AppLogoBadge className="h-5 w-5" />
                </div>
                <span className="auth-lovable-mobile-brand">AI Health Care</span>
              </div>
              <div className="auth-lovable-card w-full max-w-md">
                {children}
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[color:var(--agent-bg)] px-4 py-8 text-[color:var(--agent-ink)] sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-5 lg:grid-cols-[1fr_0.94fr]">
        <AuthShowcase />
        <div className="rounded-[1.35rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-5 shadow-[var(--card-shadow-soft)] sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthSplitLayout
