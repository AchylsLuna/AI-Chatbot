import { useMemo, useState, useEffect, useRef } from 'react'
import ConfirmModal from '../components/ui/ConfirmModal'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../components/layout/Sidebar'
import WorkspaceSidebarShell from '../components/layout/WorkspaceSidebarShell'
import WorkspaceTopShell from '../components/layout/WorkspaceTopShell'
import {
  workspaceFieldClass,
  workspaceGhostButtonClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePrimaryButtonClass,
  workspaceSubtleTextClass,
} from '../styles/workspaceUi'
import { buildRouteFromCanonicalPath, normalizePath } from '../config/routing'
import { getDoctorTabPath, resolveDoctorTabFromPath } from '../config/workspaceTabRoutes'
import {
  api,
  type DoctorDashboardOverview,
  type DoctorPatientProfile,
  type DoctorQueueStatus,
  type DoctorQueueTimelineItem,
  type PrescriptionDraft,
  type SoapNotePayload,
} from '../services/api'
import type { AuthSession, Reservation } from '../types'
import { maskIdentifier, maskPersonName } from '../utils/privacy'
import { getWorkspaceRoleLabel } from '../utils/roles'

type DoctorDashboardPageProps = {
  authUser: AuthSession['user'] | null
  reservations: Reservation[]
  onLogout: () => void
  onPatchAuthUser?: (updates: Partial<AuthSession['user']>) => void
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

type DoctorSection = 'appointments' | 'queue' | 'analytics' | 'settings'

type AppointmentListItem = {
  id: string
  patientId?: string
  patientName: string
  department: string
  priority: Reservation['priority']
  requestedTime: string
  status: Reservation['status']
  queueStatus: DoctorQueueStatus
  symptoms: string
  flagged: boolean
  checkupHistory: Array<{
    visitDate: string
    primaryDiagnosis: string
  }>
}

const primaryItems: SidebarItem[] = [
  {
    key: 'appointments',
    label: 'Appointments',
    caption: 'Current appointment queue',
    icon: 'calendar',
  },
  {
    key: 'queue',
    label: 'Queue Management',
    caption: 'Patient queue and triage',
    icon: 'hospital',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    caption: 'Department and queue insights',
    icon: 'report',
  },
]

const parseDate = (value: string) => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const formatDateTime = (value: string) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

const formatTime = (value: string) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const queueStatusChipClass = (queueStatus: DoctorQueueStatus) => {
  if (queueStatus === 'Arrived') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  if (queueStatus === 'In-Consultation') return 'border-indigo-300/70 bg-indigo-100 text-indigo-700'
  if (queueStatus === 'Checked-Out') return 'border-emerald-300/70 bg-emerald-100 text-emerald-700'
  if (queueStatus === 'No-Show') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  return 'border-slate-300/70 bg-slate-100 text-slate-700'
}

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const priorityChipClass = (priority: Reservation['priority']) => {
  if (priority === 'High') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (priority === 'Routine') return 'border-sky-300/70 bg-sky-100 text-sky-700'
  if (priority === 'Low') return 'border-slate-300/70 bg-slate-100 text-slate-700'
  return 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)]'
}

const statusChipClass = (status: Reservation['status']) => {
  if (status === 'Recorded') return 'border-emerald-300/70 bg-emerald-100 text-emerald-700'
  if (status === 'Failed') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (status === 'Booked') return 'border-sky-300/70 bg-sky-100 text-sky-700'
  return 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)]'
}

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  if (!/[^A-Za-z0-9]/.test(value)) return false
  return true
}

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

const splitDisplayName = (value: string) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { firstName: '', lastName: '' }

  const [firstName, ...rest] = normalized.split(' ')
  return {
    firstName,
    lastName: rest.join(' ') || 'Doctor',
  }
}

const buildDoctorDisplayName = (user: AuthSession['user'] | null) => {
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  if (fullName) return fullName
  return 'Doctor'
}

