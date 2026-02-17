import {
  workspaceGhostButtonClass,
  workspaceMutedTextClass,
  workspacePanelSoftClass,
  workspaceSubtleTextClass,
} from '../../styles/workspaceUi'

type SidebarAccountCardProps = {
  username: string
  roleLabel: string
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

const SidebarAccountCard = ({
  username,
  roleLabel,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: SidebarAccountCardProps) => (
  <div className={`${workspacePanelSoftClass} p-3.5`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
      Account settings
    </p>

    <div className="mt-2.5 space-y-1.5">
      <p className={`text-xs ${workspaceMutedTextClass}`}>
        Signed in as <span className="font-semibold text-[color:var(--agent-ink)]">{username}</span>
      </p>
      <p className={`text-xs ${workspaceSubtleTextClass}`}>{roleLabel}</p>
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
    </div>
  </div>
)

export default SidebarAccountCard
