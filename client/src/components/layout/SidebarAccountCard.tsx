import {
  workspaceGhostButtonClass,
  workspaceMutedTextClass,
  workspacePanelSoftClass,
  workspaceSubtleTextClass,
} from '../../styles/workspaceUi'
import { getAvatarInitials } from '../../utils/profileAvatar'

type SidebarAccountCardProps = {
  username: string
  roleLabel: string
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
  avatarUrl?: string | null
  onOpenProfileSettings?: () => void
}

const SidebarAccountCard = ({
  username,
  roleLabel,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
  avatarUrl,
  onOpenProfileSettings,
}: SidebarAccountCardProps) => (
  <div className={`${workspacePanelSoftClass} p-3.5`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
      Account settings
    </p>

    <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-2.5">
      <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] text-sm font-semibold text-[color:var(--agent-ink)]">
        {avatarUrl ? (
          <img src={avatarUrl} alt={`${username} avatar`} className="h-full w-full object-cover" />
        ) : (
          getAvatarInitials(username, 'U')
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[color:var(--agent-ink)]">{username}</p>
        <p className={`truncate text-xs ${workspaceSubtleTextClass}`}>{roleLabel}</p>
      </div>
    </div>

    <div className="mt-2.5 space-y-1.5">
      <p className={`text-xs ${workspaceMutedTextClass}`}>
        Session: <span className="font-semibold text-[color:var(--agent-ink)]">{sessionStatus}</span>
      </p>
      <p className={`text-xs ${workspaceMutedTextClass}`}>
        Data masking:{' '}
        <span className="font-semibold text-[color:var(--agent-ink)]">
          {dataMaskingEnabled ? 'On' : 'Off'}
        </span>
      </p>
    </div>

    <div className="mt-3 grid gap-2">
      <button type="button" onClick={onToggleTheme} className={`${workspaceGhostButtonClass} w-full`}>
        Theme: {theme === 'dark' ? 'Dark' : 'Light'}
      </button>
      <button
        type="button"
        onClick={onToggleDataMasking}
        className={`${workspaceGhostButtonClass} w-full`}
      >
        {dataMaskingEnabled ? 'Turn masking off' : 'Turn masking on'}
      </button>
      {onOpenProfileSettings ? (
        <button type="button" onClick={onOpenProfileSettings} className={`${workspaceGhostButtonClass} w-full`}>
          Open profile settings
        </button>
      ) : null}
    </div>
  </div>
)

export default SidebarAccountCard
