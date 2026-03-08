import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'

type StickyOffsetMode = 'compact' | 'header' | 'auto'

type WorkspaceSidebarShellProps = {
  sidebar: ReactNode
  content: ReactNode
  mobileTitle?: string
  stickyOffsetMode?: StickyOffsetMode
  className?: string
  contentClassName?: string
}

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const resolveOffsetMode = (mode: StickyOffsetMode): 'compact' | 'header' => {
  if (mode !== 'auto') return mode
  if (typeof document === 'undefined') return 'compact'
  return document.querySelector('[data-workspace-header="true"]') ? 'header' : 'compact'
}

const WorkspaceSidebarShell = ({
  sidebar,
  content,
  mobileTitle = 'Workspace navigation',
  stickyOffsetMode = 'auto',
  className,
  contentClassName,
}: WorkspaceSidebarShellProps) => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(min-width: 1024px)').matches
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const resolvedOffsetMode = resolveOffsetMode(stickyOffsetMode)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleViewportChange = (event: MediaQueryListEvent) => {
      const desktop = event.matches
      setIsDesktop(desktop)
      if (desktop) {
        setDrawerOpen(false)
      }
    }

    mediaQuery.addEventListener('change', handleViewportChange)

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange)
    }
  }, [])

  useEffect(() => {
    if (isDesktop || !drawerOpen || typeof document === 'undefined') return

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDrawerOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const drawer = drawerRef.current
      if (!drawer) return

      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden')
      )

      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
        return
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      previousFocusRef.current?.focus()
    }
  }, [drawerOpen, isDesktop])

  const closeDrawer = () => {
    setDrawerOpen(false)
  }

  const handleDrawerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDrawer()
    }
  }

  const handleNavClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-sidebar-nav-item="true"]')) {
      closeDrawer()
    }
  }

  return (
    <div className={`workspace-shell ${className ?? ''}`}>
      {!isDesktop ? (
        <div className="workspace-shell-mobile-bar lg:hidden">
          <button
            type="button"
            ref={triggerRef}
            className="workspace-shell-mobile-trigger"
            aria-expanded={drawerOpen}
            aria-controls="workspace-sidebar-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            <span aria-hidden="true">☰</span>
            <span>{mobileTitle}</span>
          </button>
        </div>
      ) : null}

      {isDesktop ? (
        <aside className="workspace-shell-rail" data-offset={resolvedOffsetMode}>
          <div className="workspace-shell-rail-inner">{sidebar}</div>
        </aside>
      ) : null}

      <section className={`workspace-shell-content ${contentClassName ?? ''}`}>{content}</section>

      {!isDesktop ? (
        <div
          className={`workspace-shell-drawer lg:hidden ${drawerOpen ? 'is-open' : ''}`}
          aria-hidden={!drawerOpen}
        >
          <button
            type="button"
            className="workspace-shell-drawer-backdrop"
            aria-label="Close navigation menu"
            onClick={closeDrawer}
          />

          <div
            id="workspace-sidebar-drawer"
            ref={drawerRef}
            className="workspace-shell-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClickCapture={handleNavClickCapture}
            onKeyDown={handleDrawerKeyDown}
          >
            <div className="workspace-shell-drawer-header">
              <p id={titleId} className="workspace-shell-drawer-title">
                {mobileTitle}
              </p>
              <button
                type="button"
                ref={closeButtonRef}
                className="workspace-shell-drawer-close"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>

            <div className="workspace-shell-drawer-body">{sidebar}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default WorkspaceSidebarShell
