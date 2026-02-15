type AppLogoBadgeProps = {
  className?: string
  markClassName?: string
}

const AppLogoBadge = ({
  className = 'h-11 w-11',
  markClassName = 'h-5 w-5 text-[#3bb4db]',
}: AppLogoBadgeProps) => (
  <div
    className={`grid place-items-center rounded-[1.4rem] border border-[#d7e2f1] bg-[#f8fbff] shadow-[0_10px_22px_rgba(24,66,126,0.12)] ${className}`}
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
      <path d="M5.5 12h3.2l2.1-3.1 2.7 6.2 1.9-3.1h3.1" />
    </svg>
  </div>
)

export default AppLogoBadge
