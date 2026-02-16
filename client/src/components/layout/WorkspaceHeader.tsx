import { useEffect, useRef, useState } from 'react'
import AppLogoBadge from '../branding/AppLogoBadge'
import type { AppPage } from '../../types/navigation'
import type { AuthSession } from '../../types/triage'
import { formatRoleLabel } from '../../utils/roles'

type WorkspaceHeaderProps = {
  authUser: AuthSession['user']
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
  onLogout: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
  securityStatus: {
    encryption: string
    session: string
    provider: 'local' | 'auth0'
    mfa: boolean
    biometricReady: boolean
  }
}

type HeaderNotification = {
  id: string
  label: string
  detail: string
  read: boolean
}

const buildNotifications = (
  role: AuthSession['user']['role'],
  currentPage: AppPage
): HeaderNotification[] => [
  {
    id: 'n-appointments',
    label: 'Appointment status updated',
    detail: currentPage === 'appointments' ? 'You are viewing the latest booking status.' : 'New booking status is available.',
    read: false,
  },
  {
    id: 'n-role',
    label: 'Workspace access active',
    detail: `${formatRoleLabel(role)} workspace permissions are synced.`,
    read: false,
  },
  {
    id: 'n-security',
    label: 'Security check passed',
    detail: 'Session and access checks are active.',
    read: true,
  },
]

const WorkspaceHeader = ({
  authUser,
  currentPage,
  onNavigate,
  onLogout,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
  securityStatus,
}: WorkspaceHeaderProps) => {
  const headerButtonClass =
    'relative rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-2 text-xs font-semibold text-[color:var(--agent-ink)]/85 transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-overlay-strong)] hover:text-[color:var(--agent-ink)]'
  const pillClass =
    'rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-ink)]/85 transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-overlay-strong)] hover:text-[color:var(--agent-ink)]'
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifWrapRef = useRef<HTMLDivElement | null>(null)
  const [notifications, setNotifications] = useState<HeaderNotification[]>(
    () => buildNotifications(authUser.role, currentPage)
  )
  const unreadCount = notifications.filter((item) => !item.read).length

  useEffect(() => {
    if (!isNotifOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (notifWrapRef.current?.contains(target)) return
      setIsNotifOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotifOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isNotifOpen])

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--card-border)] bg-[color:var(--agent-bg)]/92 shadow-[0_12px_28px_rgba(4,10,22,0.22)] backdrop-blur-xl">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="group flex items-center gap-3 text-left"
          aria-label="Go to landing page"
        >
          <AppLogoBadge className="h-10 w-10" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--agent-ink)]">AI Health Care</p>
            <p className="text-xs text-[color:var(--agent-muted)]">{formatRoleLabel(authUser.role)} workspace</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-2 text-[11px] text-[color:var(--agent-ink)]/80 lg:flex">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-semibold">{securityStatus.session}</span>
            <span className="text-[color:var(--agent-muted)]">| {securityStatus.encryption}</span>
            <span className="rounded-full border border-[color:var(--card-border)] px-2 py-0.5 uppercase tracking-[0.08em]">
              {securityStatus.provider}
            </span>
            <span className="text-[color:var(--agent-muted)]">
              {securityStatus.mfa ? 'MFA on' : 'MFA pending'}
              {securityStatus.biometricReady ? ' · Biometric ready' : ''}
            </span>
          </div>

          <div ref={notifWrapRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              className={headerButtonClass}
              aria-label="Open notifications"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-[color:var(--agent-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--agent-on-accent)]">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 top-12 z-50 w-[18rem] rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-3 shadow-[0_20px_45px_rgba(0,0,0,0.38)]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted)]">
                    Notifications
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
                    }
                    className="text-[11px] font-semibold text-[color:var(--agent-accent)]"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="space-y-2">
                  {notifications.map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-xl border p-2.5 ${
                        item.read
                          ? 'border-[color:var(--card-border)] bg-[color:var(--agent-overlay)]'
                          : 'border-[color:var(--agent-accent)]/40 bg-[color:var(--agent-accent)]/10'
                      }`}
                    >
                      <p className="text-xs font-semibold text-[color:var(--agent-ink)]">{item.label}</p>
                      <p className="mt-1 text-[11px] text-[color:var(--agent-muted)]">{item.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className={pillClass}
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

          <button
            type="button"
            onClick={onToggleDataMasking}
            className={pillClass}
            aria-label="Toggle data masking mode"
            title="Toggle HIPAA data masking"
          >
            <span className="inline-flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2 4 6v6c0 5.5 3.5 8.7 8 10 4.5-1.3 8-4.5 8-10V6z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              {dataMaskingEnabled ? 'Masking on' : 'Masking off'}
            </span>
          </button>

          <span className="hidden rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-1 text-[11px] font-semibold text-[color:var(--agent-ink)]/75 sm:inline-flex">
            {authUser.username}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className={pillClass}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}

export default WorkspaceHeader
