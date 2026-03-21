import { stateCardClass } from '../../styles/uiClassNames'

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
      <div className={`${stateCardClass} p-7`}>
        <p className="agent-eyebrow">Preparing session</p>
        <h1 className="ui-display-state-title mt-4 text-2xl font-semibold text-[color:var(--agent-ink)]">
          Checking access
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--agent-muted)]">{label}</p>
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
      <div className={`${stateCardClass} p-8`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--agent-danger)]">
          Access blocked
        </p>
        <h1 className="ui-display-state-title mt-3 text-4xl font-semibold text-[color:var(--agent-ink)]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onSwitchAccount}
            className="agent-button px-4 py-2.5 text-xs text-[color:var(--agent-on-accent)]"
          >
            Switch account
          </button>
          <button
            onClick={onBackToOverview}
            className="agent-button-ghost px-4 py-2.5 text-xs"
          >
            Back to overview
          </button>
        </div>
      </div>
    </div>
  </div>
)
