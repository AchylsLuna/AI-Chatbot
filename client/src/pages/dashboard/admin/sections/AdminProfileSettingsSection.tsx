import ProfileAvatarSettingsCard from '../../../../components/profile/ProfileAvatarSettingsCard'
import { workspaceMutedTextClass, workspacePanelClass, workspaceSubtleTextClass } from '../../../../styles/workspaceUi'
import type { AuthSession } from '../../../../types'
import { getWorkspaceRoleLabel } from '../../../../utils/roles'

type AdminProfileSettingsSectionProps = {
  authUser: AuthSession['user'] | null
  sessionStatus: string
}

const AdminProfileSettingsSection = ({ authUser, sessionStatus }: AdminProfileSettingsSectionProps) => {
  return (
    <section className="space-y-4">
      <article className={`${workspacePanelClass} p-5`}>
        <h2 className="text-2xl font-semibold text-[color:var(--agent-ink)]">Profile settings</h2>
        <p className={`mt-2 text-sm ${workspaceMutedTextClass}`}>
          Manage profile identity for the admin workspace.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="reference-card-soft p-3">
            <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Account</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--agent-ink)]">{authUser?.username ?? 'Unknown'}</p>
          </div>
          <div className="reference-card-soft p-3">
            <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Workspace role</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--agent-ink)]">
              {getWorkspaceRoleLabel(authUser?.role)}
            </p>
          </div>
          <div className="reference-card-soft p-3">
            <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Session</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--agent-ink)]">{sessionStatus}</p>
          </div>
        </div>
      </article>

      <ProfileAvatarSettingsCard
        username={authUser?.username ?? 'Unknown'}
        role={authUser?.role ?? null}
        title="Profile photo"
        description="Upload or replace your profile photo for admin workspace identity."
      />
    </section>
  )
}

export default AdminProfileSettingsSection
