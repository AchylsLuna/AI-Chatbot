import { useEffect, useMemo, useState, type ReactNode } from 'react'
import PageCanvas from '../../components/layout/PageCanvas'
import PageTopShell from '../../components/layout/PageTopShell'
import SectionCard from '../../components/layout/SectionCard'
import Sidebar, { type SidebarItem } from '../../components/layout/Sidebar'
import SidebarShell from '../../components/layout/SidebarShell'
import {
  getAppointmentsTabPath,
  resolveAppointmentsTabFromPath,
} from '../../config/roleTabRoutes'
import useTabRouteState from '../../hooks/useTabRouteState'
import type { AppPage } from '../../types/navigation'
import ConfirmModal from '../../components/ui/ConfirmModal'
import type { AuthSession, Reservation, ReservationDraft } from '../../types'
import {
  pageFieldClass,
  pageGhostButtonClass,
  pagePanelClass,
  pagePrimaryButtonClass,
} from '../../styles/pageUi'
import { maskPersonName } from '../../utils/privacy'
import { getRoleLabel } from '../../utils/roles'
import {
  api,
  type DoctorAvailability,
  type DoctorAvailableSlot,
  type DoctorScheduleDay,
  type UserSettings,
} from '../../services/api'

type PatientAppointmentsPageProps = {
  reservations: Reservation[]
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
  onLogout?: () => void
  onCreateReservation?: (draft: ReservationDraft) => Promise<void>
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
}

const USER_SIDEBAR_SECTIONS = [
  'booking_appointments',
  'profile',
  'history',
  'notifications',
  'settings',
] as const

type UserSidebarSection = (typeof USER_SIDEBAR_SECTIONS)[number]

type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

type PatientProfileForm = {
  firstName: string
  lastName: string
  dateOfBirth: string
  phoneNumber: string
  address: string
  gender: string
}

type PersonalHealthInfoForm = {
  bloodType: string
  allergies: string[]
  medications: string[]
  chronicConditions: string[]
  surgeries: string[]
  notes: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: string
}

type HealthListField = 'allergies' | 'medications' | 'chronicConditions' | 'surgeries'
type HistoryFilter = 'all' | 'upcoming' | 'completed' | 'cancelled'

const sidebarItems: SidebarItem[] = [
  { key: 'booking_appointments', label: 'Book Appointment', icon: 'calendar' },
  { key: 'history', label: 'History', icon: 'report' },
]

const patientUtilityItems: SidebarItem[] = [
  { key: 'notifications', label: 'Notifications', icon: 'alert' },
  { key: 'settings', label: 'Account Settings', icon: 'settings' },
]

const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  browserAlerts: true,
  appointmentReminders: true,
  securityAlerts: true,
}

const mapUserSettingsToNotificationPrefs = (settings: UserSettings): NotificationPreferences => ({
  emailAlerts: settings.notifications.email,
  browserAlerts: settings.notifications.push,
  appointmentReminders: settings.notifications.appointmentReminders,
  securityAlerts: settings.notifications.securityAlerts,
})

const mapNotificationPrefsToSettings = (
  prefs: NotificationPreferences
): UserSettings['notifications'] => ({
  email: prefs.emailAlerts,
  sms: false,
  push: prefs.browserAlerts,
  appointmentReminders: prefs.appointmentReminders,
  securityAlerts: prefs.securityAlerts,
})

const notificationDeliveryItems: Array<{
  key: keyof NotificationPreferences
  label: string
  description: string
}> = [
  {
    key: 'emailAlerts',
    label: 'Email alerts',
    description: 'Receive booking updates and reminders in your inbox.',
  },
  {
    key: 'browserAlerts',
    label: 'Browser alerts',
    description: 'Show in-browser notifications while this device is active.',
  },
]

const notificationBookingItems: Array<{
  key: keyof NotificationPreferences
  label: string
  description: string
}> = [
  {
    key: 'appointmentReminders',
    label: 'Appointment reminders',
    description: 'Send reminders before scheduled care visits.',
  },
  {
    key: 'securityAlerts',
    label: 'Security alerts',
    description: 'Warn you about sign-ins, password changes, and session activity.',
  },
]

const patientPageCardClass = pagePanelClass
const patientFieldClass = pageFieldClass
const patientMutedFieldClass =
  `${pageFieldClass} bg-[color:var(--agent-surface-strong)] text-[color:var(--agent-muted)]`
const patientPrimaryButtonClass = pagePrimaryButtonClass
const patientSecondaryButtonClass = pageGhostButtonClass
const patientCompactActionButtonClass =
  'inline-flex items-center justify-center rounded-[0.95rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-3.5 py-2 text-xs font-semibold text-[color:var(--agent-ink)] transition hover:bg-[color:var(--agent-overlay)]'
const patientCompactPrimaryActionButtonClass =
  'inline-flex items-center justify-center rounded-[0.95rem] bg-[color:var(--agent-accent)] px-3.5 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:bg-[color:var(--agent-accent-strong)]'
const patientHistoryFilterClass =
  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize'
const departmentIconMap: Record<string, string> = {
  'Internal Medicine': '🩺',
  Cardiology: '❤️',
  Pediatrics: '👶',
  Surgery: '🩹',
  'Obstetrics and Gynecology': '🌸',
  'Family and Community Medicine': '🏡',
  Anesthesiology: '💉',
  Radiology: '🩻',
  Pathology: '🧪',
  Psychiatry: '💬',
  Ophthalmology: '👁️',
  Otorhinolaryngology: '👂',
  'Rehabilitation Medicine': '🦾',
  Dermatology: '🌿',
  'Emergency Medicine': '🚑',
  Pulmonology: '🫁',
  Nephrology: '🧬',
  Neurology: '🧠',
  Gastroenterology: '🫃',
}

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return true
}

const departmentOptions = [
  'Internal Medicine',
  'Cardiology',
  'Pediatrics',
  'Surgery',
  'Obstetrics and Gynecology',
  'Family and Community Medicine',
  'Anesthesiology',
  'Radiology',
  'Pathology',
  'Psychiatry',
  'Ophthalmology',
  'Otorhinolaryngology',
  'Rehabilitation Medicine',
  'Dermatology',
  'Emergency Medicine',
  'Pulmonology',
  'Nephrology',
  'Neurology',
  'Gastroenterology',
] as const

const formatDateInput = (value: Date) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const buildDefaultBookingDate = () => {
  const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return formatDateInput(nextDay)
}

const formatPatientDate = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(parsed)
}

const formatPatientTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(parsed)
}

const emptyDaySessions: DoctorScheduleDay = { morning: false, afternoon: false }

const resolvePatientDisplayName = (user: AuthSession['user'] | null) => {
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  if (fullName) return fullName
  return 'Patient'
}

const resolvePatientInitials = (name: string) => {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return 'PT'
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
}

type PatientTopMetric = {
  key: string
  label: string
  value: number | string
  caption?: string
}

