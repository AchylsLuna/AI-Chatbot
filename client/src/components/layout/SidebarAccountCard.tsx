import React, { useEffect, useState } from 'react'
import {
  workspaceGhostButtonClass,
  workspaceMutedTextClass,
  workspacePanelSoftClass,
  workspaceSubtleTextClass,
} from '../../styles/workspaceUi'
import { api } from '../../services/api'

type NotificationSettings = {
  email: boolean
  sms: boolean
  push: boolean
}

type SidebarAccountCardProps = {
  username: string
  roleLabel: string
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

const SidebarAccountCard = ({
  username,
  roleLabel,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: SidebarAccountCardProps) => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    sms: false,
    push: true,
  })

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api
      .getUserSettings()
      .then((s) => {
        if (!mounted) return
        if (s && s.notifications) setNotifications(s.notifications)
      })
      .catch(() => {
        // ignore - keep defaults
      })
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [])

  const toggle = async (key: keyof NotificationSettings) => {
    const next = { ...notifications, [key]: !notifications[key] }
    setNotifications(next)
    setSaving(true)
    try {
      await api.updateUserSettings({ notifications: next })
    } catch (err) {
      // revert on error
      setNotifications(notifications)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${workspacePanelSoftClass} p-3.5`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
        Account settings
      </p>

      <div className="mt-2.5 space-y-1.5">
        <p className={`text-xs ${workspaceMutedTextClass}`}>
          Signed in as <span className="font-semibold text-[color:var(--agent-ink)]">{username}</span>
        </p>
        <p className={`text-xs ${workspaceSubtleTextClass}`}>{roleLabel}</p>
        <p className={`text-xs ${workspaceMutedTextClass}`}>
          Session: <span className="font-semibold text-[color:var(--agent-ink)]">{sessionStatus}</span>
        </p>
        <p className={`text-xs ${workspaceMutedTextClass}`}>
          Data masking:{' '}
          <span className="font-semibold text-[color:var(--agent-ink)]">
            {dataMaskingEnabled ? 'On' : 'Off'}
          </span>
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <button type="button" onClick={onToggleTheme} className={`${workspaceGhostButtonClass} w-full`}>
          Theme: {theme === 'dark' ? 'Dark' : 'Light'}
        </button>
        <button
          type="button"
          onClick={onToggleDataMasking}
          className={`${workspaceGhostButtonClass} w-full`}
        >
          {dataMaskingEnabled ? 'Turn masking off' : 'Turn masking on'}
        </button>

        <div className="mt-2">
          <p className="text-xs font-semibold">Notifications</p>
          <div className="mt-2 space-y-1">
            <button
              type="button"
              onClick={() => toggle('email')}
              className={`${workspaceGhostButtonClass} w-full flex justify-between items-center`}
              disabled={loading || saving}
            >
              <span>Email</span>
              <span className="text-sm text-[color:var(--agent-muted)]">{notifications.email ? 'On' : 'Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggle('sms')}
              className={`${workspaceGhostButtonClass} w-full flex justify-between items-center`}
              disabled={loading || saving}
            >
              <span>SMS</span>
              <span className="text-sm text-[color:var(--agent-muted)]">{notifications.sms ? 'On' : 'Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggle('push')}
              className={`${workspaceGhostButtonClass} w-full flex justify-between items-center`}
              disabled={loading || saving}
            >
              <span>Push</span>
              <span className="text-sm text-[color:var(--agent-muted)]">{notifications.push ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SidebarAccountCard
