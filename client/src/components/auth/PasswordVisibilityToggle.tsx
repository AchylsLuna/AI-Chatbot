type PasswordVisibilityToggleProps = {
  visible: boolean
  onToggle: () => void
  visibleLabel?: string
  hiddenLabel?: string
}

const PasswordVisibilityToggle = ({
  visible,
  onToggle,
  visibleLabel = 'Hide password',
  hiddenLabel = 'Show password',
}: PasswordVisibilityToggleProps) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? visibleLabel : hiddenLabel}
      aria-pressed={visible}
      className="auth-lovable-password-toggle"
    >
      {visible ? (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3l18 18" />
          <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
          <path d="M9.88 4.24A9.9 9.9 0 0112 4c5.05 0 9.27 3.11 11 8-0.6 1.69-1.61 3.2-2.92 4.41" />
          <path d="M6.23 6.23C4.04 7.48 2.4 9.46 1 12c1.73 4.89 5.95 8 11 8 1.62 0 3.15-0.32 4.53-0.9" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  )
}

export default PasswordVisibilityToggle