const getReservationStatusMeta = (status: Reservation['status']) => {
  if (status === 'Recorded') {
    return {
      filter: 'completed' as const,
      label: 'Completed',
      color: 'bg-green-50 text-green-700 border-green-200',
      dot: 'bg-green-500',
    }
  }

  if (status === 'Failed') {
    return {
      filter: 'cancelled' as const,
      label: 'Cancelled',
      color: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-500',
    }
  }

  return {
    filter: 'upcoming' as const,
    label: 'Upcoming',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  }
}

const hasRequiredProfile = (profile: PatientProfileForm) =>
  Boolean(
    profile.firstName.trim() &&
      profile.lastName.trim() &&
      profile.dateOfBirth.trim() &&
      profile.phoneNumber.trim() &&
      profile.address.trim() &&
      profile.gender.trim()
  )

const hasRequiredHealthInfo = (health: PersonalHealthInfoForm) =>
  Boolean(
    health.bloodType.trim() &&
      health.emergencyContactName.trim() &&
      health.emergencyContactPhone.trim() &&
      health.emergencyContactRelationship.trim()
  )

const requiredFieldClass = (isMissing: boolean, shouldValidate: boolean) =>
  `${patientFieldClass} ${shouldValidate && isMissing ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-100' : ''}`

const isUserSidebarSection = (key: string): key is UserSidebarSection =>
  USER_SIDEBAR_SECTIONS.includes(key as UserSidebarSection)

const resolveDepartmentIcon = (department: string) => departmentIconMap[department] ?? '🩺'

