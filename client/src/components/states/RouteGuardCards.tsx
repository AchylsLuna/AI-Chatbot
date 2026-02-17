type AuthLoadingCardProps = {
  label: string
}

type AccessDeniedCardProps = {
  title: string
  detail: string
  onSwitchAccount: () => void
  onBackToOverview: () => void
}

export const AuthLoadingCard = ({ label }: AuthLoadingCardProps) => (
  <div className="min-h-screen pb-20">
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 text-sm text-white/70 shadow-2xl shadow-black/40">
        {label}
      </div>
    </div>
  </div>
)

export const AccessDeniedCard = ({
  title,
  detail,
  onSwitchAccount,
  onBackToOverview,
}: AccessDeniedCardProps) => (
  <div className="min-h-screen pb-20">
    <div className="mx-auto w-full max-w-4xl px-6 py-14">
      <div className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Access blocked
        </p>
        <h1 className="mt-2 text-2xl font-display font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onSwitchAccount}
            className="rounded-xl bg-[color:var(--agent-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5"
          >
            Switch account
          </button>
          <button
            onClick={onBackToOverview}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Back to overview
          </button>
        </div>
      </div>
    </div>
  </div>
)
