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
  eyebrow,
  statusLabel,
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

  return (
    <section className={`${pagePanelClass} page-top-shell overflow-hidden`}>
      <div className="page-top-shell-header sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {eyebrow ? (
              <span className={`page-top-shell-chip ${pageSubtleTextClass}`}>
                {eyebrow}
              </span>
            ) : null}
            {statusLabel ? (
              <span className="page-top-shell-chip is-status">
                {statusLabel}
              </span>
            ) : null}
          </div>

          {showControlRow ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto xl:min-w-[340px] xl:max-w-[460px]">
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
        </div>

        <div
          className={`mt-5 grid gap-4 ${showRightRail ? 'lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end' : ''}`}
        >
          <div>
            <h1 className={`page-top-shell-title ${pageHeadingTextClass}`}>
              {title}
            </h1>
            <p className={`page-top-shell-description ${pageMutedTextClass}`}>{description}</p>
          </div>

          {quickActions ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">{quickActions}</div>
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
                    className={`mt-2 font-semibold ${pageHeadingTextClass} ${isLongTextValue ? 'break-all text-xl leading-tight' : 'text-2xl'}`}
                  >
                    {metric.value}
                  </p>
                  {metric.caption ? <p className={`mt-1 text-xs ${pageMutedTextClass}`}>{metric.caption}</p> : null}
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
