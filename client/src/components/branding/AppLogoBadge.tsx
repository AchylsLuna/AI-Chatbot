type AppLogoBadgeProps = {
  className?: string
  markClassName?: string
}

const AppLogoBadge = ({
  className = 'h-11 w-11',
  markClassName = 'h-5 w-5 text-[#3bb4db]',
}: AppLogoBadgeProps) => (
  <div
    className={`grid place-items-center rounded-[1.4rem] bg-transparent shadow-[0_10px_22px_rgba(24,66,126,0.12)] ${className}`}
  >
    <svg
      viewBox="0 0 24 24"
      className={markClassName}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v2.5" />
      <path d="M9.2 5.5h5.6" />
      <rect x="6" y="7" width="12" height="10" rx="3" />
      <path d="M4.5 10.2V14" />
      <path d="M19.5 10.2V14" />
      <circle cx="9.8" cy="11.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="11.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M9.4 14.7h5.2" />
    </svg>
  </div>
)

export default AppLogoBadge