const DoctorDashboardPage = ({
  authUser,
  reservations,
  onLogout,
  onPatchAuthUser,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: DoctorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<DoctorSection>(() => {
    if (typeof window === 'undefined') return 'appointments'
    return resolveDoctorTabFromPath(window.location.pathname) ?? 'appointments'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentListItem | null>(null)
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [profileName, setProfileName] = useState(() => buildDoctorDisplayName(authUser))
  const [profileNameDraft, setProfileNameDraft] = useState(() => buildDoctorDisplayName(authUser))
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [doctorOverview, setDoctorOverview] = useState<DoctorDashboardOverview | null>(null)
  const [queueTimeline, setQueueTimeline] = useState<DoctorQueueTimelineItem[]>([])
  const [doctorDataError, setDoctorDataError] = useState<string | null>(null)
  const [isLoadingDoctorData, setIsLoadingDoctorData] = useState(false)
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null)
  const [soapNoteDraft, setSoapNoteDraft] = useState<SoapNotePayload>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  })
  const [soapSaveMessage, setSoapSaveMessage] = useState<string | null>(null)
  const [soapSaveError, setSoapSaveError] = useState<string | null>(null)
  const [prescriptionDraft, setPrescriptionDraft] = useState<PrescriptionDraft>({
    medication: '',
    dosage: '',
    frequency: '',
    durationDays: 7,
    instructions: '',
  })
  const [pendingPrescriptions, setPendingPrescriptions] = useState<PrescriptionDraft[]>([])
  const [prescriptionMessage, setPrescriptionMessage] = useState<string | null>(null)
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null)
  const [frequentPrescriptions, setFrequentPrescriptions] = useState<Array<{ medication: string; count: number }>>([])
  const [medicationQuery, setMedicationQuery] = useState('')
  const [medicationMatches, setMedicationMatches] = useState<Array<{ name: string }>>([])
  const [clockTick, setClockTick] = useState(() => Date.now())
  const [patientProfile, setPatientProfile] = useState<DoctorPatientProfile | null>(null)
  const [isPatientProfileLoading, setIsPatientProfileLoading] = useState(false)
  const [patientProfileError, setPatientProfileError] = useState<string | null>(null)

  useEffect(() => {
    const nextName = buildDoctorDisplayName(authUser)
    setProfileName(nextName)
    setProfileNameDraft(nextName)
  }, [authUser?.firstName, authUser?.lastName, authUser?.username])

  // Auto-logout after 15 minutes of inactivity (900000 ms)
  const INACTIVITY_MS = 15 * 60 * 1000
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const resetInactivityTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setShowLogoutConfirm(false)
      // auto logout after inactivity
      onLogout()
    }, INACTIVITY_MS)
  }

  useEffect(() => {
    resetInactivityTimer()
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart']
    const handler = () => resetInactivityTimer()
    for (const ev of events) window.addEventListener(ev, handler)
    return () => {
      for (const ev of events) window.removeEventListener(ev, handler)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [onLogout])

  const confirmAndLogout = () => {
    setShowLogoutConfirm(true)
  }

  const handleSaveProfileName = async () => {
    const normalizedName = normalizeWhitespace(profileNameDraft)
    setProfileError(null)
    setProfileMessage(null)

    if (!normalizedName || normalizedName.length < 2) {
      setProfileError('Enter a valid name with at least 2 characters.')
      return
    }

    if (normalizedName.length > 60) {
      setProfileError('Name is too long. Keep it under 60 characters.')
      return
    }

    const { firstName, lastName } = splitDisplayName(normalizedName)
    if (!firstName || !lastName) {
      setProfileError('Use both first and last name.')
      return
    }

    setIsSavingProfile(true)
    try {
      const updatedUser = await api.updateProfile({ firstName, lastName })
      const updatedName = `${updatedUser.firstName} ${updatedUser.lastName}`.trim()
      setProfileName(updatedName || normalizedName)
      setProfileNameDraft(updatedName || normalizedName)
      setProfileMessage('Name updated successfully.')
      onPatchAuthUser?.({
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      })
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to update name right now.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSavePassword = async () => {
    const oldValue = currentPassword.trim()
    const nextValue = newPassword.trim()
    const confirmValue = confirmPassword.trim()

    setPasswordError(null)
    setPasswordMessage(null)

    if (!oldValue || !nextValue || !confirmValue) {
      setPasswordError('Fill in current password, new password, and confirm password.')
      return
    }

    if (!meetsPasswordPolicy(nextValue)) {
      setPasswordError(
        'New password must be at least 8 characters with uppercase, lowercase, number, and symbol.'
      )
      return
    }

    if (oldValue === nextValue) {
      setPasswordError('New password must be different from current password.')
      return
    }

    if (nextValue !== confirmValue) {
      setPasswordError('New password and confirm password do not match.')
      return
    }

    setIsSavingPassword(true)
    try {
      await api.changePassword(oldValue, nextValue)
      setPasswordMessage('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Unable to change password right now.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const setSection = (next: DoctorSection) => {
    setActiveSection(next)
    setSelectedAppointment(null)
    setShowAppointmentDetail(false)

    if (typeof window === 'undefined') return

    const targetPath = getDoctorTabPath(next)
    if (normalizePath(window.location.pathname) === normalizePath(targetPath)) return

    window.history.pushState(
      { ...(window.history.state ?? {}), appRoute: true, appPage: 'doctor_dashboard' },
      '',
      buildRouteFromCanonicalPath(targetPath)
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setActiveSection(resolveDoctorTabFromPath(window.location.pathname) ?? 'appointments')
      setSelectedAppointment(null)
      setShowAppointmentDetail(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const loadDoctorWorkspaceData = async () => {
    setIsLoadingDoctorData(true)
    setDoctorDataError(null)
    try {
      const [overview, timeline, frequent] = await Promise.all([
        api.getDoctorDashboardOverview(),
        api.getDoctorQueueTimeline(),
        api.getFrequentPrescriptions(),
      ])
      setDoctorOverview(overview)
      setQueueTimeline(timeline)
      setFrequentPrescriptions(frequent)
    } catch (error) {
      setDoctorDataError(error instanceof Error ? error.message : 'Unable to load doctor workspace data.')
    } finally {
      setIsLoadingDoctorData(false)
    }
  }

  useEffect(() => {
    void loadDoctorWorkspaceData()
    const interval = window.setInterval(() => {
      void loadDoctorWorkspaceData()
    }, 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedAppointment) return
    setSoapNoteDraft({
      subjective: selectedAppointment.symptoms || '',
      objective: '',
      assessment: '',
      plan: '',
    })
    setSoapSaveMessage(null)
    setSoapSaveError(null)
    setPendingPrescriptions([])
    setPrescriptionMessage(null)
    setPrescriptionError(null)
    setMedicationQuery('')
    setMedicationMatches([])
    setPatientProfile(null)
    setPatientProfileError(null)
  }, [selectedAppointment?.id])

  useEffect(() => {
    const query = medicationQuery.trim()
    if (!query) {
      setMedicationMatches([])
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const matches = await api.searchMedications(query)
        setMedicationMatches(matches)
      } catch {
        setMedicationMatches([])
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [medicationQuery])

  const handleQueueStatusChange = async (appointmentId: string, queueStatus: DoctorQueueStatus) => {
    setStatusSavingId(appointmentId)
    setDoctorDataError(null)
    try {
      await api.updateDoctorQueueStatus(appointmentId, queueStatus)
      await loadDoctorWorkspaceData()
    } catch (error) {
      setDoctorDataError(error instanceof Error ? error.message : 'Unable to update queue status.')
    } finally {
      setStatusSavingId(null)
    }
  }

  const handleSaveSoapNote = async () => {
    if (!selectedAppointment) return
    setSoapSaveError(null)
    setSoapSaveMessage(null)
    try {
      await api.saveAppointmentSoapNote(selectedAppointment.id, soapNoteDraft)
      setSoapSaveMessage('SOAP note saved.')
    } catch (error) {
      setSoapSaveError(error instanceof Error ? error.message : 'Unable to save SOAP note.')
    }
  }

  const handleAddPrescription = () => {
    const medication = prescriptionDraft.medication.trim()
    const dosage = prescriptionDraft.dosage.trim()
    if (!medication || !dosage) {
      setPrescriptionError('Medication and dosage are required.')
      return
    }
    setPrescriptionError(null)
    setPendingPrescriptions((previous) => [...previous, { ...prescriptionDraft, medication, dosage }])
    setPrescriptionDraft({
      medication: '',
      dosage: '',
      frequency: '',
      durationDays: 7,
      instructions: '',
    })
    setMedicationQuery('')
    setMedicationMatches([])
  }

  const handleSavePrescriptions = async () => {
    if (!selectedAppointment) return
    if (pendingPrescriptions.length === 0) {
      setPrescriptionError('Add at least one prescription entry.')
      return
    }
    setPrescriptionError(null)
    setPrescriptionMessage(null)
    try {
      await api.saveAppointmentPrescriptions(selectedAppointment.id, pendingPrescriptions)
      setPrescriptionMessage('Prescriptions saved.')
      setPendingPrescriptions([])
      await loadDoctorWorkspaceData()
    } catch (error) {
      setPrescriptionError(error instanceof Error ? error.message : 'Unable to save prescriptions.')
    }
  }

  const handleLoadPatientProfile = async () => {
    if (!selectedAppointment?.patientId) {
      setPatientProfileError('Patient profile is unavailable for this appointment.')
      return
    }
    setIsPatientProfileLoading(true)
    setPatientProfileError(null)
    try {
      const profile = await api.getDoctorPatientProfile(selectedAppointment.patientId)
      setPatientProfile(profile)
    } catch (error) {
      setPatientProfileError(error instanceof Error ? error.message : 'Unable to load patient profile.')
    } finally {
      setIsPatientProfileLoading(false)
    }
  }

  const appointmentItems = useMemo<AppointmentListItem[]>(() => {
    if (queueTimeline.length > 0) {
      return [...queueTimeline]
        .sort((a, b) => parseDate(a.scheduledDate) - parseDate(b.scheduledDate))
        .map((item) => ({
          id: item.appointmentId,
          patientId: item.patientId,
          patientName: item.patientName,
          department: item.department,
          priority: item.triageLevel,
          requestedTime: item.scheduledDate,
          status:
            item.queueStatus === 'Checked-Out'
              ? 'Recorded'
              : item.queueStatus === 'No-Show'
                ? 'Failed'
                : 'Booked',
          queueStatus: item.queueStatus,
          symptoms: item.chiefComplaint,
          flagged: item.triageLevel === 'High' || item.urgentFollowUp,
          checkupHistory: item.checkupHistory,
        }))
    }

    const orderedReservations = [...reservations].sort(
      (a, b) => parseDate(a.requestedTime) - parseDate(b.requestedTime)
    )

    if (!orderedReservations.length) return []

    return orderedReservations.map((reservation) => ({
      id: reservation.id,
      patientName: reservation.patientName,
      department: reservation.department,
      priority: reservation.priority,
      requestedTime: reservation.requestedTime,
      status: reservation.status,
      queueStatus:
        reservation.status === 'Recorded'
          ? 'Checked-Out'
          : reservation.status === 'Failed'
            ? 'No-Show'
            : 'Waiting',
      symptoms: reservation.symptoms,
      flagged: reservation.status === 'Failed' || reservation.priority === 'High',
      checkupHistory: [],
    }))
  }, [queueTimeline, reservations])

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredAppointments = useMemo(() => {
    if (!normalizedQuery) return appointmentItems
    return appointmentItems.filter((item) => {
      return (
        item.patientName.toLowerCase().includes(normalizedQuery) ||
        item.id.toLowerCase().includes(normalizedQuery) ||
        item.department.toLowerCase().includes(normalizedQuery) ||
        item.symptoms.toLowerCase().includes(normalizedQuery) ||
        item.priority.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, appointmentItems])

  const queueItems = useMemo(() => {
    if (!normalizedQuery) return appointmentItems
    return appointmentItems.filter((item) => {
      return (
        item.queueStatus !== 'Checked-Out' &&
        item.queueStatus !== 'No-Show' &&
        (item.patientName.toLowerCase().includes(normalizedQuery) ||
          item.id.toLowerCase().includes(normalizedQuery) ||
          item.department.toLowerCase().includes(normalizedQuery))
      )
    })
  }, [normalizedQuery, appointmentItems])

  const appointmentMetrics = useMemo(() => {
    const total = doctorOverview?.counter.total ?? appointmentItems.length
    const pending = doctorOverview?.counter.pending ?? appointmentItems.filter((item) => item.status === 'Booked').length
    const completed = doctorOverview?.counter.completed ?? appointmentItems.filter((item) => item.status === 'Recorded').length
    const noShows = doctorOverview?.counter.noShows ?? appointmentItems.filter((item) => item.status === 'Failed').length

    return [
      { key: 'apt-total', label: 'Total appointments', value: total, caption: `${filteredAppointments.length} matching` },
      { key: 'apt-pending', label: 'Pending', value: pending, caption: 'Awaiting action' },
      { key: 'apt-completed', label: 'Completed', value: completed, caption: 'Checked out' },
      { key: 'apt-no-show', label: 'No-shows', value: noShows, caption: 'Missed appointments' },
    ]
  }, [appointmentItems, doctorOverview?.counter.completed, doctorOverview?.counter.noShows, doctorOverview?.counter.pending, doctorOverview?.counter.total, filteredAppointments.length])

  const queueMetrics = useMemo(() => {
    const pending = queueItems.filter((item) => item.status === 'Booked').length
    const departments = new Set(queueItems.map((item) => item.department)).size
    const avgPriority = queueItems.filter((item) => item.priority === 'High').length

    return [
      { key: 'queue-pending', label: 'Pending', value: pending, caption: 'Awaiting review' },
      { key: 'queue-depts', label: 'Departments', value: departments, caption: 'Active departments' },
      { key: 'queue-high', label: 'High priority', value: avgPriority, caption: 'In queue' },
      { key: 'queue-total', label: 'Total queue', value: queueItems.length, caption: `${queueItems.length} patients` },
    ]
  }, [queueItems])

  const analyticsMetrics = useMemo(() => {
    const byDept = new Map<string, number>()
    appointmentItems.forEach((item) => {
      byDept.set(item.department, (byDept.get(item.department) || 0) + 1)
    })

    const topDept = Array.from(byDept.entries()).sort(([, a], [, b]) => b - a)[0]
    const topDeptCount = topDept ? topDept[1] : 0

    const completionRate =
      appointmentItems.length > 0
        ? Math.round((appointmentItems.filter((i) => i.status === 'Recorded').length / appointmentItems.length) * 100)
        : 0

    return [
      { key: 'analytics-depts', label: 'Total departments', value: byDept.size, caption: 'Active departments' },
      { key: 'analytics-top', label: 'Top department', value: topDeptCount, caption: topDept?.[0] || 'N/A' },
      { key: 'analytics-completion', label: 'Completion rate', value: `${completionRate}%`, caption: 'Recorded vs total' },
      { key: 'analytics-efficiency', label: 'Processing', value: appointmentItems.length, caption: 'Total processed' },
    ]
  }, [appointmentItems])

  const settingsMetrics = useMemo(
    () => [
      { key: 'settings-name', label: 'Name', value: profileName, caption: 'Profile display name' },
      { key: 'settings-account', label: 'Account', value: authUser?.username ?? 'Unknown', caption: 'Signed in user' },
      { key: 'settings-role', label: 'Role', value: getWorkspaceRoleLabel(authUser?.role), caption: 'Workspace role' },
      { key: 'settings-theme', label: 'Theme', value: theme === 'dark' ? 'Dark' : 'Light', caption: 'Current theme' },
    ],
    [authUser?.role, authUser?.username, profileName, theme]
  )

  const sectionMeta = {
    appointments: {
      title: 'Appointments',
      description: 'View and manage the complete appointment queue with patient details and triage information.',
      searchPlaceholder: 'Search by patient name, ID, department, symptoms, or priority',
      metrics: appointmentMetrics,
    },
    queue: {
      title: 'Queue Management',
      description: 'Manage active patient queue pending review and status updates.',
      searchPlaceholder: 'Search by patient name, ID, or department',
      metrics: queueMetrics,
    },
    analytics: {
      title: 'Analytics',
      description: 'View appointment trends, department load, and operational metrics.',
      searchPlaceholder: 'Filter analytics by department or status',
      metrics: analyticsMetrics,
    },
    settings: {
      title: 'Account Settings',
      description: 'Manage profile name, password security, and doctor workspace preferences.',
      searchPlaceholder: 'Search settings',
      metrics: settingsMetrics,
    },
  } as const

  const activeMeta = sectionMeta[activeSection]
  const nextPatientCountdownSeconds = useMemo(() => {
    if (!doctorOverview?.nextPatient) return 0
    const targetMs = new Date(doctorOverview.nextPatient.scheduledDate).getTime()
    const delta = Math.floor((targetMs - clockTick) / 1000)
    return Math.max(0, delta)
  }, [clockTick, doctorOverview?.nextPatient])

  return (
    <WorkspaceCanvas>
      <div className="w-full">
        <WorkspaceSidebarShell
          className={`workspace-shell--full-side${isSidebarCollapsed ? ' workspace-shell--rail-collapsed' : ''}`}
          contentClassName="px-4 pb-10 pt-5 sm:px-6 lg:px-8"
          mobileTitle="Doctor workspace"
          stickyOffsetMode="auto"
          sidebar={
            <Sidebar
              variant="dashboard"
              mobileMode="drawer"
              fullRail
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
              brandTitle="AI Health Care"
              brandSubtitle="Doctor workspace"
              sectionLabel="Primary"
              items={primaryItems}
              activeKey={activeSection}
              onSelect={(key) => {
                if (key === 'appointments' || key === 'queue' || key === 'analytics') {
                  setSection(key)
                }
              }}
              footerProfile={{
                name: profileName,
                subtitle: authUser?.username ?? 'Doctor workspace',
                onClick: () => setSection('settings'),
              }}
            />
          }
          content={
            <section className="space-y-6">
              <WorkspaceTopShell
                eyebrow="Doctor session"
                title={activeMeta.title}
                description={activeMeta.description}
                searchValue={searchQuery}
                searchPlaceholder={activeMeta.searchPlaceholder}
                onSearchChange={setSearchQuery}
                showSearch={activeSection !== 'settings'}
                showAccountMenu={activeSection !== 'settings'}
                profileName={profileName}
                profileCaption={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                showNotifications
                notificationCount={Math.min(queueItems.length, 99)}
                onSignOut={confirmAndLogout}
                metrics={activeMeta.metrics}
              />

              <ConfirmModal
                open={showLogoutConfirm}
                title="Confirm logout"
                message="Are you sure you want to logout now?"
                confirmLabel="Logout"
                cancelLabel="Cancel"
                onConfirm={() => {
                  setShowLogoutConfirm(false)
                  onLogout()
                }}
                onCancel={() => setShowLogoutConfirm(false)}
              />

              {/* APPOINTMENTS VIEW */}
              {activeSection === 'appointments' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Appointment list</h2>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Complete queue of patient appointments with priority flags and triage data.
                  </p>
                  {doctorDataError ? (
                    <p className="mt-2 text-xs font-semibold text-rose-500">{doctorDataError}</p>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="reference-card-soft p-4">
                      <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Appointment counter</p>
                      <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                        Today: {doctorOverview?.counter.total ?? appointmentItems.length} total
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2">
                          <p className="font-semibold text-emerald-700">{doctorOverview?.counter.completed ?? 0}</p>
                          <p className="text-emerald-700/80">Completed</p>
                        </div>
                        <div className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-2">
                          <p className="font-semibold text-sky-700">{doctorOverview?.counter.pending ?? 0}</p>
                          <p className="text-sky-700/80">Pending</p>
                        </div>
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-2">
                          <p className="font-semibold text-rose-700">{doctorOverview?.counter.noShows ?? 0}</p>
                          <p className="text-rose-700/80">No-shows</p>
                        </div>
                      </div>
                    </div>

                    <div className="reference-card-soft p-4">
                      <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Next patient</p>
                      {doctorOverview?.nextPatient ? (
                        <>
                          <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                            {dataMaskingEnabled
                              ? maskPersonName(doctorOverview.nextPatient.patientName)
                              : doctorOverview.nextPatient.patientName}
                          </p>
                          <p className={`mt-1 text-xs ${workspaceMutedTextClass}`}>{doctorOverview.nextPatient.chiefComplaint}</p>
                          <p className="mt-3 text-2xl font-semibold text-indigo-600">
                            {formatCountdown(nextPatientCountdownSeconds)}
                          </p>
                          <p className={`text-xs ${workspaceMutedTextClass}`}>
                            Starts at {formatTime(doctorOverview.nextPatient.scheduledDate)}
                          </p>
                        </>
                      ) : (
                        <p className={`mt-2 text-sm ${workspaceMutedTextClass}`}>No upcoming patient today.</p>
                      )}
                    </div>

                    <div className="reference-card-soft p-4">
                      <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Urgency / triage flags</p>
                      <div className="mt-2 space-y-2">
                        {(doctorOverview?.urgencyFlags ?? []).slice(0, 4).map((flag) => (
                          <div key={flag.appointmentId} className="flex items-center justify-between rounded-lg border border-[color:var(--card-border)] px-2 py-2 text-xs">
                            <span className="flex items-center gap-2">
                              <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${
                                  flag.triageLevel === 'High' ? 'bg-rose-500' : 'bg-amber-500'
                                }`}
                              />
                              {dataMaskingEnabled ? maskPersonName(flag.patientName) : flag.patientName}
                            </span>
                            <span className={workspaceMutedTextClass}>{flag.triageLevel}</span>
                          </div>
                        ))}
                        {(doctorOverview?.urgencyFlags?.length ?? 0) === 0 ? (
                          <p className={`text-xs ${workspaceMutedTextClass}`}>No urgent flags for today.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {filteredAppointments.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        No appointments match your search query.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {filteredAppointments.map((apt) => {
                        const displayName = dataMaskingEnabled ? maskPersonName(apt.patientName) : apt.patientName
                        const displayId = dataMaskingEnabled ? maskIdentifier(apt.id) : apt.id

                        return (
                          <div
                            key={apt.id}
                            className={`${workspacePanelClass} cursor-pointer p-4 transition-all hover:shadow-md`}
                            onClick={() => {
                              setSelectedAppointment(apt)
                              setShowAppointmentDetail(true)
                            }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={`font-semibold ${workspaceHeadingTextClass}`}>{displayName}</p>
                                  {apt.flagged && (
                                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" title="Flagged" />
                                  )}
                                </div>
                                <p className={`text-xs ${workspaceMutedTextClass}`}>{displayId}</p>
                                <p className={`mt-2 text-sm ${workspaceMutedTextClass}`}>{apt.symptoms}</p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(apt.priority)}`}>
                                  {apt.priority}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                              <span className={workspaceMutedTextClass}>{apt.department}</span>
                              <span className={workspaceMutedTextClass}>{formatTime(apt.requestedTime)}</span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${statusChipClass(apt.status)}`}>
                                {apt.status}
                              </span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${queueStatusChipClass(apt.queueStatus)}`}>
                                {apt.queueStatus}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              ) : null}

              {/* QUEUE MANAGEMENT VIEW */}
              {activeSection === 'queue' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Patient queue timeline</h2>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Dynamic timeline of today's slots with triage flags, status toggles, and quick checkup history.
                  </p>
                  {isLoadingDoctorData ? (
                    <p className={`mt-2 text-xs ${workspaceMutedTextClass}`}>Refreshing timeline...</p>
                  ) : null}

                  {queueItems.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        No pending patients in the queue.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
                        <thead>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Patient
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Department
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Time
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Triage
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Queue status
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--card-border)]">
                          {queueItems.map((item) => {
                            const displayName = dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName

                            return (
                              <tr key={item.id}>
                                <td className="px-3 py-3">
                                  <div className="group relative inline-block">
                                    <p className={`font-semibold ${workspaceHeadingTextClass}`}>{displayName}</p>
                                    <div className="pointer-events-none absolute left-0 top-7 z-10 hidden w-72 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3 shadow-lg group-hover:block">
                                      <p className={`text-[11px] uppercase tracking-[0.13em] ${workspaceSubtleTextClass}`}>
                                        Last 3 checkups
                                      </p>
                                      <div className="mt-2 space-y-1">
                                        {item.checkupHistory.length > 0 ? (
                                          item.checkupHistory.slice(0, 3).map((history) => (
                                            <p key={`${item.id}-${history.visitDate}`} className={`text-xs ${workspaceMutedTextClass}`}>
                                              {formatDateTime(history.visitDate)} - {history.primaryDiagnosis}
                                            </p>
                                          ))
                                        ) : (
                                          <p className={`text-xs ${workspaceMutedTextClass}`}>No prior visit record.</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{item.department}</td>
                                <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{formatTime(item.requestedTime)}</td>
                                <td className="px-3 py-3">
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(item.priority)}`}>
                                    {item.priority}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${queueStatusChipClass(item.queueStatus)}`}>
                                    {item.queueStatus}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(['Arrived', 'In-Consultation', 'Checked-Out'] as const).map((nextStatus) => (
                                      <button
                                        key={`${item.id}-${nextStatus}`}
                                        type="button"
                                        className={`${workspaceGhostButtonClass} text-xs ${statusSavingId === item.id ? 'opacity-60' : ''}`}
                                        disabled={statusSavingId === item.id}
                                        onClick={() => {
                                          void handleQueueStatusChange(item.id, nextStatus)
                                        }}
                                      >
                                        {nextStatus}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      className={`${workspacePrimaryButtonClass} text-xs`}
                                      onClick={() => {
                                        setSelectedAppointment(item)
                                        setShowAppointmentDetail(true)
                                      }}
                                    >
                                      Open
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {/* ANALYTICS VIEW */}
              {activeSection === 'analytics' ? (
                <section className="space-y-4">
                  <div className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Department breakdown</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Appointment distribution across departments.
                    </p>

                    <div className="mt-4 space-y-2">
                      {Array.from(
                        new Map(
                          appointmentItems.map((item) => [
                            item.department,
                            appointmentItems.filter((i) => i.department === item.department).length,
                          ])
                        ).entries()
                      ).map(([dept, count]) => (
                        <div key={dept} className="flex items-center justify-between">
                          <span className={`text-sm ${workspaceHeadingTextClass}`}>{dept}</span>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-[color:var(--agent-surface)]">
                              <div
                                className="h-full bg-blue-500"
                                style={{
                                  width: `${(count / appointmentItems.length) * 100}%`,
                                }}
                              />
                            </div>
                            <span className={`w-8 text-right text-sm font-semibold ${workspaceHeadingTextClass}`}>{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Status distribution</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Current appointment status breakdown.
                    </p>

                    <div className="mt-4 space-y-2">
                      {[
                        {
                          label: 'Booked',
                          count: appointmentItems.filter((i) => i.status === 'Booked').length,
                          color: 'bg-sky-500',
                        },
                        {
                          label: 'Recorded',
                          count: appointmentItems.filter((i) => i.status === 'Recorded').length,
                          color: 'bg-emerald-500',
                        },
                        {
                          label: 'Failed',
                          count: appointmentItems.filter((i) => i.status === 'Failed').length,
                          color: 'bg-rose-500',
                        },
                      ].map(({ label, count, color }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className={`text-sm ${workspaceHeadingTextClass}`}>{label}</span>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-[color:var(--agent-surface)]">
                              <div
                                className={color}
                                style={{
                                  width: `${appointmentItems.length > 0 ? (count / appointmentItems.length) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className={`w-8 text-right text-sm font-semibold ${workspaceHeadingTextClass}`}>{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {activeSection === 'settings' ? (
                <section className="space-y-4">
                  <section className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Profile details</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Update your display name for this workspace.
                    </p>

                    <form
                      className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void handleSaveProfileName()
                      }}
                    >
                      <div className="reference-card-soft p-4">
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Account</p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                          {authUser?.username ?? 'Unknown'}
                        </p>
                        <p className={`mt-3 text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Role</p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                          {getWorkspaceRoleLabel(authUser?.role)}
                        </p>
                      </div>

                      <div className="reference-card-soft p-4">
                        <label
                          htmlFor="doctor-profile-name"
                          className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}
                        >
                          Display name
                        </label>
                        <input
                          id="doctor-profile-name"
                          value={profileNameDraft}
                          onChange={(event) => {
                            setProfileNameDraft(event.target.value)
                            if (profileError) setProfileError(null)
                            if (profileMessage) setProfileMessage(null)
                          }}
                          placeholder="Enter your full name"
                          className={`mt-2 ${workspaceFieldClass}`}
                        />
                        {profileError ? (
                          <p className="mt-3 text-xs font-semibold text-rose-500">{profileError}</p>
                        ) : null}
                        {profileMessage ? (
                          <p className="mt-3 text-xs font-semibold text-emerald-600">{profileMessage}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="submit"
                            className={workspacePrimaryButtonClass}
                            disabled={isSavingProfile}
                          >
                            {isSavingProfile ? 'Saving...' : 'Save name'}
                          </button>
                          <button
                            type="button"
                            className={workspaceGhostButtonClass}
                            onClick={() => {
                              setProfileNameDraft(profileName)
                              setProfileError(null)
                              setProfileMessage(null)
                            }}
                            disabled={isSavingProfile}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </form>
                  </section>

                  <section className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Change password</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Use a strong password to keep your workspace secure.
                    </p>

                    <form
                      className="mt-4 grid gap-3 md:grid-cols-3"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void handleSavePassword()
                      }}
                    >
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(event) => {
                          setCurrentPassword(event.target.value)
                          if (passwordError) setPasswordError(null)
                          if (passwordMessage) setPasswordMessage(null)
                        }}
                        placeholder="Current password"
                        className={workspaceFieldClass}
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value)
                          if (passwordError) setPasswordError(null)
                          if (passwordMessage) setPasswordMessage(null)
                        }}
                        placeholder="New password"
                        className={workspaceFieldClass}
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value)
                          if (passwordError) setPasswordError(null)
                          if (passwordMessage) setPasswordMessage(null)
                        }}
                        placeholder="Confirm password"
                        className={workspaceFieldClass}
                      />
                    </form>

                    {passwordError ? (
                      <p className="mt-3 text-xs font-semibold text-rose-500">{passwordError}</p>
                    ) : null}
                    {passwordMessage ? (
                      <p className="mt-3 text-xs font-semibold text-emerald-600">{passwordMessage}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className={workspacePrimaryButtonClass}
                        onClick={() => {
                          void handleSavePassword()
                        }}
                        disabled={isSavingPassword}
                      >
                        {isSavingPassword ? 'Updating...' : 'Update password'}
                      </button>
                      <p className={`text-xs ${workspaceSubtleTextClass}`}>
                        Minimum 8 characters with uppercase, lowercase, number, and symbol.
                      </p>
                    </div>
                  </section>

                  <section className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>
                      Workspace preferences
                    </h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Configure your session view and privacy controls.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="reference-card-soft p-3">
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Theme</p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                          {theme === 'dark' ? 'Dark' : 'Light'}
                        </p>
                      </div>
                      <div className="reference-card-soft p-3">
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                          Data masking
                        </p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                          {dataMaskingEnabled ? 'On' : 'Off'}
                        </p>
                      </div>
                      <div className="reference-card-soft p-3">
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Session</p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>{sessionStatus}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className={workspaceGhostButtonClass} onClick={onToggleTheme}>
                        Switch to {theme === 'dark' ? 'Light' : 'Dark'} theme
                      </button>
                      <button type="button" className={workspaceGhostButtonClass} onClick={onToggleDataMasking}>
                        Turn data masking {dataMaskingEnabled ? 'Off' : 'On'}
                      </button>
                    </div>
                  </section>
                </section>
              ) : null}
            </section>
          }
        />
      </div>

      {/* APPOINTMENT DETAIL MODAL */}
      {selectedAppointment && showAppointmentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`${workspacePanelClass} max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Appointment detail</p>
                <h2 className={`mt-1 text-2xl font-semibold ${workspaceHeadingTextClass}`}>
                  {dataMaskingEnabled ? maskPersonName(selectedAppointment.patientName) : selectedAppointment.patientName}
                </h2>
              </div>
              <button
                type="button"
                className={workspaceGhostButtonClass}
                onClick={() => setShowAppointmentDetail(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Appointment status</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusChipClass(selectedAppointment.status)}`}>
                    {selectedAppointment.status}
                  </span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${queueStatusChipClass(selectedAppointment.queueStatus)}`}>
                    {selectedAppointment.queueStatus}
                  </span>
                </div>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Priority</p>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(selectedAppointment.priority)}`}>
                    {selectedAppointment.priority}
                  </span>
                </p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Requested time</p>
                <p className={`mt-1 font-semibold ${workspaceHeadingTextClass}`}>{formatDateTime(selectedAppointment.requestedTime)}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Flagged</p>
                <p className={`mt-1 font-semibold ${workspaceHeadingTextClass}`}>{selectedAppointment.flagged ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Symptoms & Chief complaint</p>
              <p className={`mt-2 ${workspaceMutedTextClass}`}>{selectedAppointment.symptoms}</p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                className={workspaceGhostButtonClass}
                onClick={() => {
                  void handleLoadPatientProfile()
                }}
                disabled={isPatientProfileLoading}
              >
                {isPatientProfileLoading ? 'Loading patient profile...' : 'View patient profile'}
              </button>
              {patientProfileError ? <p className="mt-2 text-xs font-semibold text-rose-500">{patientProfileError}</p> : null}
              {patientProfile ? (
                <section className="mt-3 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                  <h3 className={`text-sm font-semibold ${workspaceHeadingTextClass}`}>Patient profile</h3>
                  <p className={`mt-2 text-sm ${workspaceMutedTextClass}`}>
                    {`${patientProfile.patient.firstName} ${patientProfile.patient.lastName}`.trim()} · {patientProfile.patient.email}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-[color:var(--agent-muted)]">
                    <p>DOB: {patientProfile.patient.dateOfBirth ? formatDateTime(patientProfile.patient.dateOfBirth) : 'N/A'}</p>
                    <p>Phone: {patientProfile.patient.phoneNumber || 'N/A'}</p>
                    <p>Gender: {patientProfile.patient.gender || 'N/A'}</p>
                    <p>Blood type: {patientProfile.personalHealthInfo.bloodType || 'N/A'}</p>
                  </div>
                </section>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              <section className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                <h3 className={`text-sm font-semibold ${workspaceHeadingTextClass}`}>Digital SOAP notes</h3>
                <p className={`mt-1 text-xs ${workspaceMutedTextClass}`}>Subjective, Objective, Assessment, and Plan.</p>
                <div className="mt-3 space-y-2">
                  <textarea
                    className={workspaceFieldClass}
                    rows={2}
                    placeholder="Subjective"
                    value={soapNoteDraft.subjective}
                    onChange={(event) => setSoapNoteDraft((previous) => ({ ...previous, subjective: event.target.value }))}
                  />
                  <textarea
                    className={workspaceFieldClass}
                    rows={2}
                    placeholder="Objective"
                    value={soapNoteDraft.objective}
                    onChange={(event) => setSoapNoteDraft((previous) => ({ ...previous, objective: event.target.value }))}
                  />
                  <textarea
                    className={workspaceFieldClass}
                    rows={2}
                    placeholder="Assessment"
                    value={soapNoteDraft.assessment}
                    onChange={(event) => setSoapNoteDraft((previous) => ({ ...previous, assessment: event.target.value }))}
                  />
                  <textarea
                    className={workspaceFieldClass}
                    rows={2}
                    placeholder="Plan"
                    value={soapNoteDraft.plan}
                    onChange={(event) => setSoapNoteDraft((previous) => ({ ...previous, plan: event.target.value }))}
                  />
                </div>
                {soapSaveError ? <p className="mt-2 text-xs font-semibold text-rose-500">{soapSaveError}</p> : null}
                {soapSaveMessage ? <p className="mt-2 text-xs font-semibold text-emerald-600">{soapSaveMessage}</p> : null}
                <button
                  type="button"
                  className={`${workspacePrimaryButtonClass} mt-3`}
                  onClick={() => {
                    void handleSaveSoapNote()
                  }}
                >
                  Save SOAP note
                </button>
              </section>

              <section className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                <h3 className={`text-sm font-semibold ${workspaceHeadingTextClass}`}>E-Prescription module</h3>
                <p className={`mt-1 text-xs ${workspaceMutedTextClass}`}>Medication search, dosage entry, and frequent shortcuts.</p>
                <div className="mt-3 space-y-2">
                  <input
                    className={workspaceFieldClass}
                    placeholder="Search medication"
                    value={medicationQuery}
                    onChange={(event) => {
                      setMedicationQuery(event.target.value)
                      setPrescriptionDraft((previous) => ({ ...previous, medication: event.target.value }))
                    }}
                  />
                  {medicationMatches.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {medicationMatches.slice(0, 6).map((med) => (
                        <button
                          key={med.name}
                          type="button"
                          className={workspaceGhostButtonClass}
                          onClick={() => {
                            setMedicationQuery(med.name)
                            setPrescriptionDraft((previous) => ({ ...previous, medication: med.name }))
                            setMedicationMatches([])
                          }}
                        >
                          {med.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {frequentPrescriptions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {frequentPrescriptions.slice(0, 4).map((item) => (
                        <button
                          key={item.medication}
                          type="button"
                          className={workspaceGhostButtonClass}
                          onClick={() => {
                            setMedicationQuery(item.medication)
                            setPrescriptionDraft((previous) => ({ ...previous, medication: item.medication }))
                          }}
                        >
                          {item.medication}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <input
                    className={workspaceFieldClass}
                    placeholder="Dosage (e.g. 500mg)"
                    value={prescriptionDraft.dosage ?? ''}
                    onChange={(event) => setPrescriptionDraft((previous) => ({ ...previous, dosage: event.target.value }))}
                  />
                  <input
                    className={workspaceFieldClass}
                    placeholder="Frequency (e.g. twice daily)"
                    value={prescriptionDraft.frequency ?? ''}
                    onChange={(event) => setPrescriptionDraft((previous) => ({ ...previous, frequency: event.target.value }))}
                  />
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className={workspaceFieldClass}
                    placeholder="Duration (days)"
                    value={prescriptionDraft.durationDays ?? 7}
                    onChange={(event) => setPrescriptionDraft((previous) => ({ ...previous, durationDays: Number(event.target.value) || 1 }))}
                  />
                  <input
                    className={workspaceFieldClass}
                    placeholder="Instructions"
                    value={prescriptionDraft.instructions ?? ''}
                    onChange={(event) => setPrescriptionDraft((previous) => ({ ...previous, instructions: event.target.value }))}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={workspaceGhostButtonClass} onClick={handleAddPrescription}>
                    Add prescription
                  </button>
                  <button
                    type="button"
                    className={workspacePrimaryButtonClass}
                    onClick={() => {
                      void handleSavePrescriptions()
                    }}
                  >
                    Save e-prescription
                  </button>
                </div>
                {pendingPrescriptions.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {pendingPrescriptions.map((item, index) => (
                      <p key={`${item.medication}-${index}`} className={`text-xs ${workspaceMutedTextClass}`}>
                        {item.medication} - {item.dosage} {item.frequency ? `- ${item.frequency}` : ''}
                      </p>
                    ))}
                  </div>
                ) : null}
                {prescriptionError ? <p className="mt-2 text-xs font-semibold text-rose-500">{prescriptionError}</p> : null}
                {prescriptionMessage ? <p className="mt-2 text-xs font-semibold text-emerald-600">{prescriptionMessage}</p> : null}
              </section>
            </div>

            <div className="mt-6 flex gap-3">
              <button type="button" className={workspaceGhostButtonClass} onClick={() => setShowAppointmentDetail(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceCanvas>
  )
}

export default DoctorDashboardPage
