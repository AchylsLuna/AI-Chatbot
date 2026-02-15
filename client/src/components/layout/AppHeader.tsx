import type { AppPage } from '../../types/navigation'
import AppLogoBadge from '../branding/AppLogoBadge'

type AppHeaderProps = {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onNavigate: (page: AppPage) => void
}

const AppHeader = ({ theme, onToggleTheme, onNavigate }: AppHeaderProps) => (
  <header className="sticky top-0 z-40 border-b border-[color:var(--card-border)] bg-[color:var(--agent-bg)]/90 backdrop-blur-xl shadow-[0_10px_32px_rgba(7,21,41,0.14)]">
    <div className="mx-auto w-full max-w-7xl px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => onNavigate('landing')}
          className="group flex items-center gap-3 text-left"
          aria-label="Go to landing page"
        >
          <AppLogoBadge className="h-11 w-11 transition group-hover:-translate-y-0.5" />
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-[color:var(--agent-ink)]">
              AI Health Care
            </p>
            <p className="text-xs text-[color:var(--agent-muted)]">AI triage and immutable operations</p>
          </div>
        </button>

        <nav className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-ink)]/85 transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-overlay-strong)] hover:text-[color:var(--agent-ink)]"
          >
            {theme === 'dark' ? (
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.9 4.9 1.4 1.4" />
                <path d="m17.7 17.7 1.4 1.4" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m4.9 19.1 1.4-1.4" />
                <path d="m17.7 6.3 1.4-1.4" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 1 0 21 12.8Z" />
              </svg>
            )}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

          <button
            onClick={() => onNavigate('triage')}
            className="rounded-full bg-[color:var(--agent-accent)] px-5 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] shadow-[0_12px_24px_rgba(79,209,197,0.3)] transition hover:-translate-y-0.5 hover:bg-[color:var(--agent-accent-strong)]"
          >
            Launch Triage
          </button>

          <button
            onClick={() => onNavigate('login')}
            className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-5 py-2 text-xs font-semibold text-[color:var(--agent-ink)]/85 transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-overlay-strong)] hover:text-[color:var(--agent-ink)]"
          >
            Log in
          </button>

          <button
            onClick={() => onNavigate('signup')}
            className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-5 py-2 text-xs font-semibold text-[color:var(--agent-ink)]/85 transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-overlay-strong)] hover:text-[color:var(--agent-ink)]"
          >
            Register
          </button>
        </nav>
      </div>
    </div>
  </header>
)

export default AppHeader
