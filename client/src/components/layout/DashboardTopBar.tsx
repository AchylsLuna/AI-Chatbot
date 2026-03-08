import { useMemo } from 'react'
import WorkspaceAccountMenu from './WorkspaceAccountMenu'

type DashboardTopBarProps = {
  title?: string
  searchValue: string
  onSearchChange: (value: string) => void
  showSearch?: boolean
  searchPlaceholder?: string
  searchLabel?: string
  profileName?: string
  profileCaption?: string
  notificationCount?: number
  messageCount?: number
  showMessages?: boolean
  showNotifications?: boolean
  showProfile?: boolean
  showAccountMenu?: boolean
  borderlessActions?: boolean
  onSignOut?: () => void
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

const MessageIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 5h16v10H8l-4 4z" />
  </svg>
)

const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

const DashboardTopBar = ({
  title,
  searchValue,
  onSearchChange,
  showSearch = true,
  searchPlaceholder = 'Search records',
  searchLabel,
  profileName = '',
  profileCaption = '',
  notificationCount = 0,
  messageCount = 0,
  showMessages = false,
  showNotifications = false,
  showProfile = false,
  showAccountMenu,
  borderlessActions = false,
  onSignOut,
}: DashboardTopBarProps) => {
  const initials = useMemo(() => {
    const trimmed = profileName.trim()
    if (!trimmed) return 'U'
    const tokens = trimmed.split(/\s+/).filter(Boolean)
    if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
    return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
  }, [profileName])

  const shouldShowAccountMenu = showAccountMenu ?? showProfile
  const canShowAccountMenu = shouldShowAccountMenu && Boolean(onSignOut)
  const showProfileChip = showProfile && !canShowAccountMenu
  const showStandaloneNotifications = showNotifications && !canShowAccountMenu
  const hasActions =
    showMessages || showStandaloneNotifications || showProfileChip || canShowAccountMenu

  return (
    <section
      className={`reference-topbar ${title ? '' : 'reference-topbar--search-only'} ${showSearch ? '' : 'reference-topbar--no-search'}`}
    >
      {title ? <h1 className="reference-page-title">{title}</h1> : null}

      {showSearch ? (
        <div className="reference-search-field">
          {searchLabel ? <p className="reference-search-label">{searchLabel}</p> : null}
          <label className="reference-search" htmlFor="reference-dashboard-search">
            <span className="text-[color:var(--agent-muted-soft)]" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              id="reference-dashboard-search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="reference-search-input"
            />
          </label>
        </div>
      ) : null}

      {hasActions ? (
        <div className="reference-top-actions">
          {showMessages ? (
            <button
              type="button"
              className={`reference-icon-chip${borderlessActions ? ' is-borderless' : ''}`}
              aria-label={`Messages (${messageCount})`}
            >
              <MessageIcon />
              {messageCount > 0 ? <span className="reference-chip-badge">{messageCount}</span> : null}
            </button>
          ) : null}
          {showStandaloneNotifications ? (
            <button
              type="button"
              className={`reference-icon-chip${borderlessActions ? ' is-borderless' : ''}`}
              aria-label={`Notifications (${notificationCount})`}
            >
              <BellIcon />
              {notificationCount > 0 ? <span className="reference-chip-badge">{notificationCount}</span> : null}
            </button>
          ) : null}

          {canShowAccountMenu ? (
            <WorkspaceAccountMenu
              profileName={profileName}
              profileCaption={profileCaption}
              showNotifications={showNotifications}
              notificationCount={notificationCount}
              onSignOut={onSignOut!}
              variant="reference"
            />
          ) : null}

          {showProfileChip ? (
            <div className="reference-profile-chip" aria-label="Current profile">
              <span className="reference-profile-avatar">{initials}</span>
              <span className="min-w-0">
                <span className="reference-profile-name">{profileName}</span>
                <span className="reference-profile-caption">{profileCaption}</span>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export type { DashboardTopBarProps }
export default DashboardTopBar
