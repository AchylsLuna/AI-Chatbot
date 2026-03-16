import type { AppPage } from '../../types/navigation'
import AppLogoBadge from '../branding/AppLogoBadge'
import { chipButtonClass } from '../../styles/uiClassNames'

type AppHeaderProps = {
  onNavigate: (page: AppPage) => void
}

const AppHeader = ({ onNavigate }: AppHeaderProps) => (
  <header className="sticky top-0 z-50 border-b border-[color:var(--card-border)] bg-[color:var(--agent-bg)]">
    <div className="mx-auto flex w-full max-w-[84rem] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <button
        onClick={() => onNavigate('landing')}
        className="inline-flex items-center gap-3 text-left"
        aria-label="Go to landing page"
      >
        <AppLogoBadge className="h-9 w-9" />
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-[color:var(--agent-ink)]">AI Health Care</p>
          <p className="text-xs text-[color:var(--agent-muted)]">Appointments and care workflows</p>
        </div>
      </button>

      <nav className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => onNavigate('appointments')} className={chipButtonClass}>
          Appointments
        </button>
        <button onClick={() => onNavigate('login')} className={chipButtonClass}>
          Login
        </button>
        <button
          onClick={() => onNavigate('signup')}
          className="agent-button px-4 py-2 text-xs text-[color:var(--agent-on-accent)]"
        >
          Sign up
        </button>
      </nav>
    </div>
  </header>
)

export default AppHeader
