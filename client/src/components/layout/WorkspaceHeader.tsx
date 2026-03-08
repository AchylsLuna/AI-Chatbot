import type { AppPage } from '../../types/navigation'
import type { AuthSession } from '../../types'
import { getWorkspaceRoleLabel } from '../../utils/roles'
import AppLogoBadge from '../branding/AppLogoBadge'

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
    className="sticky top-0 z-[45] border-b border-[color:var(--card-border)] bg-[color:var(--agent-bg)]"
  >
    <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <button
        type="button"
        onClick={() => onNavigate('landing')}
        className="inline-flex items-center gap-3 text-left"
        aria-label="Go to landing page"
      >
        <AppLogoBadge className="h-9 w-9" />
        <div>
          <p className="text-sm font-extrabold text-[color:var(--agent-ink)]">AI Health Care</p>
          <p className="text-xs text-[color:var(--agent-muted)]">{getWorkspaceRoleLabel(authUser.role)} workspace</p>
        </div>
      </button>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted)]">
        <span>{currentPage.replace('_', ' ')}</span>
        <span className="h-1 w-1 rounded-full bg-[color:var(--agent-muted-soft)]" />
        <span>{authUser.username}</span>
      </div>
    </div>
  </header>
)

export default WorkspaceHeader
