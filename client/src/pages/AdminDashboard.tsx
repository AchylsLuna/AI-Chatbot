import { useEffect, useMemo, useState } from 'react'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../components/layout/Sidebar'
import SidebarAccountCard from '../components/layout/SidebarAccountCard'
import WorkspaceTopShell from '../components/layout/WorkspaceTopShell'
import {
  workspaceFieldClass,
  workspaceGhostButtonClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePrimaryButtonClass,
} from '../styles/workspaceUi'
import type { AppPage } from '../types/navigation'
import type { AuthSession } from '../types'
import { formatRoleLabel, getWorkspaceRoleLabel } from '../utils/roles'

type AdminDashboardProps = {
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
  onLogout: () => void
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

type AdminSection = 'settings' | 'controls'
type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

const primaryItems: SidebarItem[] = [
  { key: 'settings', label: 'Settings', caption: 'Account and security', icon: 'settings' },
  { key: 'controls', label: 'Controls', caption: 'Navigation and sign out', icon: 'settings' },
]

const utilityItems: SidebarItem[] = [
  {
    key: 'doctor_dashboard',
    label: 'Appointment board',
    caption: 'Back to staff operations',
    icon: 'calendar',
  },
  {
    key: 'landing',
    label: 'Landing',
    caption: 'Public overview page',
    icon: 'report',
  },
]

const notificationPrefKey = 'pulse-ledger-admin-notification-preferences'
const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  browserAlerts: true,
  appointmentReminders: true,
  securityAlerts: true,
}

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return true
}

