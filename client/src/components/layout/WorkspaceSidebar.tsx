import type { ReactNode } from 'react'
import AppLogoBadge from '../branding/AppLogoBadge'

export type WorkspaceSidebarIcon =
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

export type WorkspaceSidebarItem = {
  key: string
  label: string
  caption?: string
  icon?: WorkspaceSidebarIcon
}

export type WorkspaceSidebarAuxItem = {
  key: string
  label: string
  caption?: string
  icon?: WorkspaceSidebarIcon
}

type WorkspaceSidebarProps = {
  className?: string
  brandTitle: string
  brandSubtitle: string
  onBrandClick?: () => void
  sectionLabel?: string
  items: WorkspaceSidebarItem[]
  activeKey: string
  onSelect: (key: string) => void
  auxiliaryLabel?: string
  auxiliaryItems?: WorkspaceSidebarAuxItem[]
  onSelectAuxiliary?: (key: string) => void
  statusLabel?: string
  statusValue?: string
  profileLabel?: string
  profileValue?: string
  profileCaption?: string
  profileExtra?: ReactNode
}

const SidebarGlyph = ({ icon }: { icon?: WorkspaceSidebarIcon }) => {
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

const WorkspaceSidebar = ({
  className,
  brandTitle,
  brandSubtitle,
  onBrandClick,
  sectionLabel = 'Navigation',
  items,
  activeKey,
  onSelect,
  auxiliaryLabel = 'More',
  auxiliaryItems,
  onSelectAuxiliary,
  statusLabel,
  statusValue,
  profileLabel,
  profileValue,
  profileCaption,
  profileExtra,
}: WorkspaceSidebarProps) => (
  <aside
    className={`${className ?? ''} relative w-full overflow-hidden rounded-[30px] border border-[rgba(106,123,179,0.28)] bg-[linear-gradient(180deg,rgba(20,23,44,0.97),rgba(14,18,36,0.96))] shadow-[0_30px_70px_rgba(0,0,0,0.45)] lg:w-[260px]`}
  >
    <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(circle_at_center,rgba(90,215,255,0.28),transparent_72%)] blur-xl" />

    <div className="relative p-4">
      <button
        type="button"
        onClick={onBrandClick}
        className="w-full rounded-[24px] border border-[rgba(141,166,226,0.25)] bg-[linear-gradient(150deg,rgba(30,33,58,0.96),rgba(17,20,39,0.95))] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(194,210,248,0.45)] bg-[rgba(255,255,255,0.94)]">
            <AppLogoBadge className="h-7 w-7" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-[#f3f7ff]">{brandTitle}</p>
            <p className="text-xs text-[rgba(184,201,236,0.72)]">{brandSubtitle}</p>
          </div>
        </div>
      </button>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(157,176,217,0.76)]">
        {sectionLabel}
      </p>

      <nav className="mt-3 space-y-2">
        {items.map((item) => {
          const active = activeKey === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                active
                  ? 'border-[rgba(165,188,246,0.36)] bg-[rgba(255,255,255,0.08)] text-[#f7fbff] shadow-[0_12px_30px_rgba(0,0,0,0.26)]'
                  : 'border-transparent bg-transparent text-[rgba(171,188,224,0.74)] hover:border-[rgba(116,139,205,0.28)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#edf4ff]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl border transition ${
                    active
                      ? 'border-[rgba(226,237,255,0.82)] bg-[rgba(255,255,255,0.94)] text-[#1a2140]'
                      : 'border-[rgba(113,133,190,0.32)] bg-[rgba(13,18,36,0.62)] text-[rgba(175,194,233,0.8)]'
                  }`}
                >
                  <SidebarGlyph icon={item.icon} />
                </span>
                <span className="block min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                  {item.caption ? (
                    <span
                      className={`mt-1 block truncate text-xs ${
                        active ? 'text-[rgba(219,232,255,0.8)]' : 'text-[rgba(149,169,208,0.7)]'
                      }`}
                    >
                      {item.caption}
                    </span>
                  ) : null}
                </span>
              </div>
            </button>
          )
        })}
      </nav>

      {auxiliaryItems && auxiliaryItems.length > 0 ? (
        <div className="mt-5 border-t border-[rgba(116,138,194,0.25)] pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(157,176,217,0.76)]">
            {auxiliaryLabel}
          </p>

          <div className="mt-3 space-y-2">
            {auxiliaryItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectAuxiliary?.(item.key)}
                className="w-full rounded-2xl border border-transparent bg-transparent px-3 py-3 text-left text-[rgba(171,188,224,0.74)] transition hover:border-[rgba(116,139,205,0.28)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#edf4ff]"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl border border-[rgba(113,133,190,0.32)] bg-[rgba(13,18,36,0.62)] text-[rgba(175,194,233,0.8)]">
                    <SidebarGlyph icon={item.icon} />
                  </span>
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    {item.caption ? (
                      <span className="mt-1 block truncate text-xs text-[rgba(149,169,208,0.7)]">
                        {item.caption}
                      </span>
                    ) : null}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {(statusValue || profileValue || profileExtra) && (
        <div className="mt-5 border-t border-[rgba(116,138,194,0.25)] pt-4">
          {statusValue ? (
            <div className="rounded-2xl border border-emerald-300/45 bg-emerald-300/12 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-200">
                {statusLabel ?? 'Status'}
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-100">{statusValue}</p>
            </div>
          ) : null}

          {profileValue ? (
            <div className="mt-3 rounded-2xl border border-[rgba(114,135,192,0.35)] bg-[rgba(10,15,30,0.55)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(153,174,216,0.82)]">
                {profileLabel ?? 'Profile'}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#ecf4ff]">{profileValue}</p>
              {profileCaption ? <p className="text-xs text-[rgba(153,174,216,0.82)]">{profileCaption}</p> : null}
            </div>
          ) : null}

          {profileExtra ? <div className="mt-3">{profileExtra}</div> : null}
        </div>
      )}
    </div>
  </aside>
)

export default WorkspaceSidebar
