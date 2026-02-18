import React from 'react'

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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[color:var(--agent-surface)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[color:var(--agent-ink)]">{title}</h3>
            {message ? <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{message}</p> : null}
          </div>
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-[color:var(--agent-muted)]">
            ✕
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-3 py-2 text-sm text-[color:var(--agent-muted)] hover:border-[color:var(--agent-line)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-[color:var(--agent-accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
