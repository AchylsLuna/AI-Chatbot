import type { ReactNode } from 'react'
import WorkspaceAccountMenu from './WorkspaceAccountMenu'
import {
  workspaceFieldClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePanelSoftClass,
  workspaceSubtleTextClass,
} from '../../styles/workspaceUi'

type WorkspaceMetric = {
  key: string
  label: string
  value: number | string
  caption?: string
}

type WorkspaceTopShellProps = {
  eyebrow?: string
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
  metrics: readonly WorkspaceMetric[]
}

const WorkspaceTopShell = ({
  eyebrow,
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
}: WorkspaceTopShellProps) => {
  const canShowAccountMenu = Boolean(showAccountMenu && profileName.trim() && onSignOut)
  const showControlRow = showSearch || canShowAccountMenu
  const showRightRail = showControlRow || Boolean(quickActions)

  return (
    <section className={`${workspacePanelClass} p-5 sm:p-6`}>
      <div
        className={`grid gap-4 ${showRightRail ? 'lg:grid-cols-[1fr_minmax(260px,420px)] lg:items-start' : ''}`}
      >
        <div>
          {eyebrow ? (
            <p className={`text-xs uppercase tracking-[0.16em] ${workspaceSubtleTextClass}`}>{eyebrow}</p>
          ) : null}
          <h1 className={`mt-2 text-2xl font-semibold tracking-tight sm:text-3xl ${workspaceHeadingTextClass}`}>
            {title}
          </h1>
          <p className={`mt-2 max-w-3xl text-sm sm:text-base ${workspaceMutedTextClass}`}>{description}</p>

          {!showRightRail && quickActions ? <div className="mt-3 flex flex-wrap gap-2">{quickActions}</div> : null}
        </div>

        {showRightRail ? (
          <div className="space-y-3">
            {showControlRow ? (
              <div className="flex items-center gap-2.5">
                {showSearch ? (
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor="workspace-shell-search">
                      Search workspace
                    </label>
                    <input
                      id="workspace-shell-search"
                      value={searchValue}
                      onChange={(event) => onSearchChange(event.target.value)}
                      className={workspaceFieldClass}
                      placeholder={searchPlaceholder ?? 'Search records'}
                    />
                  </div>
                ) : null}
                {canShowAccountMenu ? (
                  <WorkspaceAccountMenu
                    profileName={profileName}
                    profileCaption={profileCaption}
                    showNotifications={showNotifications}
                    notificationCount={notificationCount}
                    onSignOut={onSignOut!}
                    variant="workspace"
                  />
                ) : null}
              </div>
            ) : null}
            {quickActions ? <div className="flex flex-wrap gap-2">{quickActions}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isLongTextValue = typeof metric.value === 'string' && metric.value.length > 20
          return (
            <article key={metric.key} className={`${workspacePanelSoftClass} p-4`}>
              <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>{metric.label}</p>
              <p
                className={`mt-2 font-semibold ${workspaceHeadingTextClass} ${isLongTextValue ? 'break-all text-xl leading-tight' : 'text-2xl'}`}
              >
                {metric.value}
              </p>
              {metric.caption ? <p className={`mt-1 text-xs ${workspaceMutedTextClass}`}>{metric.caption}</p> : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export type { WorkspaceMetric }
export default WorkspaceTopShell
