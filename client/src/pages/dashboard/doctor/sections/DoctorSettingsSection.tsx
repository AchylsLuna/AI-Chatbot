import type { FormEvent } from 'react'
import { pageFieldClass, pageGhostButtonClass, pagePrimaryButtonClass } from '../../../../styles/pageUi'
import type { AuthSession } from '../../../../types'
import { formatRoleLabel, getRoleLabel } from '../../../../utils/roles'

type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

type DoctorSettingsSectionProps = {
  authUser: AuthSession['user'] | null
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  notificationPrefs: NotificationPreferences
  onToggleNotificationPref: (key: keyof NotificationPreferences) => void
  currentPassword: string
  newPassword: string
  confirmPassword: string
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void
  passwordError: string | null
  passwordMessage: string | null
}

const DoctorSettingsSection = ({
  authUser,
  sessionStatus,
  theme,
  onToggleTheme,
  notificationPrefs,
  onToggleNotificationPref,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onPasswordSubmit,
  passwordError,
  passwordMessage,
}: DoctorSettingsSectionProps) => {
  return (
    <section className="reference-card p-5">
      <h2 className="reference-section-title">Settings</h2>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="reference-card-soft p-4">
          <p className="text-sm text-[color:var(--agent-muted)]">
            Signed in as{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">{authUser?.username ?? 'Unknown'}</span>
          </p>
          <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
            Role:{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">
              {getRoleLabel(authUser?.role)}
            </span>
          </p>
          <p className="mt-1 text-xs text-[color:var(--agent-muted-soft)]">{formatRoleLabel(authUser?.role)}</p>
          <p className="mt-2 text-xs text-[color:var(--agent-muted-soft)]">Session: {sessionStatus}</p>
        </div>

        <div className="reference-card-soft p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">Quick controls</p>
          <div className="mt-3 grid gap-2">
            <button type="button" className={pageGhostButtonClass} onClick={onToggleTheme}>
              Theme: {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>
        </div>

        <div className="reference-card-soft p-4 xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">Notification channels</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { key: 'emailAlerts', label: 'Email alerts' },
              { key: 'browserAlerts', label: 'Browser alerts' },
              { key: 'appointmentReminders', label: 'Appointment reminders' },
              { key: 'securityAlerts', label: 'Security alerts' },
            ].map((item) => {
              const prefKey = item.key as keyof NotificationPreferences
              const active = notificationPrefs[prefKey]
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onToggleNotificationPref(prefKey)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)]'
                      : 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)] hover:border-[color:var(--agent-line)] hover:text-[color:var(--agent-ink)]'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <form className="reference-card-soft p-4 xl:col-span-2" onSubmit={onPasswordSubmit}>
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">Change password</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => onCurrentPasswordChange(event.target.value)}
              placeholder="Current password"
              className={pageFieldClass}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => onNewPasswordChange(event.target.value)}
              placeholder="New password"
              className={pageFieldClass}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
              placeholder="Confirm password"
              className={pageFieldClass}
            />
          </div>
          {passwordError ? <p className="mt-3 text-xs font-semibold text-rose-500">{passwordError}</p> : null}
          {passwordMessage ? <p className="mt-3 text-xs font-semibold text-emerald-600">{passwordMessage}</p> : null}
          <button type="submit" className={`mt-4 ${pagePrimaryButtonClass}`}>
            Update password
          </button>
        </form>
      </div>
    </section>
  )
}

export default DoctorSettingsSection
