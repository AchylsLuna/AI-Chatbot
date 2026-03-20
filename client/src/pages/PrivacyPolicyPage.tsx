import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'

type PrivacyPolicyPageProps = {
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
}

const PrivacyPolicyPage = ({ onNavigate, onGoBack }: PrivacyPolicyPageProps) => {
  return (
    <AuthSplitLayout variant="lovable">
      <div className="auth-lovable-page">
          <button
            type="button"
            onClick={() => (onGoBack ? onGoBack() : onNavigate?.('signup'))}
            className="auth-lovable-back-link"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>

          <p className="auth-lovable-section-label">Legal</p>
          <h1 className="auth-lovable-title">
              Privacy Policy (RA 10173)
          </h1>
          <p className="auth-lovable-subtitle">
            Review how personal information is collected, used, and protected on the platform.
          </p>

          <article className="mt-6 rounded-[1.6rem] border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface)] p-6 shadow-[var(--card-shadow-soft)] sm:p-8">
            <p className="text-sm leading-7 text-[color:var(--auth-lovable-muted)]">
              Personal data is collected and processed in accordance with the Data Privacy Act of 2012
              (Republic Act No. 10173).
            </p>

            <h2 className="mt-6 text-lg font-semibold text-[color:var(--auth-lovable-ink)]">How Data Is Used</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[color:var(--auth-lovable-muted)]">
              <li>To create and secure your account.</li>
              <li>To support appointment, care, and operations workflows.</li>
              <li>To enforce session, authentication, and fraud-prevention controls.</li>
              <li>To comply with legal and regulatory obligations.</li>
            </ul>

            <h2 className="mt-6 text-lg font-semibold text-[color:var(--auth-lovable-ink)]">Your Rights</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--auth-lovable-muted)]">
              Subject to applicable law, you may request access, correction, or deletion of your personal
              information and may raise data privacy concerns through the support channels provided by this
              platform.
            </p>
          </article>
      </div>
    </AuthSplitLayout>
  )
}

export default PrivacyPolicyPage
