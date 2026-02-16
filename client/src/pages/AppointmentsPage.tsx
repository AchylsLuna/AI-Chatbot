import { useEffect, useMemo, useState } from 'react'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import WorkspaceSidebar from '../components/layout/WorkspaceSidebar'
import { api } from '../services/api'
import {
  workspaceFieldClass,
  workspaceGhostButtonClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePanelSoftClass,
  workspacePrimaryButtonClass,
  workspaceSubtleTextClass,
} from '../styles/workspaceUi'
import type { AppPage } from '../types/navigation'
import type { AppointmentUpdateDraft, AuthSession, Reservation } from '../types/triage'
import { canRevealIdentity, maskIdentifier, maskPersonName } from '../utils/privacy'
import { formatRoleLabel } from '../utils/roles'

type AppointmentsPageProps = {
  reservations: Reservation[]
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
  onUpdateReservation: (reservationId: string, updates: AppointmentUpdateDraft) => Promise<Reservation>
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
}

type UserSidebarSection = 'overview' | 'appointments' | 'medications' | 'records' | 'account'

type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

const userSidebarItems: Array<{
  key: Exclude<UserSidebarSection, 'account'>
  label: string
  caption: string
  icon: 'home' | 'calendar' | 'pill' | 'folder'
}> = [
  {
    key: 'overview',
    label: 'Overview',
    caption: 'Main dashboard summary',
    icon: 'home',
  },
  {
    key: 'appointments',
    label: 'Appointments',
    caption: 'Booked schedules and status',
    icon: 'calendar',
  },
]

const medicationTimeline = [
  { time: '08:00 AM', title: 'Metformin 500mg', status: 'Taken' },
  { time: '12:30 PM', title: 'Vitamin D3', status: 'Scheduled' },
  { time: '06:00 PM', title: 'Lisinopril 10mg', status: 'Scheduled' },
  { time: '09:00 PM', title: 'Atorvastatin 20mg', status: 'Pending' },
]

const secureRecordCards = [
  {
    title: 'Laboratory Panel',
    detail: 'CBC and chemistry profile linked to immutable digest.',
    hash: '0x9f3a...c42b',
  },
  {
    title: 'Radiology Summary',
    detail: 'AI-assisted annotation encrypted and role-restricted.',
    hash: '0x2ad1...98ee',
  },
  {
    title: 'Care Plan Export',
    detail: 'Generated plan signed with clinical approval metadata.',
    hash: '0x73df...11ac',
  },
]

const suggestedSlots = [
  'Tue 09:30 AM - shortest queue',
  'Wed 01:10 PM - specialist available',
  'Fri 10:45 AM - high confidence triage handoff',
]

const secureCommsFeed = [
  {
    sender: 'Care Team',
    text: 'We reviewed your latest triage summary. Keep hydration steady today.',
  },
  {
    sender: 'Wellness AI',
    text: 'Your resting heart rate trend improved this week. Consider a 20-minute light walk.',
  },
]

const notificationPrefKey = 'pulse-ledger-notification-preferences'
const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  browserAlerts: true,
  appointmentReminders: true,
  securityAlerts: true,
}

const canEditAppointments = (role?: AuthSession['user']['role'] | null) =>
  role === 'nurse' || role === 'admin' || role === 'system_admin'

const canOpenDoctorDashboard = (role?: AuthSession['user']['role'] | null) =>
  role === 'nurse' || role === 'admin' || role === 'system_admin'

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return true
}

const panelClass = workspacePanelClass
const panelSoftClass = workspacePanelSoftClass
const headingTextClass = workspaceHeadingTextClass
const mutedTextClass = workspaceMutedTextClass
const subtleTextClass = workspaceSubtleTextClass
const fieldClass = workspaceFieldClass
const primaryButtonClass = workspacePrimaryButtonClass
const ghostButtonClass = workspaceGhostButtonClass

const VitalRing = ({ score }: { score: number }) => {
  const clamped = Math.max(0, Math.min(100, score))
  return (
    <div
      className="grid h-36 w-36 place-items-center rounded-full border border-white/10"
      style={{
        background: `conic-gradient(#64FFDA ${clamped}%, rgba(255,255,255,0.12) 0)`,
      }}
    >
      <div className="grid h-24 w-24 place-items-center rounded-full bg-[rgba(10,25,47,0.9)]">
        <div className="text-center">
          <p className="text-2xl font-semibold text-white">{clamped}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/60">Wellness</p>
        </div>
      </div>
    </div>
  )
}

