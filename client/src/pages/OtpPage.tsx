import { useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'
import type { LoginOtpChallenge } from '../types/triage'

type OtpPageProps = {
  challenge: LoginOtpChallenge | null
  authError: string | null
  isAuthLoading: boolean
  onVerifyOtp: (code: string) => void
  onCancelOtp: () => void
  onNavigate?: (page: AppPage) => void
}

const OtpPage = ({
  challenge,
  authError,
  isAuthLoading,
  onVerifyOtp,
  onCancelOtp,
  onNavigate,
}: OtpPageProps) => {
  const [code, setCode] = useState('')
  const expiryLabel = (() => {
    if (!challenge?.expiresAt) return ''
    const date = new Date(challenge.expiresAt)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  })()

  return (
    <AuthSplitLayout layout="center">
      <div className="mx-auto w-full max-w-md rounded-3xl agent-card p-6 sm:p-8">
        <button
          type="button"
          onClick={onCancelOtp}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-white/60 transition hover:text-white"
        >
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
          Back to login
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--agent-accent)]">
          OTP Verification
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Enter one-time code</h2>
        <p className="mt-2 text-sm text-white/60">
          {challenge
            ? `We generated a code for ${challenge.username}.`
            : 'Start from login to request a one-time code.'}
        </p>
        {challenge && (
          <p className="mt-2 text-xs text-white/50">
            Code expires at {expiryLabel || challenge.expiresAt}.
          </p>
        )}

        {challenge?.otpPreview && (
          <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-xs text-emerald-200">
            Demo OTP: <span className="font-semibold">{challenge.otpPreview}</span>
          </div>
        )}

        {!challenge ? (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => onNavigate?.('login')}
              className="agent-button w-full"
            >
              Go to login
            </button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              onVerifyOtp(code.trim())
            }}
          >
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="6-digit OTP code"
              className="agent-input text-center text-lg tracking-[0.35em]"
            />
            <button
              type="submit"
              disabled={isAuthLoading || code.length !== 6}
              className="agent-button w-full disabled:cursor-not-allowed"
            >
              {isAuthLoading ? 'Verifying...' : 'Verify and continue'}
            </button>
            <button type="button" onClick={onCancelOtp} className="agent-button-ghost w-full">
              Cancel
            </button>
          </form>
        )}

        {authError && (
          <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-300">
            {authError}
          </p>
        )}
      </div>
    </AuthSplitLayout>
  )
}

export default OtpPage
