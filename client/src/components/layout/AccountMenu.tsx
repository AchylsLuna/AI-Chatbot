import { useEffect, useId, useMemo, useRef, useState } from 'react'

type AccountMenuProps = {
  profileName: string
  profileCaption?: string
  showNotifications?: boolean
  notificationCount?: number
  onSignOut: () => void
  variant?: 'reference' | 'staff'
}

const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

const buildInitials = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return 'U'
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
}

const AccountMenu = ({
  profileName,
  profileCaption,
  showNotifications = true,
  notificationCount = 0,
  onSignOut,
  variant = 'reference',
}: AccountMenuProps) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()

  const initials = useMemo(() => buildInitials(profileName), [profileName])
  const boundedNotificationCount = Math.min(Math.max(notificationCount, 0), 99)

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!rootRef.current?.contains(target)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMenuOpen(false)
      triggerRef.current?.focus()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('touchstart', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div
      ref={rootRef}
      className={`account-menu-root account-menu-root--${variant}`}
      data-account-menu-root="true"
    >
      {showNotifications ? (
        <button
          type="button"
          className="account-menu-bell"
          aria-label={`Notifications (${boundedNotificationCount})`}
        >
          <BellIcon />
          {boundedNotificationCount > 0 ? (
            <span className="account-menu-badge">{boundedNotificationCount}</span>
          ) : null}
        </button>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((previous) => !previous)}
      >
        <span className="account-menu-avatar">{initials}</span>
      </button>

      {menuOpen ? (
        <div id={menuId} role="menu" aria-label="Account menu" className="account-menu-dropdown">
          <div className="account-menu-dropdown-head">
            <p className="account-menu-dropdown-name">{profileName}</p>
            {profileCaption ? (
              <p className="account-menu-dropdown-caption">{profileCaption}</p>
            ) : null}
          </div>

          <button
            type="button"
            role="menuitem"
            className="account-menu-dropdown-item is-danger"
            onClick={() => {
              setMenuOpen(false)
              onSignOut()
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export type { AccountMenuProps }
export default AccountMenu