const PatientAppointmentsPage = ({
  reservations,
  authUser,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onCreateReservation,
  onLogout,
}: PatientAppointmentsPageProps) => {
  const { activeTab: activeSection, setTab } = useTabRouteState<UserSidebarSection>({
    page: 'appointments',
    fallbackTab: 'booking_appointments',
    resolveTabFromPath: resolveAppointmentsTabFromPath,
    getTabPath: getAppointmentsTabPath,
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1)
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPreferences>(defaultNotificationPrefs)
  const [isLoadingNotificationPrefs, setIsLoadingNotificationPrefs] = useState(false)
  const [notificationPrefsError, setNotificationPrefsError] = useState<string | null>(null)
  const [notificationPrefsMessage, setNotificationPrefsMessage] = useState<string | null>(null)

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [bookingDepartment, setBookingDepartment] = useState<(typeof departmentOptions)[number]>(
    'Internal Medicine'
  )
  const [availableDoctors, setAvailableDoctors] = useState<DoctorAvailability[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false)
  const [doctorLoadError, setDoctorLoadError] = useState<string | null>(null)
  const [bookingPriority, setBookingPriority] = useState<Reservation['priority']>('Routine')
  const [bookingDate, setBookingDate] = useState(buildDefaultBookingDate)
  const [availableSlots, setAvailableSlots] = useState<DoctorAvailableSlot[]>([])
  const [selectedSlotStartIso, setSelectedSlotStartIso] = useState('')
  const [selectedDaySessions, setSelectedDaySessions] = useState<DoctorScheduleDay>(emptyDaySessions)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [slotLoadError, setSlotLoadError] = useState<string | null>(null)
  const [slotStatusMessage, setSlotStatusMessage] = useState<string | null>(null)
  const [slotReloadNonce, setSlotReloadNonce] = useState(0)
  const [bookingSymptoms, setBookingSymptoms] = useState('')
  const [bookingNote, setBookingNote] = useState('')
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingMessage, setBookingMessage] = useState<string | null>(null)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState<PatientProfileForm>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phoneNumber: '',
    address: '',
    gender: '',
  })
  const [healthForm, setHealthForm] = useState<PersonalHealthInfoForm>({
    bloodType: '',
    allergies: [''],
    medications: [''],
    chronicConditions: [''],
    surgeries: [''],
    notes: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
  })
  const [isProfileLoading, setIsProfileLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaveAttempted, setProfileSaveAttempted] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)

  const setSection = (next: UserSidebarSection) => {
    setTab(next)
  }

  useEffect(() => {
    let isMounted = true

    const loadProfileData = async () => {
      setIsProfileLoading(true)
      setProfileError(null)
      try {
        const payload = await api.getMyProfile()
        if (!isMounted) return

        setProfileForm({
          firstName: payload.profile.firstName ?? '',
          lastName: payload.profile.lastName ?? '',
          dateOfBirth: (() => {
            if (!payload.profile.dateOfBirth) return ''
            const parsed = new Date(payload.profile.dateOfBirth)
            return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
          })(),
          phoneNumber: payload.profile.phoneNumber ?? '',
          address: payload.profile.address ?? '',
          gender: payload.profile.gender ?? '',
        })
        setHealthForm({
          bloodType: payload.personalHealthInfo.bloodType ?? '',
          allergies:
            payload.personalHealthInfo.allergies && payload.personalHealthInfo.allergies.length > 0
              ? payload.personalHealthInfo.allergies
              : [''],
          medications:
            payload.personalHealthInfo.medications && payload.personalHealthInfo.medications.length > 0
              ? payload.personalHealthInfo.medications
              : [''],
          chronicConditions:
            payload.personalHealthInfo.chronicConditions &&
            payload.personalHealthInfo.chronicConditions.length > 0
              ? payload.personalHealthInfo.chronicConditions
              : [''],
          surgeries:
            payload.personalHealthInfo.surgeries && payload.personalHealthInfo.surgeries.length > 0
              ? payload.personalHealthInfo.surgeries
              : [''],
          notes: payload.personalHealthInfo.notes ?? '',
          emergencyContactName: payload.personalHealthInfo.emergencyContact?.name ?? '',
          emergencyContactPhone: payload.personalHealthInfo.emergencyContact?.phone ?? '',
          emergencyContactRelationship:
            payload.personalHealthInfo.emergencyContact?.relationship ?? '',
        })
      } catch (error) {
        if (!isMounted) return
        setProfileError(error instanceof Error ? error.message : 'Failed to load profile data.')
      } finally {
        if (isMounted) {
          setIsProfileLoading(false)
        }
      }
    }

    void loadProfileData()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadNotificationSettings = async () => {
      setIsLoadingNotificationPrefs(true)
      setNotificationPrefsError(null)
      try {
        const settings = await api.getUserSettings()
        if (!isMounted) return
        setNotificationPrefs(mapUserSettingsToNotificationPrefs(settings))
      } catch (error) {
        if (!isMounted) return
        setNotificationPrefsError(
          error instanceof Error ? error.message : 'Failed to load notification settings.'
        )
      } finally {
        if (isMounted) {
          setIsLoadingNotificationPrefs(false)
        }
      }
    }

    void loadNotificationSettings()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadDoctors = async () => {
      setIsLoadingDoctors(true)
      setDoctorLoadError(null)
      setSelectedDoctorId('')
      try {
        const doctors = await api.getAvailableDoctorsByDepartment(bookingDepartment)
        if (!isMounted) return
        setAvailableDoctors(doctors)
      } catch (error) {
        if (!isMounted) return
        setAvailableDoctors([])
        setDoctorLoadError(error instanceof Error ? error.message : 'Failed to load doctors.')
      } finally {
        if (isMounted) setIsLoadingDoctors(false)
      }
    }
    void loadDoctors()
    return () => {
      isMounted = false
    }
  }, [bookingDepartment])

  useEffect(() => {
    let isMounted = true

    const resetSlotState = () => {
      setAvailableSlots([])
      setSelectedSlotStartIso('')
      setSelectedDaySessions(emptyDaySessions)
      setSlotStatusMessage(null)
      setSlotLoadError(null)
    }

    const loadSlots = async () => {
      if (!selectedDoctorId || !bookingDate) {
        resetSlotState()
        return
      }

      setIsLoadingSlots(true)
      setSlotLoadError(null)
      setSlotStatusMessage(null)
      try {
        const availability = await api.getDoctorAvailableSlots(selectedDoctorId, bookingDate)
        if (!isMounted) return

        const openSlots = availability.slots.filter((slot) => slot.isAvailable)
        setAvailableSlots(openSlots)
        setSelectedDaySessions(availability.daySessions)
        setSelectedSlotStartIso((previous) =>
          openSlots.some((slot) => slot.startIso === previous) ? previous : (openSlots[0]?.startIso || '')
        )

        if (!availability.hasWeekSchedule) {
          setSlotStatusMessage('Doctor has no published schedule for this week.')
        } else if (!availability.daySessions.morning && !availability.daySessions.afternoon) {
          setSlotStatusMessage('Doctor is not scheduled for this day.')
        } else if (openSlots.length === 0) {
          setSlotStatusMessage('No available slots left for this date.')
        } else {
          setSlotStatusMessage(`${openSlots.length} available slot${openSlots.length === 1 ? '' : 's'} found.`)
        }
      } catch (error) {
        if (!isMounted) return
        setAvailableSlots([])
        setSelectedSlotStartIso('')
        setSelectedDaySessions(emptyDaySessions)
        setSlotLoadError(error instanceof Error ? error.message : 'Failed to load schedule slots.')
      } finally {
        if (isMounted) setIsLoadingSlots(false)
      }
    }

    void loadSlots()
    return () => {
      isMounted = false
    }
  }, [bookingDate, selectedDoctorId, slotReloadNonce])

  const isProfileComplete = useMemo(() => {
    return hasRequiredProfile(profileForm) && hasRequiredHealthInfo(healthForm)
  }, [healthForm, profileForm])

  const updateListItem = (field: HealthListField, index: number, value: string) => {
    setHealthForm((prev) => {
      const next = [...prev[field]]
      next[index] = value
      return { ...prev, [field]: next }
    })
  }

  const addListItem = (field: HealthListField) => {
    setHealthForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }))
  }

  const removeListItem = (field: HealthListField, index: number) => {
    setHealthForm((prev) => {
      if (prev[field].length <= 1) return prev
      return { ...prev, [field]: prev[field].filter((_, itemIndex) => itemIndex !== index) }
    })
  }

  const renderHealthListEditor = (
    field: HealthListField,
    label: string,
    itemLabel: string,
    addLabel: string
  ) => (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <div className="space-y-2">
        {healthForm[field].map((item, index) => (
          <div key={`${field}-${index}`} className="flex gap-2">
            <input
              value={item}
              onChange={(event) => updateListItem(field, index, event.target.value)}
              placeholder={`${itemLabel} ${index + 1}`}
              className={patientFieldClass}
            />
            <button
              type="button"
              className={patientSecondaryButtonClass}
              onClick={() => removeListItem(field, index)}
              disabled={healthForm[field].length <= 1}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`mt-2 ${patientSecondaryButtonClass}`}
        onClick={() => addListItem(field)}
      >
        {addLabel}
      </button>
    </div>
  )

  const sortedReservations = useMemo(
    () =>
      [...reservations].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [reservations]
  )

  const visibleReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return sortedReservations.filter((appointment) => {
      const matchesQuery =
        !query ||
        appointment.id.toLowerCase().includes(query) ||
        appointment.patientName.toLowerCase().includes(query) ||
        appointment.department.toLowerCase().includes(query) ||
        appointment.summary.toLowerCase().includes(query)
      const matchesFilter =
        historyFilter === 'all' || getReservationStatusMeta(appointment.status).filter === historyFilter
      return matchesQuery && matchesFilter
    })
  }, [historyFilter, searchQuery, sortedReservations])

  const activeNotificationPreferenceCount = useMemo(
    () => Object.values(notificationPrefs).filter(Boolean).length,
    [notificationPrefs]
  )

  const selectedDoctor = useMemo(
    () => availableDoctors.find((doctor) => doctor.id === selectedDoctorId) ?? null,
    [availableDoctors, selectedDoctorId]
  )

  const selectedSlot = useMemo(
    () => availableSlots.find((slot) => slot.startIso === selectedSlotStartIso) ?? null,
    [availableSlots, selectedSlotStartIso]
  )

  const historyStats = useMemo(
    () => ({
      total: sortedReservations.length,
      upcoming: sortedReservations.filter((item) => item.status === 'Booked').length,
      completed: sortedReservations.filter((item) => item.status === 'Recorded').length,
      cancelled: sortedReservations.filter((item) => item.status === 'Failed').length,
    }),
    [sortedReservations]
  )

  const emergencyContactReady = useMemo(
    () =>
      Boolean(
        healthForm.emergencyContactName.trim() &&
          healthForm.emergencyContactPhone.trim() &&
          healthForm.emergencyContactRelationship.trim()
      ),
    [
      healthForm.emergencyContactName,
      healthForm.emergencyContactPhone,
      healthForm.emergencyContactRelationship,
    ]
  )

  const profileChecklist = useMemo(
    () => [
      {
        key: 'basic',
        label: 'Basic details',
        description: 'Name, birth date, phone, gender, and address',
        complete: hasRequiredProfile(profileForm),
      },
      {
        key: 'blood',
        label: 'Blood type',
        description: 'Required for intake records',
        complete: Boolean(healthForm.bloodType.trim()),
      },
      {
        key: 'contact',
        label: 'Emergency contact',
        description: 'A reachable contact for urgent updates',
        complete: emergencyContactReady,
      },
      {
        key: 'booking',
        label: 'Booking access',
        description: 'Profile is ready for appointment requests',
        complete: isProfileComplete,
      },
    ],
    [emergencyContactReady, healthForm.bloodType, isProfileComplete, profileForm]
  )

  const completedProfileChecklistCount = useMemo(
    () => profileChecklist.filter((item) => item.complete).length,
    [profileChecklist]
  )

  const toggleNotificationPreference = async (key: keyof NotificationPreferences) => {
    const nextPrefs = {
      ...notificationPrefs,
      [key]: !notificationPrefs[key],
    }

    setNotificationPrefs(nextPrefs)
    setNotificationPrefsError(null)
    setNotificationPrefsMessage(null)

    try {
      await api.updateUserSettings({
        notifications: mapNotificationPrefsToSettings(nextPrefs),
      })
      setNotificationPrefsMessage('Notification preferences updated.')
    } catch (error) {
      setNotificationPrefs(notificationPrefs)
      setNotificationPrefsError(
        error instanceof Error ? error.message : 'Failed to update notification preferences.'
      )
    }
  }

  const renderNotificationPreferenceGroup = (
    title: string,
    items: Array<{
      key: keyof NotificationPreferences
      label: string
      description: string
    }>
  ) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const active = notificationPrefs[item.key]
          return (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="pr-4">
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void toggleNotificationPreference(item.key)
                }}
                className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-blue-500' : 'bg-slate-200'}`}
                aria-pressed={active}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${active ? 'left-6' : 'left-1'}`}
                />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  const submitBooking = async () => {
    setBookingError(null)
    setBookingMessage(null)

    if (!isProfileComplete) {
      setBookingError(
        'Complete your Profile and Personal Health Information first before booking an appointment.'
      )
      setSection('profile')
      return
    }

    const trimmedSymptoms = bookingSymptoms.trim()
    const trimmedNote = bookingNote.trim()
    if (trimmedSymptoms.length < 5) {
      setBookingError('Add more details in symptoms so the care team can triage your booking.')
      return
    }

    if (!bookingDate) {
      setBookingError('Select a preferred date.')
      return
    }

    if (!selectedSlotStartIso) {
      setBookingError('Select an available schedule slot before booking.')
      return
    }

    const parsedTime = new Date(selectedSlotStartIso)
    if (Number.isNaN(parsedTime.getTime())) {
      setBookingError('Selected slot is invalid. Please choose another slot.')
      return
    }

    if (parsedTime.getTime() <= Date.now()) {
      setBookingError('Selected slot must be in the future.')
      return
    }

    if (!onCreateReservation) {
      setBookingError('Booking service is not available in this session.')
      return
    }
    if (!selectedDoctorId) {
      setBookingError('Select a doctor before submitting your booking.')
      return
    }

    const draft: ReservationDraft = {
      patientName: resolvePatientDisplayName(authUser),
      symptoms: trimmedSymptoms,
      requestedTime: parsedTime.toISOString(),
      doctorId: selectedDoctorId,
      summary: {
        department: bookingDepartment,
        priority: bookingPriority,
        confidence: 0.8,
        summary: trimmedNote || trimmedSymptoms,
        symptoms: trimmedSymptoms,
        disclaimer: 'Submitted via patient booking.',
        source: 'rules',
      },
    }

    setIsSubmittingBooking(true)
    try {
      await onCreateReservation(draft)
      setBookingMessage('Booking appointment submitted successfully.')
      setBookingSymptoms('')
      setBookingNote('')
      setSelectedSlotStartIso('')
      setBookingStep(1)
      setSlotReloadNonce((previous) => previous + 1)
      setSection('history')
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to submit booking right now.')
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  const handleSavePatientProfile = async () => {
    setProfileSaveAttempted(true)
    setProfileError(null)
    setProfileMessage(null)

    if (!hasRequiredProfile(profileForm)) {
      setProfileError('Please complete all required Profile fields.')
      return
    }

    if (!hasRequiredHealthInfo(healthForm)) {
      setProfileError('Please complete required health fields (blood type and emergency contact).')
      return
    }

    setIsSavingProfile(true)
    try {
      await api.saveMyProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        dateOfBirth: profileForm.dateOfBirth.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        address: profileForm.address.trim(),
        gender: profileForm.gender.trim(),
      })

      await api.savePersonalHealthInfo({
        bloodType: healthForm.bloodType.trim(),
        allergies: healthForm.allergies.map((item) => item.trim()).filter(Boolean),
        medications: healthForm.medications.map((item) => item.trim()).filter(Boolean),
        chronicConditions: healthForm.chronicConditions.map((item) => item.trim()).filter(Boolean),
        surgeries: healthForm.surgeries.map((item) => item.trim()).filter(Boolean),
        notes: healthForm.notes.trim(),
        emergencyContact: {
          name: healthForm.emergencyContactName.trim(),
          phone: healthForm.emergencyContactPhone.trim(),
          relationship: healthForm.emergencyContactRelationship.trim(),
        },
      })

      setProfileMessage('Profile saved. You can now book an appointment.')
      setProfileSaveAttempted(false)
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to save profile.')
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
      setPasswordError('Fill in current, new, and confirm password.')
      return
    }

    if (!meetsPasswordPolicy(nextValue)) {
      setPasswordError(
        'New password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
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
      const result = await api.changePassword(oldValue, nextValue)
      if (result.requiresReauth) {
        setPasswordMessage('Password changed. Redirecting you to sign in again...')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        window.setTimeout(() => {
          onLogout?.()
        }, 900)
        return
      }

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

  const profileName = resolvePatientDisplayName(authUser)
  const profileInitials = resolvePatientInitials(profileName)

  const renderPatientTopShell = ({
    title,
    description,
    eyebrow,
    metrics,
    showSearch = false,
    searchPlaceholder,
    quickActions,
  }: {
    title: string
    description: string
    eyebrow: string
    metrics: readonly PatientTopMetric[]
    showSearch?: boolean
    searchPlaceholder?: string
    quickActions?: ReactNode
  }) => (
    <PageTopShell
      eyebrow={eyebrow}
      statusLabel={sessionStatus}
      title={title}
      description={description}
      searchValue={showSearch ? searchQuery : ''}
      searchPlaceholder={searchPlaceholder}
      onSearchChange={setSearchQuery}
      showSearch={showSearch}
      profileName={profileName}
      profileCaption={`${getRoleLabel(authUser?.role)} · ${authUser?.username ?? 'No email on file'}`}
      showNotifications={false}
      onSignOut={() => setShowLogoutConfirm(true)}
      quickActions={quickActions}
      metrics={metrics}
    />
  )

  const renderProfileSection = () => {
    const fullName = `${profileForm.firstName} ${profileForm.lastName}`.trim() || profileName

    return (
      <div className="p-6 md:p-8 xl:p-10">
        <div className="mx-auto max-w-[84rem] space-y-6">
          {renderPatientTopShell({
            eyebrow: 'Profile',
            title: fullName || 'Patient profile',
            description: 'Keep your contact details, health information, and emergency contact ready before booking care.',
            metrics: [
              {
                key: 'profile-complete',
                label: 'Completion',
                value: `${completedProfileChecklistCount}/${profileChecklist.length}`,
                caption: 'Required sections ready',
              },
              {
                key: 'profile-booking',
                label: 'Booking',
                value: isProfileComplete ? 'Ready' : 'Locked',
                caption: 'Appointment access',
              },
              {
                key: 'profile-alerts',
                label: 'Alerts',
                value: activeNotificationPreferenceCount,
                caption: 'Active preferences',
              },
              {
                key: 'profile-session',
                label: 'Session',
                value: sessionStatus,
                caption: 'Current sync state',
              },
            ],
            quickActions: (
              <>
                <button
                  type="button"
                  className={patientCompactActionButtonClass}
                  onClick={() => setSection('notifications')}
                >
                  Notifications
                </button>
                <button
                  type="button"
                  className={patientCompactActionButtonClass}
                  onClick={() => setSection('settings')}
                >
                  Account Settings
                </button>
                <button
                  type="button"
                  className={patientCompactPrimaryActionButtonClass}
                  onClick={() => setSection('booking_appointments')}
                >
                  Book Appointment
                </button>
              </>
            ),
          })}

          {!isProfileComplete ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-700">
              Complete the required fields below before booking an appointment.
            </div>
          ) : null}

          {isProfileLoading ? (
            <div className={`${patientPageCardClass} p-6 text-sm text-slate-500`}>
              Loading profile data...
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_20rem]">
              <div className="space-y-6">
                <div className={`${patientPageCardClass} p-6`}>
                  <div className="mb-5">
                    <h2 className="text-xl font-semibold text-slate-900">Personal Information</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Update your primary details used for appointment intake.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Full Name</label>
                      <input value={fullName} disabled className={patientMutedFieldClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Email Address</label>
                      <input value={authUser?.username ?? ''} disabled className={patientMutedFieldClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Phone Number</label>
                      <input
                        value={profileForm.phoneNumber}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, phoneNumber: event.target.value }))
                        }
                        placeholder="+63 900 000 0000"
                        className={requiredFieldClass(!profileForm.phoneNumber.trim(), profileSaveAttempted)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Date of Birth</label>
                      <input
                        type="date"
                        value={profileForm.dateOfBirth}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                        }
                        className={requiredFieldClass(!profileForm.dateOfBirth.trim(), profileSaveAttempted)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Gender</label>
                      <input
                        value={profileForm.gender}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, gender: event.target.value }))
                        }
                        placeholder="Gender"
                        className={requiredFieldClass(!profileForm.gender.trim(), profileSaveAttempted)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Address</label>
                      <input
                        value={profileForm.address}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, address: event.target.value }))
                        }
                        placeholder="Street, city, province"
                        className={requiredFieldClass(!profileForm.address.trim(), profileSaveAttempted)}
                      />
                    </div>
                  </div>
                </div>

                <div className={`${patientPageCardClass} p-6`}>
                  <div className="mb-5">
                    <h2 className="text-xl font-semibold text-slate-900">Health Information</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Keep your intake details updated before scheduling care.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="max-w-xs">
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Blood Type</label>
                      <input
                        value={healthForm.bloodType}
                        onChange={(event) =>
                          setHealthForm((prev) => ({ ...prev, bloodType: event.target.value }))
                        }
                        placeholder="Blood type"
                        className={requiredFieldClass(!healthForm.bloodType.trim(), profileSaveAttempted)}
                      />
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      {renderHealthListEditor('allergies', 'Allergies', 'Allergy', 'Add allergy')}
                      {renderHealthListEditor('medications', 'Medications', 'Medication', 'Add medication')}
                      {renderHealthListEditor(
                        'chronicConditions',
                        'Chronic Conditions',
                        'Condition',
                        'Add condition'
                      )}
                      {renderHealthListEditor('surgeries', 'Surgeries', 'Surgery', 'Add surgery')}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Notes</label>
                      <textarea
                        value={healthForm.notes}
                        onChange={(event) =>
                          setHealthForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                        rows={4}
                        className={patientFieldClass}
                      />
                    </div>
                  </div>
                </div>

                <div className={`${patientPageCardClass} p-6`}>
                  <div className="mb-5">
                    <h2 className="text-xl font-semibold text-slate-900">Emergency Contact</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Required so the care team can contact the right person if needed.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Contact Name</label>
                      <input
                        value={healthForm.emergencyContactName}
                        onChange={(event) =>
                          setHealthForm((prev) => ({
                            ...prev,
                            emergencyContactName: event.target.value,
                          }))
                        }
                        placeholder="Contact name"
                        className={requiredFieldClass(
                          !healthForm.emergencyContactName.trim(),
                          profileSaveAttempted
                        )}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Phone Number</label>
                      <input
                        value={healthForm.emergencyContactPhone}
                        onChange={(event) =>
                          setHealthForm((prev) => ({
                            ...prev,
                            emergencyContactPhone: event.target.value,
                          }))
                        }
                        placeholder="+63 900 000 0000"
                        className={requiredFieldClass(
                          !healthForm.emergencyContactPhone.trim(),
                          profileSaveAttempted
                        )}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">Relationship</label>
                      <input
                        value={healthForm.emergencyContactRelationship}
                        onChange={(event) =>
                          setHealthForm((prev) => ({
                            ...prev,
                            emergencyContactRelationship: event.target.value,
                          }))
                        }
                        placeholder="Relationship"
                        className={requiredFieldClass(
                          !healthForm.emergencyContactRelationship.trim(),
                          profileSaveAttempted
                        )}
                      />
                    </div>
                  </div>

                  {profileError ? <p className="mt-4 text-sm font-medium text-rose-600">{profileError}</p> : null}
                  {profileMessage ? (
                    <p className="mt-4 text-sm font-medium text-emerald-600">{profileMessage}</p>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={patientPrimaryButtonClass}
                      onClick={() => void handleSavePatientProfile()}
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      className={patientSecondaryButtonClass}
                      onClick={() => setSection('booking_appointments')}
                    >
                      Open booking
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className={`${patientPageCardClass} p-6`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Completion Status
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-900">
                    {completedProfileChecklistCount}/{profileChecklist.length}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Required sections completed</p>

                  <div className="mt-5 space-y-3">
                    {profileChecklist.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${item.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                          >
                            {item.complete ? 'Ready' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${patientPageCardClass} p-6`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Preferences
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    Settings and notifications
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Manage reminders, password changes, theme, and account controls from the lower menu.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <button
                      type="button"
                      className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
                      onClick={() => setSection('notifications')}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">Notifications</span>
                        <span className="mt-1 block text-sm text-slate-500">
                          Email alerts, browser alerts, and reminders
                        </span>
                      </span>
                      <span className="text-slate-400">›</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
                      onClick={() => setSection('settings')}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">Account Settings</span>
                        <span className="mt-1 block text-sm text-slate-500">
                          Theme, password, session, and sign out controls
                        </span>
                      </span>
                      <span className="text-slate-400">›</span>
                    </button>
                  </div>
                </div>

                <div className={`${patientPageCardClass} p-6`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Booking Access
                  </p>
                  <p className="mt-3 text-lg font-semibold text-slate-900">
                    {isProfileComplete ? 'You can book appointments now.' : 'Booking is still locked.'}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {isProfileComplete
                      ? 'Your required profile and emergency details are complete.'
                      : 'Finish the required profile blocks before moving back to appointment booking.'}
                  </p>
                  <button
                    type="button"
                    className={`mt-5 w-full ${isProfileComplete ? patientPrimaryButtonClass : patientSecondaryButtonClass}`}
                    onClick={() => setSection('booking_appointments')}
                  >
                    Go to booking
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderBookingAppointments = () => {
    const selectedDoctorName = selectedDoctor
      ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}`.trim()
      : 'Not selected'
    const selectedSlotLabel = selectedSlot
      ? `${formatPatientDate(selectedSlot.startIso)} · ${formatPatientTime(selectedSlot.startIso)}`
      : 'Choose a date and slot'
    const canContinueFromStepOne = isProfileComplete && bookingSymptoms.trim().length >= 5
    const bookingReadinessItems = [
      { label: 'Complete patient profile', ready: isProfileComplete },
      { label: 'Add visit reason', ready: bookingSymptoms.trim().length >= 5 },
      { label: 'Select specialist and doctor', ready: Boolean(selectedDoctorId) },
      { label: 'Pick an available slot', ready: Boolean(selectedSlotStartIso) },
    ]
    const currentStepContent =
      bookingStep === 1 ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Patient details
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                Your Information
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Make sure your contact details are correct and tell us why you need this appointment.
              </p>
            </div>

            {!isProfileComplete ? (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
                onClick={() => setSection('profile')}
              >
                Complete Profile
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Full Name</label>
              <input value={profileName} disabled className={patientMutedFieldClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Email Address</label>
              <input value={authUser?.username ?? ''} disabled className={patientMutedFieldClass} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Phone Number</label>
              <input
                value={profileForm.phoneNumber}
                disabled
                placeholder="Update in Profile"
                className={patientMutedFieldClass}
              />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason for Visit</label>
            <textarea
              placeholder="Describe the symptoms, concern, or follow-up you need."
              value={bookingSymptoms}
              onChange={(event) => setBookingSymptoms(event.target.value)}
              rows={5}
              className={patientFieldClass}
            />
            <p className="mt-2 text-xs text-slate-400">
              Add at least a short summary so triage can route you correctly.
            </p>
          </div>

          {!isProfileComplete ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              Complete your profile and health information before continuing.
            </div>
          ) : null}
          {bookingError ? <p className="text-sm font-medium text-rose-600">{bookingError}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={patientPrimaryButtonClass}
              onClick={() => {
                setBookingError(null)
                if (!isProfileComplete) {
                  setSection('profile')
                  return
                }
                if (bookingSymptoms.trim().length < 5) {
                  setBookingError('Add more details in symptoms so the care team can triage your booking.')
                  return
                }
                setBookingStep(2)
              }}
            >
              {isProfileComplete ? 'Continue to Specialists' : 'Complete Profile First'}
            </button>
          </div>
        </div>
      ) : bookingStep === 2 ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Specialist selection
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
              Choose Specialist
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Select a department first, then pick the doctor you want to consult with.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
              <label className="mb-3 block text-sm font-medium text-slate-700">Select Specialty</label>
              <div className="grid grid-cols-2 gap-3">
                {departmentOptions.map((department) => (
                  <button
                    key={department}
                    type="button"
                    onClick={() => setBookingDepartment(department)}
                    className={`rounded-2xl border p-4 text-left text-sm font-medium transition-all ${bookingDepartment === department ? 'border-blue-500 bg-white text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <span className="mb-2 block text-xl">{resolveDepartmentIcon(department)}</span>
                    <span className="block leading-5">{department}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <label className="mb-3 block text-sm font-medium text-slate-700">Priority</label>
                <div className="flex flex-wrap gap-2">
                  {(['Low', 'Routine', 'High'] as Array<Reservation['priority']>).map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setBookingPriority(priority)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${bookingPriority === priority ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700">Available Doctors</label>
              <div className="space-y-3">
                {isLoadingDoctors ? (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm text-slate-500">
                    Loading available doctors...
                  </div>
                ) : availableDoctors.length > 0 ? (
                  availableDoctors.map((doctor) => {
                    const doctorName = `${doctor.firstName} ${doctor.lastName}`.trim()
                    const isSelected = doctor.id === selectedDoctorId
                    return (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => setSelectedDoctorId(doctor.id)}
                        className={`flex w-full items-start gap-4 rounded-[1.5rem] border p-5 text-left transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {resolvePatientInitials(doctorName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-base font-semibold text-slate-900">{doctorName}</p>
                            {isSelected ? (
                              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                                Selected
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{doctor.department || bookingDepartment}</p>
                          <p className="mt-3 text-sm text-slate-400">
                            Available for new booking requests in this department.
                          </p>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm text-slate-500">
                    No available doctors were found for this department.
                  </div>
                )}
              </div>
              {doctorLoadError ? <p className="mt-3 text-sm text-rose-600">{doctorLoadError}</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={patientSecondaryButtonClass}
              onClick={() => setBookingStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!selectedDoctorId}
              className={patientPrimaryButtonClass}
              onClick={() => {
                setBookingError(null)
                setBookingStep(3)
              }}
            >
              Continue to Schedule
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
            void submitBooking()
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Date and time
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
              Pick a Date &amp; Time
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Review schedule availability, choose a slot, and add final notes before submitting.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
              <label className="mb-2 block text-sm font-medium text-slate-700">Appointment Date</label>
              <input
                type="date"
                min={formatDateInput(new Date())}
                value={bookingDate}
                onChange={(event) => setBookingDate(event.target.value)}
                className={patientFieldClass}
              />
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
              <p className="mb-2 text-sm font-medium text-slate-700">Schedule Status</p>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedDaySessions.morning ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  Morning {selectedDaySessions.morning ? 'Open' : 'Closed'}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedDaySessions.afternoon ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                  Afternoon {selectedDaySessions.afternoon ? 'Open' : 'Closed'}
                </span>
              </div>
              {slotStatusMessage ? <p className="mt-3 text-sm text-slate-500">{slotStatusMessage}</p> : null}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-slate-700">Available Time Slots</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {!selectedDoctorId ? (
                <p className="col-span-full text-sm text-slate-500">Select a doctor first.</p>
              ) : isLoadingSlots ? (
                <p className="col-span-full text-sm text-slate-500">Loading schedule slots...</p>
              ) : availableSlots.length > 0 ? (
                availableSlots.map((slot) => (
                  <button
                    key={slot.startIso}
                    type="button"
                    onClick={() => setSelectedSlotStartIso(slot.startIso)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${selectedSlotStartIso === slot.startIso ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <span className="block text-sm font-semibold">{slot.label}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.12em] text-slate-400">
                      {slot.session}
                    </span>
                  </button>
                ))
              ) : (
                <p className="col-span-full text-sm text-slate-500">No available slots for this date.</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Additional Notes</label>
            <textarea
              value={bookingNote}
              onChange={(event) => setBookingNote(event.target.value)}
              placeholder="Add anything important for scheduling or care context."
              rows={4}
              className={patientFieldClass}
            />
          </div>

          {slotLoadError ? <p className="text-sm text-rose-600">{slotLoadError}</p> : null}
          {bookingError ? <p className="text-sm font-medium text-rose-600">{bookingError}</p> : null}
          {bookingMessage ? <p className="text-sm font-medium text-emerald-600">{bookingMessage}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={patientSecondaryButtonClass}
              onClick={() => setBookingStep(2)}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!selectedSlotStartIso || isSubmittingBooking}
              className={patientPrimaryButtonClass}
            >
              {isSubmittingBooking ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      )

    return (
      <div className="p-6 md:p-8 xl:p-10">
        <div className="mx-auto max-w-[84rem] space-y-6">
          {renderPatientTopShell({
            eyebrow: 'Appointments',
            title: 'Book an Appointment',
            description: 'Schedule your visit with our specialists and keep the request synced across each step.',
            metrics: [
              {
                key: 'booking-profile',
                label: 'Profile',
                value: isProfileComplete ? 'Ready' : 'Needs work',
                caption: 'Required details',
              },
              {
                key: 'booking-step',
                label: 'Current step',
                value: `${bookingStep}/3`,
                caption: 'Booking progress',
              },
              {
                key: 'booking-doctors',
                label: 'Doctors',
                value: availableDoctors.length,
                caption: `${bookingDepartment} roster`,
              },
              {
                key: 'booking-slot',
                label: 'Slot',
                value: selectedSlotStartIso ? 'Selected' : 'Pending',
                caption: selectedSlotLabel,
              },
            ],
            quickActions: (
              <>
                <button
                  type="button"
                  className={patientCompactActionButtonClass}
                  onClick={() => setSection('profile')}
                >
                  Review profile
                </button>
                <button
                  type="button"
                  className={patientCompactActionButtonClass}
                  onClick={() => setSection('history')}
                >
                  View history
                </button>
              </>
            ),
          })}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_23rem] xl:items-start">
            <section className={`${patientPageCardClass} overflow-hidden border-slate-200/90 p-6 shadow-[0_22px_50px_rgba(15,23,42,0.05)] md:p-8`}>
              <div className="mb-6 grid gap-3 lg:grid-cols-3">
                {[
                  { step: 1, label: 'Your Details', hint: canContinueFromStepOne ? 'Ready' : 'Needs review' },
                  { step: 2, label: 'Choose Specialist', hint: selectedDoctorId ? 'Doctor picked' : 'Select one' },
                  { step: 3, label: 'Date & Time', hint: selectedSlotStartIso ? 'Slot chosen' : 'Choose a time' },
                ].map((item) => (
                  <div
                    key={item.step}
                    className={`min-w-[12rem] rounded-[1.35rem] border px-4 py-3 transition-all ${bookingStep === item.step ? 'border-blue-200 bg-[linear-gradient(140deg,#eff6ff_0%,#f8fbff_100%)] shadow-[0_12px_28px_rgba(59,130,246,0.12)]' : bookingStep > item.step ? 'border-emerald-200 bg-[linear-gradient(140deg,#ecfdf5_0%,#f8fffb_100%)]' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${bookingStep === item.step ? 'bg-blue-600 text-white' : bookingStep > item.step ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {item.step}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.hint}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {currentStepContent}
            </section>

            <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
              <div className={`${patientPageCardClass} border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Appointment Preview
                </p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Patient</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{profileName}</p>
                    <p className="mt-1 text-sm text-slate-500">{authUser?.username ?? 'No email on file'}</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Department', value: bookingDepartment },
                      { label: 'Doctor', value: selectedDoctorName },
                      { label: 'Priority', value: bookingPriority },
                      { label: 'Schedule', value: selectedSlotLabel },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                      >
                        <span className="text-sm text-slate-500">{item.label}</span>
                        <strong className="text-right text-sm font-semibold text-slate-900">{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.7rem] border border-blue-100 bg-[radial-gradient(circle_at_top_right,rgba(191,219,254,0.45),transparent_34%),linear-gradient(160deg,#eff6ff_0%,#f8fbff_56%,#ffffff_100%)] p-5 shadow-[0_18px_36px_rgba(59,130,246,0.10)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700/70">
                  Booking Checklist
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep everything in one place while you finish the request. The sidebar stays pinned and
                  this checklist updates as you complete each requirement.
                </p>
                <div className="mt-4 space-y-3">
                  {bookingReadinessItems.map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${item.ready ? 'border-emerald-100 bg-white text-slate-900' : 'border-blue-100 bg-white/90 text-slate-700'}`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${item.ready ? 'bg-emerald-500 text-white' : 'bg-blue-100 text-blue-700'}`}
                      >
                        {item.ready ? '✓' : '•'}
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>

                {!isProfileComplete ? (
                  <button
                    type="button"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                    onClick={() => setSection('profile')}
                  >
                    Finish Profile
                  </button>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </div>
    )
  }

  const renderHistoryList = () => (
    <div className="p-6 md:p-8 xl:p-10">
      <div className="mx-auto max-w-[84rem] space-y-6">
        {renderPatientTopShell({
          eyebrow: 'Appointments',
          title: 'History',
          description: 'Search and filter all booked, completed, and cancelled appointments.',
          showSearch: true,
          searchPlaceholder: 'Search by id, department, summary, or name...',
          metrics: [
            { key: 'history-total', label: 'Total', value: historyStats.total, caption: 'All appointments' },
            { key: 'history-upcoming', label: 'Upcoming', value: historyStats.upcoming, caption: 'Still scheduled' },
            { key: 'history-completed', label: 'Completed', value: historyStats.completed, caption: 'Recorded visits' },
            { key: 'history-cancelled', label: 'Cancelled', value: historyStats.cancelled, caption: 'Closed bookings' },
          ],
          quickActions: (
            <button
              type="button"
              className={patientPrimaryButtonClass}
              onClick={() => setSection('booking_appointments')}
            >
              Book appointment
            </button>
          ),
        })}

        <SectionCard
          title="History timeline"
          description="Use the status filter to narrow the list before opening another booking."
          toolbar={
            <div className="flex flex-wrap gap-1">
              {(['all', 'upcoming', 'completed', 'cancelled'] as HistoryFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setHistoryFilter(filter)}
                  className={`${patientHistoryFilterClass} ${historyFilter === filter ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          }
        >
          {visibleReservations.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="mx-auto mb-3 text-4xl opacity-40">📂</div>
              <p className="font-medium text-slate-500">No appointments found</p>
              <p className="mt-1 text-sm">
                {sortedReservations.length === 0
                  ? "You haven't booked any appointments yet."
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleReservations.map((item) => {
                const statusMeta = getReservationStatusMeta(item.status)
                const prescriptionSummary =
                  item.prescriptions && item.prescriptions.length > 0
                    ? item.prescriptions
                        .map((prescription) => `${prescription.medication} ${prescription.dosage}`)
                        .join(', ')
                    : null

                return (
                  <div
                    key={item.id}
                    className={`${patientPageCardClass} p-5 transition-shadow hover:shadow-md`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                        {resolveDepartmentIcon(item.department)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">{item.department}</p>
                            <p className="text-sm text-slate-500">
                              {dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusMeta.color}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                          <span>{formatPatientDate(item.requestedTime)}</span>
                          <span>{formatPatientTime(item.requestedTime)}</span>
                          <span>{item.id}</span>
                        </div>
                        {item.summary ? <p className="mt-2 text-sm text-slate-400">📝 {item.summary}</p> : null}
                        {prescriptionSummary ? (
                          <p className="mt-2 text-sm text-slate-400">💊 {prescriptionSummary}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )

  const renderNotificationsSection = () => (
    <div className="p-6 md:p-8 xl:p-10">
      <div className="mx-auto max-w-[84rem] space-y-6">
        {renderPatientTopShell({
          eyebrow: 'Preferences',
          title: 'Notifications',
          description: 'Choose how booking reminders, alerts, and account updates are delivered.',
          metrics: [
            { key: 'notif-active', label: 'Active', value: activeNotificationPreferenceCount, caption: 'Enabled preferences' },
            { key: 'notif-delivery', label: 'Delivery', value: notificationDeliveryItems.length, caption: 'Channel groups' },
            { key: 'notif-booking', label: 'Booking alerts', value: notificationBookingItems.length, caption: 'Care update groups' },
            { key: 'notif-session', label: 'Session', value: sessionStatus, caption: 'Current sync state' },
          ],
          quickActions: (
            <button
              type="button"
              className={patientSecondaryButtonClass}
              onClick={() => setSection('history')}
            >
              View booking history
            </button>
          ),
        })}

        <SectionCard
          title="Notification preferences"
          description="Changes sync to your account settings so reminders and alerts stay consistent across sessions."
          className="max-w-3xl"
        >
          <div className="space-y-6">
            {isLoadingNotificationPrefs ? (
              <p className="text-sm text-slate-500">Loading notification settings...</p>
            ) : null}
            {renderNotificationPreferenceGroup('Delivery Channels', notificationDeliveryItems)}
            {renderNotificationPreferenceGroup('Booking Updates', notificationBookingItems)}

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Notification Status
              </p>
              <p className="mb-3 text-sm text-slate-500">
                Current sync status: <span className="font-medium text-slate-700">{sessionStatus}</span>
              </p>
              {notificationPrefsError ? (
                <p className="mb-3 text-sm text-rose-600">{notificationPrefsError}</p>
              ) : null}
              {notificationPrefsMessage ? (
                <p className="mb-3 text-sm text-emerald-600">{notificationPrefsMessage}</p>
              ) : null}
              <p className="text-sm text-slate-500">
                {activeNotificationPreferenceCount} active notification preference
                {activeNotificationPreferenceCount === 1 ? '' : 's'}.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )

  const renderAccountSettingsSection = () => (
    <div className="p-6 md:p-8 xl:p-10">
      <div className="mx-auto max-w-[84rem] space-y-6">
        {renderPatientTopShell({
          eyebrow: 'Account',
          title: 'Account settings',
          description: 'Manage session controls, theme preferences, password, and sign-out actions.',
          metrics: [
            { key: 'settings-role', label: 'Role', value: getRoleLabel(authUser?.role), caption: 'Access scope' },
            { key: 'settings-theme', label: 'Theme', value: theme === 'dark' ? 'Dark' : 'Light', caption: 'Current preference' },
            { key: 'settings-session', label: 'Session', value: sessionStatus, caption: 'Authentication state' },
            { key: 'settings-notif', label: 'Alerts', value: activeNotificationPreferenceCount, caption: 'Active preferences' },
          ],
          quickActions: (
            <button
              type="button"
              onClick={onToggleTheme}
              className={patientSecondaryButtonClass}
            >
              Switch to {theme === 'dark' ? 'Light' : 'Dark'} theme
            </button>
          ),
        })}

        <SectionCard
          title="Account controls"
          description="Use these controls to review your current session and update your password."
          className="max-w-3xl"
        >
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 rounded-xl border border-slate-100 p-4">
                <p className="text-sm text-slate-500">
                  Signed in as <span className="font-medium text-slate-700">{authUser?.username ?? '—'}</span>
                </p>
                <p className="text-sm text-slate-500">
                  Role: <span className="font-medium text-slate-700">{getRoleLabel(authUser?.role)}</span>
                </p>
                <p className="text-sm text-slate-400">Session: {sessionStatus}</p>
              </div>
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Quick Controls
                </p>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Theme: {theme === 'dark' ? 'Dark' : 'Light'}
                </button>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void handleSavePassword()
              }}
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Change Password
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Current password"
                  className={patientFieldClass}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                  className={patientFieldClass}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm password"
                  className={patientFieldClass}
                />
              </div>
              {passwordError ? <p className="mt-3 text-sm text-rose-600">{passwordError}</p> : null}
              {passwordMessage ? <p className="mt-3 text-sm text-emerald-600">{passwordMessage}</p> : null}
              <button
                type="submit"
                disabled={isSavingPassword}
                className={`mt-4 ${patientPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSavingPassword ? 'Updating password...' : 'Update password'}
              </button>
            </form>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Session</p>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )

  return (
    <PageCanvas className="patient-theme">
      <div className="w-full">
        <SidebarShell
          className={`page-shell--full-side patient-shell${isSidebarCollapsed ? ' page-shell--rail-collapsed' : ''}`}
          contentClassName="patient-shell-content"
          mobileTitle="Patient menu"
          stickyOffsetMode="auto"
          sidebar={
            <Sidebar
              variant="patient"
              mobileMode="drawer"
              fullRail
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
              brandTitle="AI Health Care"
              brandSubtitle="Patient"
              sectionLabel="Patient"
              items={sidebarItems}
              activeKey={activeSection}
              onSelect={(key) => {
                if (isUserSidebarSection(key)) {
                  setSection(key)
                }
              }}
              auxiliaryLabel="Account"
              secondaryItems={patientUtilityItems}
              onSelectAuxiliary={(key) => {
                if (key === 'notifications' || key === 'settings') {
                  setSection(key)
                }
              }}
              footerProfile={{
                name: profileName,
                subtitle: 'Patient',
                avatarText: profileInitials,
                active: activeSection === 'profile',
                onClick: () => setSection('profile'),
              }}
            />
          }
          content={
            <section className="patient-main">
              {activeSection === 'booking_appointments' ? (
                renderBookingAppointments()
              ) : null}
              {activeSection === 'profile' ? renderProfileSection() : null}
              {activeSection === 'history' ? renderHistoryList() : null}
              {activeSection === 'notifications' ? renderNotificationsSection() : null}
              {activeSection === 'settings' ? renderAccountSettingsSection() : null}
              <ConfirmModal
                open={showLogoutConfirm}
                title="Confirm logout"
                message="Are you sure you want to logout?"
                confirmLabel="Logout"
                cancelLabel="Cancel"
                onConfirm={() => {
                  setShowLogoutConfirm(false)
                  onLogout?.()
                }}
                onCancel={() => setShowLogoutConfirm(false)}
              />
            </section>
          }
        />
      </div>
    </PageCanvas>
  )
}

export default PatientAppointmentsPage
