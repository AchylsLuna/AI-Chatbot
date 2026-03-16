import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'
import type { LoginOtpChallenge } from '../types'

type OtpSourcePage = Extract<AppPage, 'login' | 'doctor_login' | 'admin_login'>

type OtpPageProps = {
  challenge: LoginOtpChallenge | null
  sourcePage?: OtpSourcePage | null
  authError: string | null
  isAuthLoading: boolean
  onVerifyOtp: (code: string) => void
  onCancelOtp: () => void
  onResendOtp?: () => void
}

const OTP_LENGTH = 6

const sourceLabelMap: Record<OtpSourcePage, string> = {
  login: 'patient sign in',
  doctor_login: 'doctor sign in',
  admin_login: 'admin sign in',
}

const buildEmptyDigits = () => Array.from({ length: OTP_LENGTH }, () => '')

const resolveExpiryMs = (challenge?: LoginOtpChallenge | null) => {
  if (!challenge) return 0
  const expiresAtMs = new Date(challenge.expiresAt).getTime()
  if (!Number.isNaN(expiresAtMs)) return expiresAtMs
  return Date.now() + challenge.expiresInSeconds * 1000
}

const getRemainingSeconds = (expiresAtMs?: number) => {
  if (!expiresAtMs) return 0
  if (Number.isNaN(expiresAtMs)) return 0
  return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000))
}

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

