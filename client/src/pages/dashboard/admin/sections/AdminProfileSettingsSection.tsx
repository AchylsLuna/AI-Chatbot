import ProfileAvatarSettingsCard from '../../../../components/profile/ProfileAvatarSettingsCard'
import { pageMutedTextClass, pagePanelClass, pageSubtleTextClass } from '../../../../styles/pageUi'
import type { AuthSession } from '../../../../types'
import { getRoleLabel } from '../../../../utils/roles'

type AdminProfileSettingsSectionProps = {
  authUser: AuthSession['user'] | null
  sessionStatus: string
}

const AdminProfileSettingsSection = ({ authUser, sessionStatus }: AdminProfileSettingsSectionProps) => {
  return (
    <section className="space-y-4">
      <article className={`${pagePanelClass} p-5`}>
        <h2 className="text-2xl font-semibold text-[color:var(--agent-ink)]">Profile settings</h2>
        <p className={`mt-2 text-sm ${pageMutedTextClass}`}>
          Manage profile identity for the admin account.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="reference-card-soft p-3">
            <p className={`text-xs uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>Account</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--agent-ink)]">{authUser?.username ?? 'Unknown'}</p>
          </div>
          <div className="reference-card-soft p-3">
            <p className={`text-xs uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>Role</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--agent-ink)]">
              {getRoleLabel(authUser?.role)}
            </p>
          </div>
          <div className="reference-card-soft p-3">
            <p className={`text-xs uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>Session</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--agent-ink)]">{sessionStatus}</p>
          </div>
        </div>
      </article>

      <ProfileAvatarSettingsCard
        username={authUser?.username ?? 'Unknown'}
        role={authUser?.role ?? null}
        title="Profile photo"
        description="Upload or replace your profile photo for admin account identity."
      />
    </section>
  )
}

export default AdminProfileSettingsSection
