import type { AppPage } from '../../types/navigation'

type AppHeaderProps = {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onNavigate: (page: AppPage) => void
}

const AppHeader = ({ theme, onToggleTheme, onNavigate }: AppHeaderProps) => (
  <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--agent-bg)] shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
    <div className="mx-auto w-full max-w-6xl px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={() => onNavigate('landing')} className="flex items-center gap-3 text-left">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 shadow-lg shadow-black/40">
            <svg
              className="h-6 w-6 text-[color:var(--agent-accent)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h4l2-3 3 6 2-3h5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">AI Health Care</p>
            <p className="text-xs text-white/50">Decision Tree triage management</p>
          </div>
        </button>

        <nav className="flex flex-wrap items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={() => onNavigate('triage')}
            className="rounded-full bg-[color:var(--agent-accent)] px-5 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] shadow-lg transition hover:-translate-y-0.5"
          >
            Get Started
          </button>
          <button
            onClick={() => onNavigate('login')}
            className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Log in
          </button>
        </nav>
      </div>
    </div>
  </header>
)

export default AppHeader
