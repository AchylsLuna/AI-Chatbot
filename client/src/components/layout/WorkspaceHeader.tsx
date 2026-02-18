import type { AppPage } from '../../types/navigation'
import type { AuthSession } from '../../types'
import { getWorkspaceRoleLabel } from '../../utils/roles'

type WorkspaceHeaderProps = {
  authUser: AuthSession['user']
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
  onLogout: () => void
}

const controlPillClass =
  'inline-flex items-center gap-2 rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-3.5 py-2 text-xs font-semibold text-[color:var(--agent-ink)] transition hover:bg-[color:var(--agent-overlay)]'

const WorkspaceHeader = ({
  authUser,
  currentPage,
  onNavigate,
  onLogout,
}: WorkspaceHeaderProps) => (
  <header className="sticky top-0 z-50 border-b border-[color:var(--card-border)] bg-[color:var(--agent-bg)]/96 backdrop-blur">
    <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate('landing')}
        className="text-left"
        aria-label="Go to landing page"
      >
        <p className="text-sm font-semibold text-[color:var(--agent-ink)]">AI Health Care</p>
        <p className="text-xs text-[color:var(--agent-muted)]">
          {getWorkspaceRoleLabel(authUser.role)} workspace · {currentPage.replace('_', ' ')}
        </p>
      </button>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onLogout} className={controlPillClass}>
          Logout
        </button>
      </div>
    </div>
  </header>
)

export default WorkspaceHeader
