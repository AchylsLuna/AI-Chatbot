import { useEffect, useId, useMemo, useState } from 'react'
import {
  pageGhostButtonClass,
  pageHeadingTextClass,
  pageMutedTextClass,
  pagePanelSoftClass,
  pagePrimaryButtonClass,
  pageSubtleTextClass,
} from '../../styles/pageUi'
import type { UserRole } from '../../types'
import {
  getAvatarInitials,
  loadProfileAvatar,
  readProfileAvatarAsDataUrl,
  removeProfileAvatar,
  saveProfileAvatar,
  validateProfileAvatarFile,
} from '../../utils/profileAvatar'

type ProfileAvatarSettingsCardProps = {
  username: string
  role?: UserRole | null
  title?: string
  description?: string
  className?: string
  onAvatarChange?: (avatarUrl: string | null) => void
}

const ProfileAvatarSettingsCard = ({
  username,
  role,
  title = 'Profile photo',
  description = 'Upload a profile photo to personalize your account identity.',
  className,
  onAvatarChange,
}: ProfileAvatarSettingsCardProps) => {
  const inputId = useId()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => loadProfileAvatar(username, role))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const initials = useMemo(() => getAvatarInitials(username, 'U'), [username])

  useEffect(() => {
    const next = loadProfileAvatar(username, role)
    setAvatarUrl(next)
    setFeedback(null)
    setError(null)
  }, [username, role])

  const handleFileSelection = async (file: File | null) => {
    if (!file) return

    setFeedback(null)
    setError(null)

    const validation = validateProfileAvatarFile(file)
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    setIsUpdating(true)
    try {
      const dataUrl = await readProfileAvatarAsDataUrl(file)
      saveProfileAvatar({
        username,
        role,
        dataUrl,
        mimeType: file.type,
      })
      setAvatarUrl(dataUrl)
      onAvatarChange?.(dataUrl)
      setFeedback('Profile photo updated.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to update profile photo.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemovePhoto = () => {
    removeProfileAvatar(username, role)
    setAvatarUrl(null)
    onAvatarChange?.(null)
    setFeedback('Profile photo removed.')
    setError(null)
  }

  return (
    <article className={`${pagePanelSoftClass} p-4 ${className ?? ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-base font-semibold ${pageHeadingTextClass}`}>{title}</h3>
          <p className={`mt-1 text-sm ${pageMutedTextClass}`}>{description}</p>
        </div>
        <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface)]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${username} profile`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-sm font-semibold text-[color:var(--agent-ink)]">
              {initials}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <label
          htmlFor={inputId}
          className={`${pagePrimaryButtonClass} cursor-pointer ${isUpdating ? 'pointer-events-none opacity-70' : ''}`}
        >
          {avatarUrl ? 'Replace photo' : 'Upload photo'}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            void handleFileSelection(file)
            event.currentTarget.value = ''
          }}
        />

        <button
          type="button"
          className={pageGhostButtonClass}
          disabled={!avatarUrl || isUpdating}
          onClick={handleRemovePhoto}
        >
          Remove photo
        </button>
      </div>

      <p className={`mt-2 text-xs ${pageSubtleTextClass}`}>
        PNG, JPEG, or WEBP only. Maximum file size is 2MB.
      </p>

      {feedback ? <p className="mt-2 text-xs font-semibold text-emerald-600">{feedback}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p> : null}
    </article>
  )
}

export default ProfileAvatarSettingsCard
