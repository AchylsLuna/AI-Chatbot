import type { AppPage } from '../types/navigation'

type TermsPageProps = {
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
}

const TermsPage = ({ onNavigate, onGoBack }: TermsPageProps) => {
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
            <h1 className="text-2xl font-semibold text-[color:var(--agent-ink)]">Terms and Conditions</h1>
            <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">
              By creating an account, you agree to use this platform responsibly and provide accurate,
              up-to-date information.
            </p>

            <h2 className="mt-6 text-lg font-semibold text-[color:var(--agent-ink)]">Key Terms</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[color:var(--agent-muted)]">
              <li>Use only your own account and keep your credentials secure.</li>
              <li>Do not submit false, malicious, or unauthorized medical information.</li>
              <li>Follow all applicable healthcare and privacy laws in your jurisdiction.</li>
              <li>Platform access may be suspended for policy or security violations.</li>
            </ul>

            <p className="mt-6 text-sm leading-7 text-[color:var(--agent-muted)]">
              Continued use of the service means acceptance of these terms and any lawful updates.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

export default TermsPage
