import type { AppPage } from '../../types/navigation'
import AppLogoBadge from '../branding/AppLogoBadge'

type AppHeaderProps = {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onNavigate: (page: AppPage) => void
}

const navButtonClass =
  'rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-ink)] transition hover:bg-[color:var(--agent-overlay)]'

const AppHeader = ({ theme, onToggleTheme, onNavigate }: AppHeaderProps) => (
  <header className="sticky top-0 z-40 border-b border-[color:var(--card-border)] bg-[color:var(--agent-bg)]/96 backdrop-blur">
    <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <button
        onClick={() => onNavigate('landing')}
        className="group flex items-center gap-2.5 text-left"
        aria-label="Go to landing page"
      >
        <AppLogoBadge className="h-9 w-9" />
        <div>
          <p className="text-sm font-semibold text-[color:var(--agent-ink)]">AI Health Care</p>
          <p className="text-xs text-[color:var(--agent-muted)]">Appointments and care workflows</p>
        </div>
      </button>

      <nav className="flex flex-wrap items-center gap-2">
        <button onClick={onToggleTheme} className={navButtonClass}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button onClick={() => onNavigate('appointments')} className={navButtonClass}>
          Appointments
        </button>
        <button onClick={() => onNavigate('login')} className={navButtonClass}>
          Login
        </button>
        <button
          onClick={() => onNavigate('signup')}
          className="rounded-full bg-[color:var(--agent-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:bg-[color:var(--agent-accent-strong)]"
        >
          Sign up
        </button>
      </nav>
    </div>
  </header>
)

export default AppHeader
