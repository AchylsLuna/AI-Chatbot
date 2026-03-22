import type { ReactNode } from 'react'
import {
  pageHeadingTextClass,
  pageMutedTextClass,
  pagePanelClass,
  pagePanelSoftClass,
  pageSubtleTextClass,
} from '../../styles/pageUi'

type SectionCardProps = {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  surface?: 'default' | 'soft'
}

const SectionCard = ({
  title,
  description,
  eyebrow,
  actions,
  toolbar,
  children,
  className,
  bodyClassName,
  surface = 'default',
}: SectionCardProps) => {
  const surfaceClass = surface === 'soft' ? pagePanelSoftClass : pagePanelClass

  return (
    <section className={`${surfaceClass} overflow-hidden ${className ?? ''}`.trim()}>
      <div className="border-b border-[color:var(--card-border)] px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            {eyebrow ? (
              <p className={`text-xs uppercase tracking-[0.16em] ${pageSubtleTextClass}`}>{eyebrow}</p>
            ) : null}
            <h2 className={`mt-1 text-[1.2rem] font-semibold tracking-[-0.03em] sm:text-[1.32rem] ${pageHeadingTextClass}`}>{title}</h2>
            {description ? (
              <p className={`mt-2 text-sm leading-6 ${pageMutedTextClass}`}>{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {toolbar ? (
          <div className="mt-4 rounded-[1.1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] px-4 py-3">
            {toolbar}
          </div>
        ) : null}
      </div>

      <div className={`px-5 py-5 sm:px-6 sm:py-6 ${bodyClassName ?? ''}`.trim()}>{children}</div>
    </section>
  )
}

export type { SectionCardProps }
export default SectionCard
