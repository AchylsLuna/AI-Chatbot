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
}

type UserSidebarSection = 'overview' | 'appointments' | 'book' | 'account'

const userSidebarItems: Array<{
  key: UserSidebarSection
  label: string
  caption: string
  icon: 'home' | 'calendar' | 'book' | 'user'
}> = [
  {
    key: 'overview',
    label: 'Overview',
    caption: 'Quick appointment status',
    icon: 'home',
  },
  {
    key: 'appointments',
    label: 'Appointments',
    caption: 'Your booked records',
    icon: 'calendar',
  },
  {
    key: 'book',
    label: 'Book Appointment',
    caption: 'Requirements and booking steps',
    icon: 'book',
  },
  {
    key: 'account',
    label: 'Account',
    caption: 'Login details and role',
    icon: 'user',
  },
]

const canEditAppointments = (role?: AuthSession['user']['role'] | null) =>
  role === 'nurse' || role === 'admin' || role === 'system_admin'

const canOpenDoctorDashboard = (role?: AuthSession['user']['role'] | null) =>
  role === 'nurse' || role === 'admin' || role === 'system_admin'

const notificationPrefKey = 'pulse-ledger-notification-preferences'
type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  browserAlerts: true,
  appointmentReminders: true,
  securityAlerts: true,
}

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