const AdminDashboard = ({
  authUser,
  onNavigate,
  onLogout,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: AdminDashboardProps) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('settings')
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    if (typeof window === 'undefined') return defaultNotificationPrefs
    const stored = window.localStorage.getItem(notificationPrefKey)
    if (!stored) return defaultNotificationPrefs
    try {
      return { ...defaultNotificationPrefs, ...JSON.parse(stored) }
    } catch {
      return defaultNotificationPrefs
    }
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(notificationPrefKey, JSON.stringify(notificationPrefs))
  }, [notificationPrefs])

  const quickLinks = useMemo(
    () => [
      {
        key: 'doctor_dashboard',
        label: 'Open appointment operations board',
        detail: 'Return to nurse/doctor appointment workflow.',
      },
      {
        key: 'landing',
        label: 'Open landing page',
        detail: 'Go back to the public product overview.',
      },
      {
        key: 'logout',
        label: 'Logout',
        detail: 'End the privileged session immediately.',
      },
    ],
    []
  )

  const filteredLinks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return quickLinks
    return quickLinks.filter((item) => {
      return item.label.toLowerCase().includes(query) || item.detail.toLowerCase().includes(query)
    })
  }, [quickLinks, searchQuery])

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="grid items-start gap-6 xl:grid-cols-[17.75rem_minmax(0,1fr)]">
          <Sidebar
            variant="dashboard"
            className="xl:self-start"
            heightMode="viewport"
            stickyOffset="header"
            brandTitle="AI Health Care"
            brandSubtitle="Admin workspace"
            onBrandClick={() => onNavigate?.('landing')}
            sectionLabel="Primary"
            items={primaryItems}
            activeKey={activeSection}
            onSelect={(key) => {
              if (key === 'settings' || key === 'controls') {
                setActiveSection(key)
              }
            }}
            auxiliaryLabel="Utilities"
            secondaryItems={utilityItems}
            supportItem={{ key: 'logout', label: 'Logout', icon: 'shield' }}
            onSelectAuxiliary={(key) => {
              if (key === 'logout') {
                onLogout()
                return
              }
              if (key === 'doctor_dashboard') {
                onNavigate?.('doctor_dashboard')
                return
              }
              if (key === 'landing') {
                onNavigate?.('landing')
              }
            }}
            profileExtra={
              <div className="space-y-2.5">
                <SidebarAccountCard
                  username={authUser?.username ?? 'Unknown'}
                  roleLabel={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                  sessionStatus={sessionStatus}
                  theme={theme}
                  onToggleTheme={onToggleTheme}
                  dataMaskingEnabled={dataMaskingEnabled}
                  onToggleDataMasking={onToggleDataMasking}
                />
                <button
                  type="button"
                  className={`${workspaceGhostButtonClass} w-full`}
                  onClick={onLogout}
                >
                  Logout
                </button>
              </div>
            }
          />

          <section className="space-y-6">
            {activeSection !== 'settings' ? (
              <WorkspaceTopShell
                eyebrow="Privileged session"
                title="Admin Workspace"
                description="Minimal privileged shell aligned with the shared dashboard UI. Keep this session focused and short-lived."
                searchValue={searchQuery}
                searchPlaceholder="Search available actions"
                onSearchChange={setSearchQuery}
                quickActions={
                  <>
                    <button
                      type="button"
                      className={workspacePrimaryButtonClass}
                      onClick={() => onNavigate?.('doctor_dashboard')}
                    >
                      Open appointment board
                    </button>
                    <button type="button" className={workspaceGhostButtonClass} onClick={onLogout}>
                      Logout
                    </button>
                  </>
                }
                metrics={[
                  { key: 'session', label: 'Session', value: 'Active' },
                  { key: 'role', label: 'Role', value: formatRoleLabel(authUser?.role) },
                  { key: 'actions', label: 'Actions', value: filteredLinks.length },
                  { key: 'scope', label: 'Scope', value: 'Frontend only' },
                ]}
              />
            ) : null}

            {activeSection === 'settings' ? (
              <section className="reference-card p-5">
                <h2 className="reference-section-title">Account settings</h2>
                <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="reference-card-soft p-4">
                    <p className="text-sm text-[color:var(--agent-muted)]">
                      Signed in as{' '}
                      <span className="font-semibold text-[color:var(--agent-ink)]">
                        {authUser?.username ?? 'Unknown'}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                      Role:{' '}
                      <span className="font-semibold text-[color:var(--agent-ink)]">
                        {getWorkspaceRoleLabel(authUser?.role)} workspace
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--agent-muted-soft)]">
                      {formatRoleLabel(authUser?.role)}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--agent-muted-soft)]">
                      Session: {sessionStatus}
                    </p>
                  </div>

                  <div className="reference-card-soft p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                      Quick controls
                    </p>
                    <div className="mt-3 grid gap-2">
                      <button type="button" className={workspaceGhostButtonClass} onClick={onToggleTheme}>
                        Theme: {theme === 'dark' ? 'Dark' : 'Light'}
                      </button>
                      <button type="button" className={workspaceGhostButtonClass} onClick={onToggleDataMasking}>
                        Data masking: {dataMaskingEnabled ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>

                  <div className="reference-card-soft p-4 xl:col-span-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                      Notifications
                    </p>
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
                            onClick={() =>
                              setNotificationPrefs((prev) => ({ ...prev, [prefKey]: !prev[prefKey] }))
                            }
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

                  <form
                    className="reference-card-soft p-4 xl:col-span-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      setPasswordError(null)
                      setPasswordMessage(null)

                      if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
                        setPasswordError('Fill in current, new, and confirm password.')
                        return
                      }
                      if (!meetsPasswordPolicy(newPassword.trim())) {
                        setPasswordError(
                          'New password must be at least 8 characters and include uppercase, lowercase, and number.'
                        )
                        return
                      }
                      if (newPassword.trim() !== confirmPassword.trim()) {
                        setPasswordError('New password and confirm password do not match.')
                        return
                      }

                      setPasswordMessage('Password updated successfully for this session.')
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                      Change password
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        placeholder="Current password"
                        className={workspaceFieldClass}
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="New password"
                        className={workspaceFieldClass}
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Confirm password"
                        className={workspaceFieldClass}
                      />
                    </div>
                    {passwordError ? <p className="mt-3 text-xs font-semibold text-rose-500">{passwordError}</p> : null}
                    {passwordMessage ? (
                      <p className="mt-3 text-xs font-semibold text-emerald-600">{passwordMessage}</p>
                    ) : null}
                    <button type="submit" className={`mt-4 ${workspacePrimaryButtonClass}`}>
                      Update password
                    </button>
                  </form>
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                {filteredLinks.map((item) => (
                  <article key={item.key} className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>{item.label}</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>{item.detail}</p>
                    <div className="mt-4">
                      {item.key === 'logout' ? (
                        <button type="button" className={workspacePrimaryButtonClass} onClick={onLogout}>
                          Logout
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={workspaceGhostButtonClass}
                          onClick={() => onNavigate?.(item.key as AppPage)}
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {filteredLinks.length === 0 ? (
                  <article className={`${workspacePanelClass} p-6`}>
                    <p className={`text-sm ${workspaceMutedTextClass}`}>
                      No actions match your search query.
                    </p>
                  </article>
                ) : null}
              </section>
            )}
          </section>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default AdminDashboard
