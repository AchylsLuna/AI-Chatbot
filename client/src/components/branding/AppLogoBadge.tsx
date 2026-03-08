type AppLogoBadgeProps = {
  className?: string
  markClassName?: string
}

const AppLogoBadge = ({
  className = 'h-11 w-11',
  markClassName = 'h-5 w-5 text-[color:var(--agent-accent)]',
}: AppLogoBadgeProps) => (
  <div
    className={`grid place-items-center rounded-[1.3rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] shadow-[var(--card-shadow-soft)] ${className}`}
  >
    <svg
      viewBox="0 0 24 24"
      className={markClassName}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12h2.6l2.3-3.3 3.2 7 2.1-3.7H20" opacity="0.25" />
      <path d="M5.5 12h3.2l2.1-3.1 2.7 6.2 1.9-3.1h3.1" />
    </svg>
  </div>
)

export default AppLogoBadge