const AppointmentsPage = ({
  reservations,
  authUser,
  onNavigate,
  onUpdateReservation,
  theme,
  onToggleTheme,
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

  const title = editable ? "Doctor's Appointment Console" : 'My Appointments'
  const subtitle = editable
    ? 'Review and update appointment details from one place.'
    : 'Track your appointment bookings and status.'

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
  const nextAppointment = sortedAppointments.find((item) => item.status === 'Booked') ?? null
  const lastUpdated = sortedAppointments[0]?.createdAt
    ? new Date(sortedAppointments[0].createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No records yet'

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
          No appointments yet. Create one from the triage page.
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
                    {editable && !showIdentity ? maskIdentifier(appointment.id) : appointment.id}
                  </p>
                  <h2 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>
                    {editable && !showIdentity
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

  const renderUserPanel = () => {
    if (activeUserSection === 'overview') {
      return (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Total',
                value: metrics.total,
                tint:
                  'from-[rgba(69,90,167,0.42)] via-[rgba(39,52,92,0.76)] to-[rgba(25,32,56,0.84)]',
              },
              {
                label: 'Booked',
                value: metrics.booked,
                tint:
                  'from-[rgba(56,154,221,0.34)] via-[rgba(31,73,120,0.72)] to-[rgba(20,36,61,0.84)]',
              },
              {
                label: 'Recorded',
                value: metrics.recorded,
                tint:
                  'from-[rgba(58,177,137,0.36)] via-[rgba(27,86,72,0.72)] to-[rgba(18,44,41,0.86)]',
              },
              {
                label: 'Failed',
                value: metrics.failed,
                tint:
                  'from-[rgba(178,97,86,0.34)] via-[rgba(96,49,45,0.72)] to-[rgba(52,26,25,0.86)]',
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-[20px] border border-[rgba(117,138,198,0.28)] bg-[linear-gradient(145deg,var(--tw-gradient-stops))] ${card.tint} p-4 shadow-[0_16px_32px_rgba(2,6,18,0.35)]`}
              >
                <p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>{card.label}</p>
                <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className={`${panelClass} p-6`}>
              <h2 className={`text-xl font-semibold ${headingTextClass}`}>Welcome to your user portal</h2>
              <p className={`mt-2 text-sm ${mutedTextClass}`}>
                Use the sidebar to open your appointments, book a new schedule, or review account details.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveUserSection('appointments')}
                  className={primaryButtonClass}
                >
                  Open my appointments
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('triage')}
                  className={ghostButtonClass}
                >
                  Start new booking
                </button>
              </div>
            </div>

            <div className={`${panelClass} p-6`}>
              <h3 className={`text-base font-semibold ${headingTextClass}`}>Live appointment insight</h3>
              <div className="mt-4 space-y-3">
                <div className={`${panelSoftClass} p-4`}>
                  <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>Next booked</p>
                  <p className={`mt-2 text-sm font-semibold ${headingTextClass}`}>
                    {nextAppointment
                      ? `${nextAppointment.patientName} | ${nextAppointment.requestedTime}`
                      : 'No booked appointment yet'}
                  </p>
                </div>
                <div className={`${panelSoftClass} p-4`}>
                  <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>Last updated</p>
                  <p className={`mt-2 text-sm font-semibold ${headingTextClass}`}>{lastUpdated}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (activeUserSection === 'appointments') {
      return renderAppointmentCards()
    }

    if (activeUserSection === 'book') {
      return (
        <div className="space-y-4">
          <div className={`${panelClass} p-6`}>
            <h2 className={`text-xl font-semibold ${headingTextClass}`}>Book appointment</h2>
            <p className={`mt-2 text-sm ${mutedTextClass}`}>
              Complete the requirements below, then follow the guided booking flow.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <article className={`${panelClass} p-6`}>
              <h3 className={`text-base font-semibold ${headingTextClass}`}>Requirements</h3>
              <ul className={`mt-3 space-y-2 text-sm ${mutedTextClass}`}>
                <li>Signed-in account (User, Nurse, Admin, or Super Admin).</li>
                <li>Clear symptom details (duration, severity, and context).</li>
                <li>Preferred booking time and patient full name.</li>
                <li>Non-emergency case. For emergencies, contact local services.</li>
              </ul>
            </article>

            <article className={`${panelClass} p-6`}>
              <h3 className={`text-base font-semibold ${headingTextClass}`}>How to book</h3>
              <ol className={`mt-3 space-y-2 text-sm ${mutedTextClass}`}>
                <li>1. Open the triage workspace.</li>
                <li>2. Enter symptoms in guided chat.</li>
                <li>3. Review AI recommendation and confidence.</li>
                <li>4. Enter patient name and requested time.</li>
                <li>5. Submit booking and check status in Appointments.</li>
              </ol>
            </article>
          </div>

          <div className={`${panelClass} p-6`}>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => onNavigate?.('triage')} className={primaryButtonClass}>
                Start booking now
              </button>
              <button
                type="button"
                onClick={() => setActiveUserSection('appointments')}
                className={ghostButtonClass}
              >
                View my appointments
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className={`${panelClass} p-6`}>
        <h2 className={`text-xl font-semibold ${headingTextClass}`}>Account details</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={`${panelSoftClass} p-4`}>
            <p className={`text-sm ${mutedTextClass}`}>
              Signed in as <span className={`font-semibold ${headingTextClass}`}>{authUser?.username ?? 'Unknown'}</span>
            </p>
            <p className={`mt-2 text-sm ${mutedTextClass}`}>
              Role: <span className={`font-semibold ${headingTextClass}`}>{formatRoleLabel(authUser?.role)}</span>
            </p>
            <p className={`mt-3 text-xs ${subtleTextClass}`}>
              For role changes, request access from your Super Admin or Admin.
            </p>
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
                const prefKey = item.key as keyof typeof notificationPrefs
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
  }

  const renderUserSidebar = (className: string) => (
    <WorkspaceSidebar
      className={className}
      brandTitle="AI Health Care"
      brandSubtitle="User workspace"
      sectionLabel="User navigation"
      items={userSidebarItems}
      activeKey={activeUserSection}
      onSelect={(key) => setActiveUserSection(key as UserSidebarSection)}
      statusLabel="Compliance"
      statusValue="HIPAA/GDPR Active"
      profileLabel="Signed in"
      profileValue={authUser?.username ?? 'Unknown'}
      profileCaption={formatRoleLabel(authUser?.role)}
    />
  )

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className={`${panelClass} relative overflow-hidden p-6 sm:p-7`}>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_top,rgba(71,212,200,0.2),transparent_68%)] lg:block" />
          <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className={`text-xs uppercase tracking-[0.2em] ${subtleTextClass}`}>Appointment hub</p>
              <h1 className={`mt-3 text-3xl font-semibold tracking-tight sm:text-4xl ${headingTextClass}`}>
                {title}
              </h1>
              <p className={`mt-3 max-w-3xl text-sm sm:text-base ${mutedTextClass}`}>{subtitle}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => onNavigate?.('triage')} className={primaryButtonClass}>
                  Book new appointment
                </button>
                {editable && canReveal && (
                  <button type="button" onClick={toggleIdentity} className={ghostButtonClass}>
                    {showIdentity ? 'Hide identity' : 'View identity'}
                  </button>
                )}
                {doctorDashboardAllowed && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('doctor_dashboard')}
                    className={ghostButtonClass}
                  >
                    Open doctor dashboard
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

        {isUserPortal ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
            {renderUserSidebar(
              'h-fit p-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:rounded-l-none lg:border-l-0 lg:-ml-8 lg:w-[calc(17rem+2rem)]'
            )}
            <section className="space-y-6">{renderUserPanel()}</section>
          </div>
        ) : (
          <section className="mt-6 space-y-6">{renderAppointmentCards()}</section>
        )}
      </div>
    </WorkspaceCanvas>
  )
}

export default AppointmentsPage