const OtpPage = ({
  challenge,
  sourcePage = 'login',
  authError,
  isAuthLoading,
  onVerifyOtp,
  onCancelOtp,
  onResendOtp,
}: OtpPageProps) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [digits, setDigits] = useState<string[]>(buildEmptyDigits)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [expiresAtMs, setExpiresAtMs] = useState(() => resolveExpiryMs(challenge))
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(expiresAtMs))

  useEffect(() => {
    setDigits(buildEmptyDigits())
    setResendSuccess(false)
    const nextExpiryMs = resolveExpiryMs(challenge)
    setExpiresAtMs(nextExpiryMs)
    setRemainingSeconds(getRemainingSeconds(nextExpiryMs))
  }, [challenge])

  useEffect(() => {
    if (!expiresAtMs) {
      setRemainingSeconds(0)
      return
    }

    const updateCountdown = () => {
      setRemainingSeconds(getRemainingSeconds(expiresAtMs))
    }

    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [expiresAtMs])

  const code = useMemo(() => digits.join(''), [digits])
  const isExpired = Boolean(challenge) && remainingSeconds <= 0
  const resolvedSourcePage = sourcePage ?? 'login'
  const sourceLabel = sourceLabelMap[resolvedSourcePage]

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus()
    inputRefs.current[index]?.select()
  }

  const applyDigits = (value: string, startIndex: number) => {
    const sanitized = value.replace(/[^\d]/g, '')
    if (!sanitized) return

    setDigits((previous) => {
      const next = [...previous]
      let cursor = startIndex
      for (const char of sanitized) {
        if (cursor >= OTP_LENGTH) break
        next[cursor] = char
        cursor += 1
      }
      return next
    })

    const nextFocusIndex = Math.min(startIndex + sanitized.length, OTP_LENGTH - 1)
    window.requestAnimationFrame(() => {
      focusInput(nextFocusIndex)
    })
  }

  const handleDigitChange = (index: number, value: string) => {
    const sanitized = value.replace(/[^\d]/g, '')
    if (sanitized.length > 1) {
      applyDigits(sanitized, index)
      return
    }

    setDigits((previous) => {
      const next = [...previous]
      next[index] = sanitized
      return next
    })

    if (sanitized && index < OTP_LENGTH - 1) {
      window.requestAnimationFrame(() => {
        focusInput(index + 1)
      })
    }
  }

  const handleKeyDown = (index: number, event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      setDigits((previous) => {
        const next = [...previous]
        next[index - 1] = ''
        return next
      })
      focusInput(index - 1)
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusInput(index - 1)
      return
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault()
      focusInput(index + 1)
    }
  }

  const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    applyDigits(event.clipboardData.getData('text'), 0)
  }

  const handleResendOtp = async () => {
    if (!onResendOtp) return
    setResendLoading(true)
    setResendSuccess(false)
    try {
      await onResendOtp()
      setDigits(buildEmptyDigits())
      setResendSuccess(true)
      window.setTimeout(() => setResendSuccess(false), 3000)
      window.requestAnimationFrame(() => {
        focusInput(0)
      })
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <AuthSplitLayout variant="lovable">
      <div className="auth-lovable-page">
        <button type="button" onClick={onCancelOtp} className="auth-lovable-back-link">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to {sourceLabel}
        </button>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--auth-lovable-muted)]">
          Two-step verification
        </p>
        <h2 className="auth-lovable-title mt-3">Verify before continuing</h2>
        <p className="auth-lovable-subtitle">
          {challenge
            ? 'Enter the 6-digit verification code to continue.'
            : 'Your verification session is no longer active. Return to sign in and request a new code.'}
        </p>

        {challenge ? (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  isExpired
                    ? 'border border-amber-300/60 bg-amber-100 text-amber-700'
                    : 'border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface-soft)] text-[color:var(--auth-lovable-ink)]'
                }`}
              >
                {isExpired ? 'Code expired' : `Expires in ${formatCountdown(remainingSeconds)}`}
              </span>
            </div>

            {challenge.otpPreview ? (
              <div className="mt-5 rounded-2xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-700 sm:text-[15px]">
                Demo OTP: <span className="font-semibold tracking-[0.2em]">{challenge.otpPreview}</span>
              </div>
            ) : null}

            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault()
                onVerifyOtp(code)
              }}
            >
              <div onPaste={handlePaste}>
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {digits.map((digit, index) => (
                    <input
                      key={`otp-digit-${index}`}
                      ref={(node) => {
                        inputRefs.current[index] = node
                      }}
                      value={digit}
                      onChange={(event) => handleDigitChange(index, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(index, event)}
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      className="h-14 w-full rounded-2xl border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface-soft)] text-center text-lg font-semibold tracking-[0.12em] text-[color:var(--auth-lovable-ink)] outline-none transition focus:border-[color:var(--auth-lovable-accent)] focus:ring-2 focus:ring-[color:var(--auth-lovable-ring)]"
                      maxLength={1}
                      aria-label={`OTP digit ${index + 1}`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-[color:var(--auth-lovable-muted)]">
                  Paste a full 6-digit code or enter it one digit at a time.
                </p>
              </div>

              <button
                type="submit"
                disabled={isAuthLoading || code.length !== OTP_LENGTH || isExpired}
                className="auth-lovable-primary-button h-12 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAuthLoading ? 'Verifying...' : 'Verify and continue'}
              </button>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendLoading || isAuthLoading || !onResendOtp}
                  className="auth-lovable-secondary-button h-11 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resendLoading ? 'Sending...' : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={onCancelOtp}
                  disabled={isAuthLoading || resendLoading}
                  className="auth-lovable-secondary-button h-11 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>

              {resendSuccess ? (
                <p className="rounded-2xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-700">
                  A new code was sent. Use the latest OTP to continue.
                </p>
              ) : null}
            </form>
          </>
        ) : (
          <div className="mt-8">
            <button
              type="button"
              onClick={onCancelOtp}
              className="auth-lovable-primary-button h-12 w-full"
            >
              Return to {sourceLabel}
            </button>
          </div>
        )}

        {authError ? (
          <p className="mt-5 rounded-2xl border border-rose-300/35 bg-rose-300/10 px-4 py-3 text-sm text-rose-700">
            {authError}
          </p>
        ) : null}
      </div>
    </AuthSplitLayout>
  )
}

export default OtpPage
