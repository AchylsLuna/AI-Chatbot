import type { ReactNode } from 'react'
import AppLogoBadge from '../branding/AppLogoBadge'

export type SidebarIcon =
  | 'home'
  | 'calendar'
  | 'book'
  | 'pill'
  | 'folder'
  | 'message'
  | 'alert'
  | 'hospital'
  | 'user'
  | 'chart'
  | 'report'
  | 'shield'
  | 'settings'

export type SidebarItem = {
  key: string
  label: string
  caption?: string
  icon?: SidebarIcon
}

export type SidebarAuxItem = {
  key: string
  label: string
  caption?: string
  icon?: SidebarIcon
}

type SidebarProps = {
  className?: string
  variant?: 'default' | 'dashboard' | 'reference'
  mobileMode?: 'drawer'
  fullRail?: boolean
  heightMode?: 'content' | 'viewport'
  stickyOffset?: 'compact' | 'header' | 'auto'
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  showBrand?: boolean
  brandTitle: string
  brandSubtitle: string
  onBrandClick?: () => void
  sectionLabel?: string
  items?: SidebarItem[]
  primaryItems?: SidebarItem[]
  activeKey: string
  onSelect: (key: string) => void
  auxiliaryLabel?: string
  auxiliaryItems?: SidebarAuxItem[]
  secondaryItems?: SidebarAuxItem[]
  supportItem?: { key: string; label: string; icon?: SidebarIcon }
  onSelectAuxiliary?: (key: string) => void
  statusLabel?: string
  statusValue?: string
  profileLabel?: string
  profileValue?: string
  profileCaption?: string
  profileExtra?: ReactNode
  footerProfile?: {
    name: string
    subtitle: string
    avatarText?: string
    onClick?: () => void
  }
}

const SidebarGlyph = ({ icon }: { icon?: SidebarIcon }) => {
  switch (icon) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      )
    case 'book':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19a2 2 0 0 0 2 2h14" />
          <path d="M6 2h12v19H6a2 2 0 0 1 0-4h12" />
        </svg>
      )
    case 'pill':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="9" width="18" height="6" rx="3" />
          <path d="M11 9v6" />
        </svg>
      )
    case 'folder':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      )
    case 'message':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 5h16v10H8l-4 4z" />
        </svg>
      )
    case 'alert':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 3 9 16H3z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      )
    case 'hospital':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M12 7v6M9 10h6" />
          <path d="M8 21v-4h8v4" />
        </svg>
      )
    case 'user':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21a8 8 0 1 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      )
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="m7 13 4-4 3 3 5-5" />
        </svg>
      )
    case 'report':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      )
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2 4 6v6c0 5.5 3.5 8.7 8 10 4.5-1.3 8-4.5 8-10V6z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
  }
}

const renderProfileInitials = (name: string, fallback = 'U') => {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return fallback
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
}

const resolveAutoOffset = (): 'compact' | 'header' => {
  if (typeof document === 'undefined') return 'compact'
  return document.querySelector('[data-workspace-header="true"]') ? 'header' : 'compact'
}

