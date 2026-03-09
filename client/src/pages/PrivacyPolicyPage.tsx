import type { AppPage } from '../types/navigation'

type PrivacyPolicyPageProps = {
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
}

const PrivacyPolicyPage = ({ onNavigate, onGoBack }: PrivacyPolicyPageProps) => {
  return (
    <section className="page-shell">
      <div className="page-wrap">
        <div className="mx-auto w-full max-w-4xl">
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

          <article className="agent-card mt-3 rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-semibold text-[color:var(--agent-ink)]">
              Privacy Policy (RA 10173)
            </h1>
            <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">
              Personal data is collected and processed in accordance with the Data Privacy Act of 2012
              (Republic Act No. 10173).
            </p>

            <h2 className="mt-6 text-lg font-semibold text-[color:var(--agent-ink)]">How Data Is Used</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[color:var(--agent-muted)]">
              <li>To create and secure your account.</li>
              <li>To support appointment, care, and operations workflows.</li>
              <li>To enforce session, authentication, and fraud-prevention controls.</li>
              <li>To comply with legal and regulatory obligations.</li>
            </ul>

            <h2 className="mt-6 text-lg font-semibold text-[color:var(--agent-ink)]">Your Rights</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">
              Subject to applicable law, you may request access, correction, or deletion of your personal
              information and may raise data privacy concerns through the support channels provided by this
              platform.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

export default PrivacyPolicyPage
