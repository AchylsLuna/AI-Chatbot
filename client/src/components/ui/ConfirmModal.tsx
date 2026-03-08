import { chipButtonClass, modalBackdropClass, modalPanelClass } from '../../styles/uiClassNames'

type ConfirmModalProps = {
  open: boolean
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className={modalBackdropClass}>
      <div className={modalPanelClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="agent-eyebrow">Confirm action</p>
            <h3 className="mt-4 text-xl font-semibold text-[color:var(--agent-ink)]">{title}</h3>
            {message ? <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">{message}</p> : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className={chipButtonClass}
            aria-label="Close confirmation dialog"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="agent-button-ghost px-4 py-2.5 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="agent-button px-4 py-2.5 text-sm text-[color:var(--agent-on-accent)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