const Sidebar = ({
  className,
  variant = 'default',
  mobileMode = 'drawer',
  fullRail = true,
  heightMode = 'content',
  stickyOffset = 'compact',
  isCollapsed = false,
  onToggleCollapse,
  showBrand = true,
  brandTitle,
  brandSubtitle,
  onBrandClick,
  sectionLabel = 'Navigation',
  items,
  primaryItems,
  activeKey,
  onSelect,
  auxiliaryLabel = 'More',
  auxiliaryItems,
  secondaryItems,
  supportItem,
  onSelectAuxiliary,
  statusLabel,
  statusValue,
  profileLabel,
  profileValue,
  profileCaption,
  profileExtra,
  footerProfile,
}: SidebarProps) => {
  const mainItems = (primaryItems ?? items ?? []).filter(Boolean)
  const utilityItems = (secondaryItems ?? auxiliaryItems ?? []).filter(Boolean)
  const resolvedStickyOffset = stickyOffset === 'auto' ? resolveAutoOffset() : stickyOffset
  const viewportClass =
    heightMode === 'viewport'
      ? `workspace-sidebar--viewport workspace-sidebar--offset-${resolvedStickyOffset}`
      : ''
  const allowLegacyCollapse = !fullRail && Boolean(onToggleCollapse)
  const showCollapsedState = allowLegacyCollapse && isCollapsed

  const handleAuxSelect = (key: string) => {
    if (onSelectAuxiliary) {
      onSelectAuxiliary(key)
      return
    }
    onSelect(key)
  }

  const renderItem = (
    item: SidebarItem | SidebarAuxItem,
    onClick: () => void,
    isActive: boolean
  ) => {
    return (
      <button
        key={item.key}
        type="button"
        onClick={onClick}
        className={`workspace-sidebar-item ${isActive ? 'is-active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        data-sidebar-nav-item="true"
      >
        <span className="workspace-sidebar-icon" aria-hidden="true">
          <SidebarGlyph icon={item.icon} />
        </span>
        <span className="workspace-sidebar-copy">
          <span className="workspace-sidebar-label">{item.label}</span>
          {item.caption ? <span className="workspace-sidebar-caption">{item.caption}</span> : null}
        </span>
      </button>
    )
  }

  return (
    <aside
      className={`workspace-sidebar ${showCollapsedState ? 'is-collapsed' : ''} ${viewportClass} ${className ?? ''}`}
      data-sidebar-root="true"
      data-sidebar-variant={variant}
      data-sidebar-mobile-mode={mobileMode}
    >
      {allowLegacyCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="workspace-sidebar-collapse-toggle"
        >
          {showCollapsedState ? 'Expand sidebar' : 'Collapse sidebar'}
        </button>
      ) : null}

      {showBrand ? (
        <button
          type="button"
          onClick={() => onBrandClick?.()}
          className="workspace-sidebar-brand"
          data-sidebar-nav-item={onBrandClick ? 'true' : undefined}
        >
          <AppLogoBadge className="h-10 w-10" />
          <span className="min-w-0 text-left">
            <span className="workspace-sidebar-brand-title">{brandTitle}</span>
            <span className="workspace-sidebar-brand-subtitle">{brandSubtitle}</span>
          </span>
        </button>
      ) : null}

      <div className="workspace-sidebar-scroll">
        {mainItems.length > 0 ? (
          <section>
            <p className="workspace-sidebar-heading">{sectionLabel}</p>
            <nav className="workspace-sidebar-nav" aria-label={`${sectionLabel} navigation`}>
              {mainItems.map((item) => renderItem(item, () => onSelect(item.key), activeKey === item.key))}
            </nav>
          </section>
        ) : null}

        {utilityItems.length > 0 ? (
          <section className="workspace-sidebar-divider">
            <p className="workspace-sidebar-heading">{auxiliaryLabel}</p>
            <nav className="workspace-sidebar-nav" aria-label={`${auxiliaryLabel} navigation`}>
              {utilityItems.map((item) =>
                renderItem(item, () => handleAuxSelect(item.key), activeKey === item.key)
              )}
            </nav>
          </section>
        ) : null}
      </div>

      {supportItem ? (
        <section className="workspace-sidebar-support">
          <p className="workspace-sidebar-heading">Support</p>
          <div className="workspace-sidebar-nav">
            {renderItem(
              supportItem,
              () => handleAuxSelect(supportItem.key),
              activeKey === supportItem.key
            )}
          </div>
        </section>
      ) : null}

      {(statusValue || profileValue || footerProfile || profileExtra) ? (
        <div className="workspace-sidebar-footer">
          {statusValue ? (
            <div className="workspace-sidebar-meta-card">
              <p className="workspace-sidebar-meta-label">{statusLabel ?? 'Status'}</p>
              <p className="workspace-sidebar-meta-value">{statusValue}</p>
            </div>
          ) : null}

          {profileValue ? (
            <div className="workspace-sidebar-meta-card">
              <p className="workspace-sidebar-meta-label">{profileLabel ?? 'Profile'}</p>
              <p className="workspace-sidebar-profile-value">{profileValue}</p>
              {profileCaption ? <p className="workspace-sidebar-meta-caption">{profileCaption}</p> : null}
            </div>
          ) : null}

          {footerProfile ? (
            <button
              type="button"
              className="workspace-sidebar-profile"
              onClick={footerProfile.onClick}
              disabled={!footerProfile.onClick}
              data-sidebar-nav-item={footerProfile.onClick ? 'true' : undefined}
            >
              <span className="workspace-sidebar-profile-avatar">
                {footerProfile.avatarText ?? renderProfileInitials(footerProfile.name)}
              </span>
              <span className="min-w-0 text-left">
                <span className="workspace-sidebar-profile-subtitle">{footerProfile.subtitle}</span>
                <span className="workspace-sidebar-profile-name">{footerProfile.name}</span>
              </span>
              <span className="workspace-sidebar-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          ) : null}

          {profileExtra ? (
            <div className={statusValue || profileValue || footerProfile ? 'mt-2.5' : ''}>
              {profileExtra}
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

export type { SidebarProps }
export default Sidebar
