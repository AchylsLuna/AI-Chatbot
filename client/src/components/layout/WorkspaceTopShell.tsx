import type { ReactNode } from 'react'
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
  quickActions?: ReactNode
  metrics: WorkspaceMetric[]
}

const WorkspaceTopShell = ({
  eyebrow,
  title,
  description,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  quickActions,
  metrics,
}: WorkspaceTopShellProps) => (
  <section className={`${workspacePanelClass} p-5 sm:p-6`}>
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(260px,420px)] lg:items-start">
      <div>
        {eyebrow ? (
          <p className={`text-xs uppercase tracking-[0.16em] ${workspaceSubtleTextClass}`}>{eyebrow}</p>
        ) : null}
        <h1 className={`mt-2 text-2xl font-semibold tracking-tight sm:text-3xl ${workspaceHeadingTextClass}`}>
          {title}
        </h1>
        <p className={`mt-2 max-w-3xl text-sm sm:text-base ${workspaceMutedTextClass}`}>{description}</p>
      </div>

      <div className="space-y-3">
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
        {quickActions ? <div className="flex flex-wrap gap-2">{quickActions}</div> : null}
      </div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article key={metric.key} className={`${workspacePanelSoftClass} p-4`}>
          <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>{metric.label}</p>
          <p className={`mt-2 text-2xl font-semibold ${workspaceHeadingTextClass}`}>{metric.value}</p>
          {metric.caption ? <p className={`mt-1 text-xs ${workspaceMutedTextClass}`}>{metric.caption}</p> : null}
        </article>
      ))}
    </div>
  </section>
)

export type { WorkspaceMetric }
export default WorkspaceTopShell
