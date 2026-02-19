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
  heightMode?: 'content' | 'viewport'
  stickyOffset?: 'compact' | 'header'
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

const defaultSidebarItemClass =
  'w-full rounded-xl border px-3 py-2.5 text-left transition flex items-start gap-2.5'

const dashboardSidebarItemClass =
  'w-full rounded-2xl border border-transparent px-3 py-2.5 text-left transition flex items-start gap-3'

const sectionHeadingClass =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]'

const renderProfileInitials = (name: string, fallback = 'U') => {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return fallback
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
}

const Sidebar = ({
  className,
  variant = 'default',
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
  const referenceViewportClass =
    heightMode === 'viewport'
      ? `reference-sidebar--viewport ${
          stickyOffset === 'header' ? 'reference-sidebar--offset-header' : 'reference-sidebar--offset-compact'
        }`
      : ''
  const dashboardViewportClass =
    heightMode === 'viewport'
      ? `dashboard-sidebar--viewport ${
          stickyOffset === 'header' ? 'dashboard-sidebar--offset-header' : 'dashboard-sidebar--offset-compact'
        }`
      : ''

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
    isActive: boolean,
    mode: 'default' | 'dashboard' | 'reference'
  ) => {
    if (mode === 'reference') {
      return (
        <button
          key={item.key}
          type="button"
          onClick={onClick}
          className={`reference-sidebar-item ${isActive ? 'is-active' : ''}`}
        >
          <span className="reference-sidebar-icon" aria-hidden="true">
            <SidebarGlyph icon={item.icon} />
          </span>
          <span className="min-w-0">
            <span className="reference-sidebar-label">{item.label}</span>
            {item.caption ? <span className="reference-sidebar-caption">{item.caption}</span> : null}
          </span>
        </button>
      )
    }

    if (mode === 'dashboard') {
      return (
        <button
          key={item.key}
          type="button"
          onClick={onClick}
          className={`${dashboardSidebarItemClass} ${
            isActive
              ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)] shadow-[inset_3px_0_0_var(--agent-accent)]'
              : 'bg-transparent text-[color:var(--agent-muted)] hover:border-[color:var(--card-border)] hover:bg-[color:var(--agent-overlay)] hover:text-[color:var(--agent-ink)]'
          }`}
        >
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)]">
            <SidebarGlyph icon={item.icon} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{item.label}</span>
            {item.caption ? (
              <span className="mt-0.5 block truncate text-xs text-[color:var(--agent-muted-soft)]">
                {item.caption}
              </span>
            ) : null}
          </span>
        </button>
      )
    }

    return (
      <button
        key={item.key}
        type="button"
        onClick={onClick}
        className={`${defaultSidebarItemClass} ${
          isActive
            ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)]'
            : 'border-transparent bg-transparent text-[color:var(--agent-muted)] hover:border-[color:var(--card-border)] hover:bg-[color:var(--agent-overlay)]'
        }`}
      >
        <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)]">
          <SidebarGlyph icon={item.icon} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{item.label}</span>
          {item.caption ? (
            <span className="mt-0.5 block truncate text-xs text-[color:var(--agent-muted-soft)]">
              {item.caption}
            </span>
          ) : null}
        </span>
      </button>
    )
  }

  if (variant === 'reference') {
    return (
      <aside
        className={`reference-sidebar ${isCollapsed ? 'is-collapsed' : ''} ${referenceViewportClass} ${className ?? ''}`}
      >
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mb-2 rounded-md border border-[color:var(--reference-border)] px-2 py-1 text-xs font-semibold text-[color:var(--reference-muted)]"
          >
            {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </button>
        ) : null}
        {showBrand ? (
          <button type="button" onClick={onBrandClick} className="reference-sidebar-brand">
            <AppLogoBadge className="h-10 w-10" />
            <div>
              <p className="reference-sidebar-brand-title">{brandTitle}</p>
              <p className="reference-sidebar-brand-subtitle">{brandSubtitle}</p>
            </div>
          </button>
        ) : null}

        {mainItems.length > 0 ? (
          <div className={showBrand ? 'mt-4' : ''}>
            <p className="reference-sidebar-heading">{sectionLabel}</p>
            <nav className="mt-2 space-y-1.5">
              {mainItems.map((item) => renderItem(item, () => onSelect(item.key), activeKey === item.key, 'reference'))}
            </nav>
          </div>
        ) : null}

        {(utilityItems.length > 0 || supportItem) && (
          <div className="reference-sidebar-divider">
            {utilityItems.length > 0 ? (
              <>
                <p className="reference-sidebar-heading">{auxiliaryLabel}</p>
                <div className="mt-2 space-y-1.5">
                  {utilityItems.map((item) =>
                    renderItem(item, () => handleAuxSelect(item.key), activeKey === item.key, 'reference')
                  )}
                </div>
              </>
            ) : null}

            {supportItem ? (
              <div className={utilityItems.length > 0 ? 'mt-3 border-t border-[color:var(--reference-border)] pt-3' : ''}>
                <p className="reference-sidebar-heading">Support</p>
                <div className="mt-2">
                  {renderItem(
                    supportItem,
                    () => handleAuxSelect(supportItem.key),
                    activeKey === supportItem.key,
                    'reference'
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {(footerProfile || profileExtra) ? (
          <div className="mt-auto border-t border-[color:var(--reference-border)] pt-3">
            {footerProfile ? (
              <button
                type="button"
                className="reference-sidebar-profile flex items-center gap-3 w-full"
                onClick={footerProfile.onClick}
                disabled={!footerProfile.onClick}
              >
                <span className="reference-sidebar-profile-avatar shrink-0">
                  {footerProfile.avatarText ?? renderProfileInitials(footerProfile.name)}
                </span>
                <span className="min-w-0 text-left overflow-hidden">
                  <span className="reference-sidebar-profile-subtitle block truncate">{footerProfile.subtitle}</span>
                  <span className="reference-sidebar-profile-name block truncate">{footerProfile.name}</span>
                </span>
                <span className="reference-sidebar-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ) : null}
            {profileExtra ? <div className="mt-2">{profileExtra}</div> : null}
          </div>
        ) : null}
      </aside>
    )
  }

  if (variant === 'dashboard') {
    return (
      <aside
        className={`${className ?? ''} ${isCollapsed ? 'is-collapsed' : ''} ${dashboardViewportClass} flex w-full flex-col rounded-3xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-4 shadow-[var(--card-shadow-soft)] lg:w-[282px]`}
      >
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mb-2 rounded-md border border-[color:var(--card-border)] px-2 py-1 text-xs font-semibold text-[color:var(--agent-muted)]"
          >
            {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </button>
        ) : null}
        {showBrand ? (
          <button
            type="button"
            onClick={onBrandClick}
            className="w-full rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3.5 text-left"
          >
            <div className="flex items-center gap-3">
              <AppLogoBadge className="h-10 w-10" />
              <div>
                <p className="text-base font-semibold text-[color:var(--agent-ink)]">{brandTitle}</p>
                <p className="text-xs text-[color:var(--agent-muted)]">{brandSubtitle}</p>
              </div>
            </div>
          </button>
        ) : null}

        {mainItems.length > 0 ? (
          <div className={showBrand ? 'mt-4' : ''}>
            <p className={sectionHeadingClass}>{sectionLabel}</p>
            <nav className="mt-2.5 space-y-1.5">
              {mainItems.map((item) => renderItem(item, () => onSelect(item.key), activeKey === item.key, 'dashboard'))}
            </nav>
          </div>
        ) : null}

        {(utilityItems.length > 0 || supportItem) && (
          <div className="mt-4 border-t border-[color:var(--card-border)] pt-4">
            {utilityItems.length > 0 ? (
              <>
                <p className={sectionHeadingClass}>{auxiliaryLabel}</p>
                <div className="mt-2 space-y-1.5">
                  {utilityItems.map((item) =>
                    renderItem(item, () => handleAuxSelect(item.key), activeKey === item.key, 'dashboard')
                  )}
                </div>
              </>
            ) : null}

            {supportItem ? (
              <div className={utilityItems.length > 0 ? 'mt-3 border-t border-[color:var(--card-border)] pt-3' : ''}>
                <p className={sectionHeadingClass}>Support</p>
                <div className="mt-2">
                  {renderItem(
                    supportItem,
                    () => handleAuxSelect(supportItem.key),
                    activeKey === supportItem.key,
                    'dashboard'
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {(statusValue || profileValue || profileExtra) ? (
          <div className="mt-auto border-t border-[color:var(--card-border)] pt-4">
            {statusValue ? (
              <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                  {statusLabel ?? 'Status'}
                </p>
                <p className="mt-1.5 text-xs font-semibold text-[color:var(--agent-ink)]">{statusValue}</p>
              </div>
            ) : null}

            {profileValue ? (
              <div className="mt-3 rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                  {profileLabel ?? 'Profile'}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-[color:var(--agent-ink)]">{profileValue}</p>
                {profileCaption ? (
                  <p className="text-xs text-[color:var(--agent-muted)]">{profileCaption}</p>
                ) : null}
              </div>
            ) : null}

            {profileExtra ? <div className="mt-3">{profileExtra}</div> : null}
          </div>
        ) : null}
      </aside>
    )
  }

  return (
    <aside
      className={`${className ?? ''} ${isCollapsed ? 'is-collapsed' : ''} w-full rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-4 lg:w-[260px]`}
    >
      {onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mb-2 rounded-md border border-[color:var(--card-border)] px-2 py-1 text-xs font-semibold text-[color:var(--agent-muted)]"
        >
          {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        </button>
      ) : null}
      {showBrand ? (
        <button
          type="button"
          onClick={onBrandClick}
          className="w-full rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3 text-left"
        >
          <div className="flex items-center gap-3">
            <AppLogoBadge className="h-9 w-9" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--agent-ink)]">{brandTitle}</p>
              <p className="text-xs text-[color:var(--agent-muted)]">{brandSubtitle}</p>
            </div>
          </div>
        </button>
      ) : null}

      <p
        className={`${showBrand ? 'mt-4' : ''} text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]`}
      >
        {sectionLabel}
      </p>

      <nav className="mt-2.5 space-y-1.5">
        {mainItems.map((item) => renderItem(item, () => onSelect(item.key), activeKey === item.key, 'default'))}
      </nav>

      {utilityItems.length > 0 ? (
        <div className="mt-4 border-t border-[color:var(--card-border)] pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            {auxiliaryLabel}
          </p>
          <div className="mt-2 space-y-1.5">
            {utilityItems.map((item) =>
              renderItem(item, () => handleAuxSelect(item.key), activeKey === item.key, 'default')
            )}
          </div>
        </div>
      ) : null}

      {(statusValue || profileValue || profileExtra) && (
        <div className="mt-4 border-t border-[color:var(--card-border)] pt-4">
          {statusValue ? (
            <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                {statusLabel ?? 'Status'}
              </p>
              <p className="mt-1.5 text-xs font-semibold text-[color:var(--agent-ink)]">{statusValue}</p>
            </div>
          ) : null}

          {profileValue ? (
            <div className="mt-3 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                {profileLabel ?? 'Profile'}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[color:var(--agent-ink)] truncate">{profileValue}</p>
              {profileCaption ? <p className="text-xs text-[color:var(--agent-muted)] truncate">{profileCaption}</p> : null}
            </div>
          ) : null}

          {profileExtra ? <div className="mt-3">{profileExtra}</div> : null}
        </div>
      )}
    </aside>
  )
}

export type { SidebarProps }
export default Sidebar
