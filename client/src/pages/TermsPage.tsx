import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'

type TermsPageProps = {
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
}

const TermsPage = ({ onNavigate, onGoBack }: TermsPageProps) => {
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
          <h1 className="auth-lovable-title">Terms and Conditions</h1>
          <p className="auth-lovable-subtitle">
            Review the rules and responsibilities that apply when using the platform.
          </p>

          <article className="mt-6 rounded-[1.6rem] border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface)] p-6 shadow-[var(--card-shadow-soft)] sm:p-8">
            <p className="text-sm leading-7 text-[color:var(--auth-lovable-muted)]">
              By creating an account, you agree to use this platform responsibly and provide accurate,
              up-to-date information.
            </p>

            <h2 className="mt-6 text-lg font-semibold text-[color:var(--auth-lovable-ink)]">Key Terms</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[color:var(--auth-lovable-muted)]">
              <li>Use only your own account and keep your credentials secure.</li>
              <li>Do not submit false, malicious, or unauthorized medical information.</li>
              <li>Follow all applicable healthcare and privacy laws in your jurisdiction.</li>
              <li>Platform access may be suspended for policy or security violations.</li>
            </ul>

            <p className="mt-6 text-sm leading-7 text-[color:var(--auth-lovable-muted)]">
              Continued use of the service means acceptance of these terms and any lawful updates.
            </p>
          </article>
      </div>
    </AuthSplitLayout>
  )
}

export default TermsPage
