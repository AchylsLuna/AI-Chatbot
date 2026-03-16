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
    <section className={`${pagePanelClass} overflow-hidden`}>
      <div className="border-b border-[color:var(--card-border)] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {eyebrow ? (
              <span className={`rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${pageSubtleTextClass}`}>
                {eyebrow}
              </span>
            ) : null}
            {statusLabel ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {statusLabel}
              </span>
            ) : null}
          </div>

          {showControlRow ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto xl:min-w-[340px] xl:max-w-[460px]">
              {showSearch ? (
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor="page-shell-search">
                    Search records
                  </label>
                  <input
                    id="page-shell-search"
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className={pageFieldClass}
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
            <h1 className={`text-2xl font-semibold tracking-tight sm:text-3xl ${pageHeadingTextClass}`}>
              {title}
            </h1>
            <p className={`mt-2 max-w-3xl text-sm sm:text-base ${pageMutedTextClass}`}>{description}</p>
          </div>

          {quickActions ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">{quickActions}</div>
          ) : null}
        </div>
      </div>

      {metrics.length > 0 ? (
        <div className="bg-[color:var(--agent-surface-strong)]/65 px-5 py-4 sm:px-6">
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
