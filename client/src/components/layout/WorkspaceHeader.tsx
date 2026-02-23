import type { AppPage } from '../../types/navigation'
import type { AuthSession } from '../../types'
import { getWorkspaceRoleLabel } from '../../utils/roles'

type WorkspaceHeaderProps = {
  authUser: AuthSession['user']
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
}

const WorkspaceHeader = ({
  authUser,
  currentPage,
  onNavigate,
}: WorkspaceHeaderProps) => (
  <header
    data-workspace-header="true"
    className="sticky top-0 z-50 border-b border-[color:var(--card-border)] bg-[color:var(--agent-bg)]/96 backdrop-blur"
  >
    <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
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
    </div>
  </header>
)

export default WorkspaceHeader