const AppointmentsPage = ({
  reservations,
  authUser,
  onNavigate,
  onUpdateReservation,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
}: AppointmentsPageProps) => {
  const editable = canEditAppointments(authUser?.role)
  const doctorDashboardAllowed = canOpenDoctorDashboard(authUser?.role)
  const isUserPortal = authUser?.role === 'user'
  const canReveal = canRevealIdentity(authUser?.role)

  const [activeUserSection, setActiveUserSection] = useState<UserSidebarSection>('overview')
  const [showIdentity, setShowIdentity] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTime, setDraftTime] = useState('')
  const [draftStatus, setDraftStatus] = useState<'Booked' | 'Recorded' | 'Failed'>('Booked')
  const [draftDepartment, setDraftDepartment] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    if (typeof window === 'undefined') return defaultNotificationPrefs
    const stored = window.localStorage.getItem(notificationPrefKey)
    if (!stored) return defaultNotificationPrefs
    try {
      return { ...defaultNotificationPrefs, ...JSON.parse(stored) }
    } catch {
      return defaultNotificationPrefs
    }
  })

  const shouldMaskIdentity = dataMaskingEnabled || (editable && !showIdentity)

  const metrics = useMemo(() => {
    const booked = reservations.filter((item) => item.status === 'Booked').length
    const recorded = reservations.filter((item) => item.status === 'Recorded').length
    const failed = reservations.filter((item) => item.status === 'Failed').length
    return { total: reservations.length, booked, recorded, failed }
  }, [reservations])

  const sortedAppointments = useMemo(
    () =>
      [...reservations].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [reservations]
  )

  const wellnessScore = useMemo(() => {
    const base = 68 + metrics.recorded * 4 - metrics.failed * 3 + Math.min(9, metrics.booked * 2)
    return Math.max(32, Math.min(96, base))
  }, [metrics])

  const aiDailyBrief = useMemo(() => {
    const trend = metrics.recorded >= metrics.failed ? 'stabilized' : 'needs close follow-up'
    return `You've maintained better routine consistency this week. Booking outcomes are ${trend}. Based on recent status patterns, consider a light walk and hydration check today.`
  }, [metrics])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(notificationPrefKey, JSON.stringify(notificationPrefs))
  }, [notificationPrefs])

  const beginEdit = (appointment: Reservation) => {
    setEditingId(appointment.id)
    setDraftTime(appointment.requestedTime)
    setDraftStatus(appointment.status)
    setDraftDepartment(appointment.department)
    setFormError(null)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setIsSaving(true)
    setFormError(null)
    try {
      await onUpdateReservation(editingId, {
        requestedTime: draftTime,
        status: draftStatus,
        department: draftDepartment,
      })
      setEditingId(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to update appointment')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleIdentity = async () => {
    if (dataMaskingEnabled) return
    const next = !showIdentity
    setShowIdentity(next)
    try {
      await api.logAiAlertAction(
        'appointments-identity',
        next ? 'identity_reveal' : 'identity_hide',
        'appointments_workspace'
      )
    } catch (error) {
      console.warn('Unable to record identity visibility action', error)
    }
  }

  const renderAppointmentCards = () => {
    if (sortedAppointments.length === 0) {
      return (
        <div className={`${panelClass} p-6 text-sm ${mutedTextClass}`}>
          No appointments yet. Use "Book new appointment" to start a booking flow.
        </div>
      )
    }

    return (
      <div className="grid gap-4">
        {sortedAppointments.map((appointment) => {
          const isEditing = editingId === appointment.id
          return (
            <article key={appointment.id} className={`${panelClass} p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>
                    {shouldMaskIdentity ? maskIdentifier(appointment.id) : appointment.id}
                  </p>
                  <h2 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>
                    {shouldMaskIdentity
                      ? maskPersonName(appointment.patientName)
                      : appointment.patientName}
                  </h2>
                  <p className={`mt-1 text-sm ${mutedTextClass}`}>
                    {appointment.department} | {appointment.requestedTime}
                  </p>
                </div>
                <span className="rounded-full border border-[rgba(120,139,198,0.34)] bg-[rgba(16,23,42,0.6)] px-3 py-1 text-xs font-semibold text-[#d9e5ff]">
                  {appointment.status}
                </span>
              </div>

              <p className={`mt-4 text-sm ${mutedTextClass}`}>{appointment.summary}</p>

              {editable ? (
                <div className={`mt-5 ${panelSoftClass} p-4`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          value={draftTime}
                          onChange={(event) => setDraftTime(event.target.value)}
                          className={fieldClass}
                          placeholder="Requested time"
                        />
                        <select
                          value={draftStatus}
                          onChange={(event) =>
                            setDraftStatus(event.target.value as 'Booked' | 'Recorded' | 'Failed')
                          }
                          className={fieldClass}
                        >
                          <option value="Booked">Booked</option>
                          <option value="Recorded">Recorded</option>
                          <option value="Failed">Failed</option>
                        </select>
                        <input
                          value={draftDepartment}
                          onChange={(event) => setDraftDepartment(event.target.value)}
                          className={fieldClass}
                          placeholder="Department"
                        />
                      </div>
                      {formError && <p className="text-xs font-semibold text-rose-300">{formError}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={isSaving}
                          className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          {isSaving ? 'Saving...' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className={ghostButtonClass}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEdit(appointment)}
                      className={ghostButtonClass}
                    >
                      Edit appointment
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    )
  }

  const renderOverviewPanel = () => (
    <div className="space-y-5">
      <div className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>AI Daily Brief</p>
        <p className={`mt-3 text-sm leading-relaxed ${mutedTextClass}`}>{aiDailyBrief}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className={`${panelClass} p-6`}>
          <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Vital Ring</p>
          <h3 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>Combined Wellness Score</h3>
          <div className="mt-4 flex items-center justify-center">
            <VitalRing score={wellnessScore} />
          </div>
        </div>

        <div className={`${panelClass} p-6`}>
          <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Secure Comms</p>
          <h3 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>Care Team Messaging</h3>
          <div className="mt-4 space-y-3">
            {secureCommsFeed.map((message) => (
              <div key={message.text} className={`${panelSoftClass} p-4`}>
                <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>{message.sender}</p>
                <p className={`mt-2 text-sm ${mutedTextClass}`}>{message.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total', value: metrics.total },
          { label: 'Booked', value: metrics.booked },
          { label: 'Recorded', value: metrics.recorded },
        ].map((card) => (
          <div key={card.label} className={`${panelSoftClass} p-4`}>
            <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  )

  const renderAppointmentSection = () => (
    <div className="space-y-4">
      <article className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>AI Time Optimizer</p>
        <h3 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>Suggested Appointment Slots</h3>
        <ul className={`mt-3 space-y-2 text-sm ${mutedTextClass}`}>
          {suggestedSlots.map((slot) => (
            <li key={slot}>{slot}</li>
          ))}
        </ul>
      </article>
      {renderAppointmentCards()}
    </div>
  )

  const renderMedicationsSection = () => (
    <div className="space-y-4">
      <article className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Medication Timeline</p>
        <h3 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>Today's Tracker</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {medicationTimeline.map((item) => (
            <div key={`${item.time}-${item.title}`} className={`${panelSoftClass} p-4`}>
              <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>{item.time}</p>
              <p className={`mt-2 text-sm font-semibold ${headingTextClass}`}>{item.title}</p>
              <p className={`mt-1 text-xs ${mutedTextClass}`}>{item.status}</p>
            </div>
          ))}
        </div>
      </article>

      <article className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Refill Prediction</p>
        <p className={`mt-3 text-sm ${mutedTextClass}`}>
          AI predicts your Metformin supply will reach reorder threshold in 6 days.
        </p>
      </article>
    </div>
  )

  const renderRecordsSection = () => (
    <div className="space-y-4">
      <article className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Encrypted Vault</p>
        <h3 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>My Records</h3>
        <p className={`mt-2 text-sm ${mutedTextClass}`}>
          Records are encrypted in transit and linked to immutable ledger references.
        </p>
      </article>

      <div className="grid gap-4 lg:grid-cols-3">
        {secureRecordCards.map((record) => (
          <article key={record.hash} className={`${panelClass} p-5`}>
            <h4 className={`text-base font-semibold ${headingTextClass}`}>{record.title}</h4>
            <p className={`mt-2 text-sm ${mutedTextClass}`}>{record.detail}</p>
            <p className={`mt-3 text-xs ${subtleTextClass}`}>Digest: {record.hash}</p>
          </article>
        ))}
      </div>
    </div>
  )

  const renderAccountSection = () => (
    <div className={`${panelClass} p-6`}>
      <h2 className={`text-xl font-semibold ${headingTextClass}`}>Account and Privacy Settings</h2>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`${panelSoftClass} p-4`}>
          <p className={`text-sm ${mutedTextClass}`}>
            Signed in as <span className={`font-semibold ${headingTextClass}`}>{authUser?.username ?? 'Unknown'}</span>
          </p>
          <p className={`mt-2 text-sm ${mutedTextClass}`}>
            Role: <span className={`font-semibold ${headingTextClass}`}>{formatRoleLabel(authUser?.role)}</span>
          </p>
          {editable && canReveal ? (
            <button
              type="button"
              onClick={toggleIdentity}
              disabled={dataMaskingEnabled}
              className={`mt-4 ${ghostButtonClass} ${dataMaskingEnabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              {dataMaskingEnabled ? 'Data masking is active in header' : showIdentity ? 'Hide identity' : 'View identity'}
            </button>
          ) : null}
        </div>

        <div className={`${panelSoftClass} p-4`}>
          <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>Theme mode</p>
          <p className={`mt-2 text-sm ${mutedTextClass}`}>
            Current theme: <span className={`font-semibold ${headingTextClass}`}>{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </p>
          <button type="button" onClick={onToggleTheme} className={`mt-3 ${ghostButtonClass}`}>
            Switch to {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>

        <div className={`${panelSoftClass} p-4 xl:col-span-2`}>
          <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>Notifications</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { key: 'emailAlerts', label: 'Email alerts' },
              { key: 'browserAlerts', label: 'Browser alerts' },
              { key: 'appointmentReminders', label: 'Appointment reminders' },
              { key: 'securityAlerts', label: 'Security alerts' },
            ].map((item) => {
              const prefKey = item.key as keyof NotificationPreferences
              const active = notificationPrefs[prefKey]
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setNotificationPrefs((prev) => ({ ...prev, [prefKey]: !prev[prefKey] }))
                  }
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-[rgba(71,212,200,0.72)] bg-[rgba(71,212,200,0.18)] text-[#eff8ff]'
                      : 'border-[rgba(120,139,198,0.35)] bg-[rgba(12,18,34,0.45)] text-[rgba(208,222,255,0.78)] hover:border-[rgba(146,168,235,0.55)] hover:text-[#eef3ff]'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <form
          className={`${panelSoftClass} p-4 xl:col-span-2`}
          onSubmit={(event) => {
            event.preventDefault()
            setPasswordError(null)
            setPasswordMessage(null)

            if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
              setPasswordError('Fill in current, new, and confirm password.')
              return
            }
            if (!meetsPasswordPolicy(newPassword.trim())) {
              setPasswordError(
                'New password must be at least 8 characters and include uppercase, lowercase, and number.'
              )
              return
            }
            if (newPassword.trim() !== confirmPassword.trim()) {
              setPasswordError('New password and confirm password do not match.')
              return
            }

            setPasswordMessage('Password updated successfully for this session.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
          }}
        >
          <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>Change password</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Current password"
              className={fieldClass}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className={fieldClass}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              className={fieldClass}
            />
          </div>
          {passwordError && <p className="mt-3 text-xs font-semibold text-rose-300">{passwordError}</p>}
          {passwordMessage && (
            <p className="mt-3 text-xs font-semibold text-emerald-300">{passwordMessage}</p>
          )}
          <button type="submit" className={`mt-4 ${primaryButtonClass}`}>
            Update password
          </button>
        </form>
      </div>
    </div>
  )

  const renderUserPanel = () => {
    if (activeUserSection === 'overview') return renderOverviewPanel()
    if (activeUserSection === 'appointments') return renderAppointmentSection()
    if (activeUserSection === 'medications') return renderMedicationsSection()
    if (activeUserSection === 'records') return renderRecordsSection()
    return renderAccountSection()
  }

  const title = editable ? "Doctor's Appointment Console" : 'Healix Patient Portal'
  const subtitle = editable
    ? 'Review and update appointment details from one place.'
    : 'Calm, role-safe workspace for daily health insight and booking guidance.'

  const renderHeroSection = () => (
    <section className={`${panelClass} relative overflow-hidden p-6 sm:p-7`}>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_top,rgba(71,212,200,0.2),transparent_68%)] lg:block" />
      <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className={`text-xs uppercase tracking-[0.2em] ${subtleTextClass}`}>Clinical precision portal</p>
          <h1 className={`mt-3 text-3xl font-semibold tracking-tight sm:text-4xl ${headingTextClass}`}>
            {title}
          </h1>
          <p className={`mt-3 max-w-3xl text-sm sm:text-base ${mutedTextClass}`}>{subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (isUserPortal) {
                  setActiveUserSection('appointments')
                  return
                }
                onNavigate?.('triage')
              }}
              className={primaryButtonClass}
            >
              {isUserPortal ? 'Open appointments' : 'Book new appointment'}
            </button>
            {doctorDashboardAllowed && (
              <button
                type="button"
                onClick={() => onNavigate?.('doctor_dashboard')}
                className={ghostButtonClass}
              >
                Open command center
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Total', value: metrics.total },
            { label: 'Booked', value: metrics.booked },
            { label: 'Recorded', value: metrics.recorded },
            { label: 'Failed', value: metrics.failed },
          ].map((card) => (
            <div key={card.label} className={`${panelSoftClass} p-4`}>
              <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>{card.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )

  const renderUserSectionIntro = () => {
    if (activeUserSection === 'overview') {
      return renderHeroSection()
    }

    const introBySection: Record<
      Exclude<UserSidebarSection, 'overview'>,
      { eyebrow: string; title: string; description: string }
    > = {
      appointments: {
        eyebrow: 'Appointment workspace',
        title: 'Appointment bookings',
        description:
          'View booked schedules, update booking details, and track appointment outcomes in one place.',
      },
      medications: {
        eyebrow: 'Medication workspace',
        title: 'Medication tracker',
        description:
          'Monitor daily medications, refill predictions, and timeline status from your care plan.',
      },
      records: {
        eyebrow: 'Encrypted vault',
        title: 'Medical records',
        description:
          'Access role-safe records linked to immutable digests and protected clinical metadata.',
      },
      account: {
        eyebrow: 'Account workspace',
        title: 'Account settings',
        description:
          'Manage password updates, notification preferences, and privacy controls for your session.',
      },
    }

    const intro = introBySection[activeUserSection]
    return (
      <section className={`${panelClass} p-6 sm:p-7`}>
        <p className={`text-xs uppercase tracking-[0.2em] ${subtleTextClass}`}>{intro.eyebrow}</p>
        <h1 className={`mt-3 text-3xl font-semibold tracking-tight sm:text-4xl ${headingTextClass}`}>
          {intro.title}
        </h1>
        <p className={`mt-3 max-w-3xl text-sm sm:text-base ${mutedTextClass}`}>{intro.description}</p>
      </section>
    )
  }

  const renderUserSidebar = (className: string) => (
    <WorkspaceSidebar
      className={className}
      brandTitle="Healix AI"
      brandSubtitle="Patient workspace"
      onBrandClick={() => onNavigate?.('landing')}
      sectionLabel="Main"
      items={userSidebarItems}
      activeKey={activeUserSection === 'account' ? 'overview' : activeUserSection}
      onSelect={(key) => setActiveUserSection(key as UserSidebarSection)}
      statusLabel="Security Shield"
      statusValue={dataMaskingEnabled ? 'Data masking active' : 'Clinical visibility mode'}
      profileLabel="Signed in"
      profileValue={authUser?.username ?? 'Unknown'}
      profileCaption={formatRoleLabel(authUser?.role)}
    />
  )

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        {isUserPortal ? (
          <div className="grid items-start gap-6 xl:grid-cols-[17.5rem_minmax(0,1fr)]">
            {renderUserSidebar('h-fit p-0 xl:self-start')}
            <div className="space-y-6">
              {renderUserSectionIntro()}
              <section className="space-y-6">{renderUserPanel()}</section>
            </div>
          </div>
        ) : (
          <section className="space-y-6">
            {renderHeroSection()}
            <div className={`${panelClass} p-6`}>
              <div className="flex flex-wrap items-center gap-2">
                {canReveal ? (
                  <button
                    type="button"
                    onClick={toggleIdentity}
                    disabled={dataMaskingEnabled}
                    className={`${ghostButtonClass} ${dataMaskingEnabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    {dataMaskingEnabled ? 'Data masking is active in header' : showIdentity ? 'Hide identity' : 'View identity'}
                  </button>
                ) : null}
              </div>
            </div>
            {renderAppointmentSection()}
          </section>
        )}
      </div>
    </WorkspaceCanvas>
  )
}

export default AppointmentsPage
