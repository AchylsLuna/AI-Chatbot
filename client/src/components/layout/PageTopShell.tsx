import type { ReactNode } from 'react'
import AccountMenu from './AccountMenu'
import {
  pageFieldClass,
  pageHeadingTextClass,
  pageMutedTextClass,
  pagePanelClass,
  pagePanelSoftClass,
  pageSubtleTextClass,
} from '../../styles/pageUi'

type PageTopMetric = {
  key: string
  label: string
  value: number | string
  caption?: string
}

type PageTopShellProps = {
  eyebrow?: string
  statusLabel?: string
  title: string
  description: string
  searchValue: string
  searchPlaceholder?: string
  onSearchChange: (value: string) => void
  showSearch?: boolean
  showAccountMenu?: boolean
  profileName?: string
  profileCaption?: string
  showNotifications?: boolean
  notificationCount?: number
  onSignOut?: () => void
  quickActions?: ReactNode
  metrics: readonly PageTopMetric[]
}

const PageTopShell = ({
  title,
  description,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  showSearch = true,
  showAccountMenu = true,
  profileName = '',
  profileCaption,
  showNotifications = true,
  notificationCount = 0,
  onSignOut,
  quickActions,
  metrics,
}: PageTopShellProps) => {
  const canShowAccountMenu = Boolean(showAccountMenu && profileName.trim() && onSignOut)
  const showControlRow = showSearch || canShowAccountMenu
  const showRightRail = showControlRow || Boolean(quickActions)
  const rightRailWidthClass = showControlRow ? 'lg:min-w-[360px] lg:max-w-[480px]' : ''

  return (
    <section className={`${pagePanelClass} page-top-shell overflow-hidden`}>
      <div className="page-top-shell-header sm:px-6">
        <div
          className={`grid gap-5 ${showRightRail ? 'lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start' : ''}`}
        >
          <div className="min-w-0">
            <h1 className={`page-top-shell-title ${pageHeadingTextClass}`}>
              {title}
            </h1>
            <p className={`page-top-shell-description ${pageMutedTextClass}`}>{description}</p>
          </div>

          {showRightRail ? (
            <div className={`flex w-full flex-col gap-3 lg:w-auto ${rightRailWidthClass}`.trim()}>
              {showControlRow ? (
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                  {showSearch ? (
                    <div className="page-top-shell-search-wrap">
                      <label className="sr-only" htmlFor="page-shell-search">
                        Search records
                      </label>
                      <input
                        id="page-shell-search"
                        value={searchValue}
                        onChange={(event) => onSearchChange(event.target.value)}
                        className={`${pageFieldClass} page-top-shell-search`}
                        placeholder={searchPlaceholder ?? 'Search records'}
                      />
                    </div>
                  ) : null}
                  {canShowAccountMenu ? (
                    <AccountMenu
                      profileName={profileName}
                      profileCaption={profileCaption}
                      showNotifications={showNotifications}
                      notificationCount={notificationCount}
                      onSignOut={onSignOut!}
                      variant="staff"
                    />
                  ) : null}
                </div>
              ) : null}

              {quickActions ? (
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">{quickActions}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {metrics.length > 0 ? (
        <div className="page-top-shell-metrics sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const isLongTextValue = typeof metric.value === 'string' && metric.value.length > 20
              return (
                <article key={metric.key} className={`${pagePanelSoftClass} p-4`}>
                  <p className={`text-xs uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>{metric.label}</p>
                  <p
                    className={`mt-2 font-semibold tracking-[-0.03em] ${pageHeadingTextClass} ${isLongTextValue ? 'break-all text-xl leading-tight' : 'text-[1.75rem] leading-tight'}`}
                  >
                    {metric.value}
                  </p>
                  {metric.caption ? <p className={`mt-1 text-sm ${pageMutedTextClass}`}>{metric.caption}</p> : null}
                </article>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export type { PageTopMetric }
export default PageTopShell
