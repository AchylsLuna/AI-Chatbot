import { useEffect, useMemo, useState } from 'react'
import PageCanvas from '../../components/layout/PageCanvas'
import Sidebar, { type SidebarItem } from '../../components/layout/Sidebar'
import SidebarShell from '../../components/layout/SidebarShell'
import { buildRouteFromCanonicalPath, normalizePath } from '../../config/routing'
import {
  getAppointmentsTabPath,
  resolveAppointmentsTabFromPath,
} from '../../config/roleTabRoutes'
import type { AppPage } from '../../types/navigation'
import ConfirmModal from '../../components/ui/ConfirmModal'
import type { AuthSession, Reservation, ReservationDraft } from '../../types'
import { formatPhilippineDateTime } from '../../utils/dateTime'
import { maskPersonName } from '../../utils/privacy'
import { getRoleLabel } from '../../utils/roles'
import {
  api,
  type DoctorAvailability,
  type DoctorAvailableSlot,
  type DoctorScheduleDay,
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
  { key: 'notifications', label: 'Notifications', icon: 'alert' },
]

const utilityItems: SidebarItem[] = [
  { key: 'settings', label: 'Account Settings', icon: 'settings' },
]

const notificationPrefKey = 'pulse-ledger-notification-preferences'
const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  browserAlerts: true,
  appointmentReminders: true,
  securityAlerts: true,
}

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

const patientPageCardClass = 'rounded-2xl border border-slate-100 bg-white shadow-sm'
const patientFieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const patientMutedFieldClass = `${patientFieldClass} bg-slate-50 text-slate-500`
const patientPrimaryButtonClass =
  'inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
const patientSecondaryButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
const patientInlineStatusClass =
  'rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500'
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

const sectionEyebrowMap: Record<UserSidebarSection, string> = {
  booking_appointments: 'Patient care',
  profile: 'Profile',
  history: 'Booking history',
  notifications: 'Notifications',
  settings: 'Account settings',
}

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
  const [activeSection, setActiveSection] = useState<UserSidebarSection>(() => {
    if (typeof window === 'undefined') return 'booking_appointments'
    return resolveAppointmentsTabFromPath(window.location.pathname) ?? 'booking_appointments'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1)

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(notificationPrefKey, JSON.stringify(notificationPrefs))
  }, [notificationPrefs])

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
    setActiveSection(next)
    if (typeof window === 'undefined') return

    const targetPath = getAppointmentsTabPath(next)
    if (normalizePath(window.location.pathname) === normalizePath(targetPath)) return

    window.history.pushState(
      { ...(window.history.state ?? {}), appRoute: true, appPage: 'appointments' },
      '',
      buildRouteFromCanonicalPath(targetPath)
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setActiveSection(resolveAppointmentsTabFromPath(window.location.pathname) ?? 'booking_appointments')
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

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

  const activeBookedAppointment = useMemo(
    () => sortedReservations.find((item) => item.status === 'Booked') ?? null,
    [sortedReservations]
  )

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

  const toggleNotificationPreference = (key: keyof NotificationPreferences) => {
    setNotificationPrefs((previous) => ({ ...previous, [key]: !previous[key] }))
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
                onClick={() => toggleNotificationPreference(item.key)}
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

  const renderProfileSection = () => (
    <section className="space-y-4">
      <article className={`${pagePanelClass} patient-flow-card p-6`}>
        <div className="patient-profile-hero">
          <div className="patient-profile-avatar" aria-hidden="true">
            {profileInitials}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-[color:var(--agent-ink)]">Profile</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
              Manage your personal information and medical intake details before booking care.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="patient-role-badge">Patient</span>
              <span className="text-sm text-[color:var(--agent-muted)]">
                {authUser?.username ?? 'No login email on file'}
              </span>
            </div>
          </div>
        </div>
        {!isProfileComplete ? (
          <p className="mt-3 text-sm font-semibold text-amber-600">
            Profile is incomplete. Booking is locked until all required fields are filled.
          </p>
        ) : null}
      </article>

      {isProfileLoading ? (
        <article className={`${pagePanelClass} patient-flow-card p-5`}>
          <p className="text-sm text-[color:var(--agent-muted)]">Loading profile data...</p>
        </article>
      ) : (
        <>
          <article className={`${pagePanelClass} patient-flow-card p-5`}>
            <h3 className="text-lg font-semibold text-[color:var(--agent-ink)]">Basic Information</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={profileForm.firstName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))
                }
                placeholder="First name *"
                readOnly
                disabled
                className={requiredFieldClass(!profileForm.firstName.trim(), profileSaveAttempted)}
              />
              <input
                value={profileForm.lastName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))
                }
                placeholder="Last name *"
                readOnly
                disabled
                className={requiredFieldClass(!profileForm.lastName.trim(), profileSaveAttempted)}
              />
              <input
                type="date"
                value={profileForm.dateOfBirth}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                }
                className={requiredFieldClass(!profileForm.dateOfBirth.trim(), profileSaveAttempted)}
              />
              <input
                value={profileForm.phoneNumber}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, phoneNumber: event.target.value }))
                }
                placeholder="Phone number *"
                className={requiredFieldClass(!profileForm.phoneNumber.trim(), profileSaveAttempted)}
              />
              <input
                value={profileForm.gender}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, gender: event.target.value }))
                }
                placeholder="Gender *"
                className={requiredFieldClass(!profileForm.gender.trim(), profileSaveAttempted)}
              />
              <input
                value={profileForm.address}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, address: event.target.value }))
                }
                placeholder="Address *"
                className={requiredFieldClass(!profileForm.address.trim(), profileSaveAttempted)}
              />
            </div>
          </article>

          <article className={`${pagePanelClass} patient-flow-card p-5`}>
            <h3 className="text-lg font-semibold text-[color:var(--agent-ink)]">Personal Health Information</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={healthForm.bloodType}
                onChange={(event) =>
                  setHealthForm((prev) => ({ ...prev, bloodType: event.target.value }))
                }
                placeholder="Blood type *"
                className={requiredFieldClass(!healthForm.bloodType.trim(), profileSaveAttempted)}
              />
            </div>

            <div className="mt-4 grid gap-4">
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

            <label className="mt-3 block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                Notes (optional)
              </span>
              <textarea
                value={healthForm.notes}
                onChange={(event) =>
                  setHealthForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                rows={3}
                className={pageFieldClass}
              />
            </label>
          </article>

          <article className={`${pagePanelClass} patient-flow-card p-5`}>
            <h3 className="text-lg font-semibold text-[color:var(--agent-ink)]">Emergency Contact</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={healthForm.emergencyContactName}
                onChange={(event) =>
                  setHealthForm((prev) => ({ ...prev, emergencyContactName: event.target.value }))
                }
                placeholder="Emergency contact name *"
                className={requiredFieldClass(!healthForm.emergencyContactName.trim(), profileSaveAttempted)}
              />
              <input
                value={healthForm.emergencyContactPhone}
                onChange={(event) =>
                  setHealthForm((prev) => ({ ...prev, emergencyContactPhone: event.target.value }))
                }
                placeholder="Emergency contact phone *"
                className={requiredFieldClass(!healthForm.emergencyContactPhone.trim(), profileSaveAttempted)}
              />
              <input
                value={healthForm.emergencyContactRelationship}
                onChange={(event) =>
                  setHealthForm((prev) => ({
                    ...prev,
                    emergencyContactRelationship: event.target.value,
                  }))
                }
                placeholder="Emergency contact relationship *"
                className={requiredFieldClass(!healthForm.emergencyContactRelationship.trim(), profileSaveAttempted)}
              />
            </div>

            {profileError ? <p className="mt-3 text-sm font-semibold text-rose-600">{profileError}</p> : null}
            {profileMessage ? (
              <p className="mt-3 text-sm font-semibold text-emerald-600">{profileMessage}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={pagePrimaryButtonClass}
                onClick={() => void handleSavePatientProfile()}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? 'Saving...' : 'Save profile'}
              </button>
              <button
                type="button"
                className={pageGhostButtonClass}
                onClick={() => setSection('booking_appointments')}
              >
                Go to book appointment
              </button>
            </div>
          </article>
        </>
      )}
    </section>
  )

  const renderBookingAppointments = () => (
    <section className="space-y-5">
      {renderPatientSectionHeader({
        title: 'Book Appointment',
        eyebrow: sectionEyebrowMap.booking_appointments,
        description:
          'Schedule a visit with the right department, doctor, and time slot before sending your request.',
        supporting: (
          <>
            <span className={`${pageChipButtonClass} bg-[color:var(--agent-overlay-strong)]`}>
              {isProfileComplete ? 'Profile ready' : 'Profile required'}
            </span>
            <span className={`${pageChipButtonClass} bg-[color:var(--agent-overlay-strong)]`}>
              {availableDoctors.length} doctor{availableDoctors.length === 1 ? '' : 's'} in{' '}
              {bookingDepartment}
            </span>
          </>
        ),
        controls: (
          <div className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-4`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--agent-muted-soft)]">
              Appointment summary
            </p>
            <div className="patient-summary-list mt-4">
              <div>
                <span>Department</span>
                <strong>{bookingDepartment}</strong>
              </div>
              <div>
                <span>Doctor</span>
                <strong>
                  {selectedDoctor
                    ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}`.trim()
                    : 'Not selected'}
                </strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{bookingDate || 'Not selected'}</strong>
              </div>
              <div>
                <span>Slot</span>
                <strong>{selectedSlot ? selectedSlot.label : 'Not selected'}</strong>
              </div>
            </div>
          </div>
        ),
      })}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_22rem]">
        <form
          className={`${pagePanelClass} patient-flow-card p-6 sm:p-7`}
          onSubmit={(event) => {
            event.preventDefault()
            void submitBooking()
          }}
        >
          <div className="patient-step-row">
            {[
              { key: 1, label: 'Your Details', hint: isProfileComplete ? 'Ready' : 'Profile required' },
              {
                key: 2,
                label: 'Choose Specialist',
                hint: selectedDoctor ? 'Doctor selected' : 'Pick a doctor',
              },
              {
                key: 3,
                label: 'Date & Time',
                hint: selectedSlot ? 'Slot selected' : 'Choose a slot',
              },
            ].map((step) => {
              const isActive = bookingProgressStep === step.key
              const isComplete =
                step.key === 1
                  ? isProfileComplete
                  : step.key === 2
                    ? Boolean(selectedDoctor)
                    : Boolean(selectedSlot)

              return (
                <div
                  key={step.key}
                  className={`patient-step ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`}
                >
                  <span className="patient-step-index">{step.key}</span>
                  <span className="patient-step-copy">
                    <strong>{step.label}</strong>
                    <small>{step.hint}</small>
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-6 space-y-5">
            <section className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="patient-panel-kicker">Step 1</p>
                  <h2 className="text-lg font-semibold text-[color:var(--agent-ink)]">Your Details</h2>
                  <p className={`mt-2 text-sm leading-6 ${pageSubtleTextClass}`}>
                    Patient profile and personal health information must be complete before a
                    booking can be submitted.
                  </p>
                </div>
                {!isProfileComplete ? (
                  <button
                    type="button"
                    className={pageGhostButtonClass}
                    onClick={() => setSection('profile')}
                  >
                    Complete profile
                  </button>
                ) : (
                  <span className="patient-inline-note is-ready">Profile is complete</span>
                )}
              </div>
            </section>

            <section className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="patient-panel-kicker">Step 2</p>
                  <h2 className="text-lg font-semibold text-[color:var(--agent-ink)]">
                    Choose Specialist
                  </h2>
                </div>
                <label className="w-full sm:max-w-[15rem]">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                    Department
                  </span>
                  <select
                    value={bookingDepartment}
                    onChange={(event) =>
                      setBookingDepartment(event.target.value as (typeof departmentOptions)[number])
                    }
                    className={pageFieldClass}
                  >
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                  Priority
                </span>
                <select
                  value={bookingPriority}
                  onChange={(event) =>
                    setBookingPriority(event.target.value as Reservation['priority'])
                  }
                  className={pageFieldClass}
                >
                  <option value="Low">Low</option>
                  <option value="Routine">Routine</option>
                  <option value="High">High</option>
                </select>
              </label>

              <div className="patient-select-grid mt-5">
                {isLoadingDoctors ? (
                  <p className={`text-sm ${pageSubtleTextClass}`}>Loading available doctors...</p>
                ) : availableDoctors.length > 0 ? (
                  availableDoctors.map((doctor) => {
                    const doctorName = `${doctor.firstName} ${doctor.lastName}`.trim()
                    const isActive = doctor.id === selectedDoctorId

                    return (
                      <button
                        key={doctor.id}
                        type="button"
                        className={`patient-select-card ${isActive ? 'is-active' : ''}`}
                        onClick={() => setSelectedDoctorId(doctor.id)}
                      >
                        <span className="patient-select-avatar">
                          {resolvePatientInitials(doctorName)}
                        </span>
                        <span className="patient-select-copy">
                          <strong>{doctorName}</strong>
                          <small>{doctor.department || bookingDepartment}</small>
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <p className={`text-sm ${pageSubtleTextClass}`}>
                    No available doctors were found for this department.
                  </p>
                )}
              </div>
              {doctorLoadError ? (
                <p className="mt-3 text-xs font-semibold text-rose-600">{doctorLoadError}</p>
              ) : null}
            </section>

            <section className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-5`}>
              <p className="patient-panel-kicker">Step 3</p>
              <h2 className="text-lg font-semibold text-[color:var(--agent-ink)]">Date &amp; Time</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                    Preferred date
                  </span>
                  <input
                    type="date"
                    value={bookingDate}
                    min={formatDateInput(new Date())}
                    onChange={(event) => setBookingDate(event.target.value)}
                    className={pageFieldClass}
                  />
                </label>

                <div className="patient-inline-note">
                  <strong>Schedule status</strong>
                  <span>
                    Morning {selectedDaySessions.morning ? 'open' : 'closed'} · Afternoon{' '}
                    {selectedDaySessions.afternoon ? 'open' : 'closed'}
                  </span>
                </div>
              </div>

              <div className="mt-4 patient-slot-grid">
                {!selectedDoctorId ? (
                  <p className={`text-sm ${pageSubtleTextClass}`}>Select a doctor first.</p>
                ) : isLoadingSlots ? (
                  <p className={`text-sm ${pageSubtleTextClass}`}>Loading schedule slots...</p>
                ) : availableSlots.length > 0 ? (
                  availableSlots.map((slot) => (
                    <button
                      key={slot.startIso}
                      type="button"
                      className={`patient-slot-chip ${slot.startIso === selectedSlotStartIso ? 'is-active' : ''}`}
                      onClick={() => setSelectedSlotStartIso(slot.startIso)}
                    >
                      <strong>{slot.label}</strong>
                      <small>{slot.session}</small>
                    </button>
                  ))
                ) : (
                  <p className={`text-sm ${pageSubtleTextClass}`}>No available slots for this date.</p>
                )}
              </div>

              {slotStatusMessage ? (
                <p className="mt-3 text-sm font-semibold text-[color:var(--agent-ink)]">
                  {slotStatusMessage}
                </p>
              ) : null}
              {slotLoadError ? (
                <p className="mt-2 text-xs font-semibold text-rose-600">{slotLoadError}</p>
              ) : null}
            </section>

            <section className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-5`}>
              <p className="patient-panel-kicker">Visit Notes</p>
              <h2 className="text-lg font-semibold text-[color:var(--agent-ink)]">Symptoms and notes</h2>

              <div className="mt-4 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                    Symptoms
                  </span>
                  <textarea
                    value={bookingSymptoms}
                    onChange={(event) => setBookingSymptoms(event.target.value)}
                    placeholder="Describe symptoms and how long you've experienced them."
                    rows={4}
                    className={pageFieldClass}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                    Additional notes
                  </span>
                  <textarea
                    value={bookingNote}
                    onChange={(event) => setBookingNote(event.target.value)}
                    placeholder="Add anything important for scheduling or care context."
                    rows={3}
                    className={pageFieldClass}
                  />
                </label>
              </div>
            </section>
          </div>

          {bookingError ? (
            <p className="mt-5 text-sm font-semibold text-rose-600">{bookingError}</p>
          ) : null}
          {bookingMessage ? (
            <p className="mt-5 text-sm font-semibold text-emerald-600">{bookingMessage}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              className={pagePrimaryButtonClass}
              disabled={isSubmittingBooking || !isProfileComplete}
            >
              {isSubmittingBooking ? 'Submitting...' : 'Submit appointment request'}
            </button>
            <button
              type="button"
              className={pageGhostButtonClass}
              onClick={() => setSection('history')}
            >
              View history
            </button>
          </div>
        </form>

        <div className="space-y-5">
          <article className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-5`}>
            <h3 className="text-lg font-semibold text-[color:var(--agent-ink)]">
              Before you submit
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--agent-muted)]">
              <li>Complete Profile and Personal Health Information first.</li>
              <li>Select a department, then choose an available doctor.</li>
              <li>Pick a date and tap one open schedule slot.</li>
              <li>Describe symptoms clearly for faster triage.</li>
            </ul>
          </article>

          <article className={`${pagePanelClass} patient-flow-card p-5`}>
            <h3 className="text-lg font-semibold text-[color:var(--agent-ink)]">
              Current selection
            </h3>
            <div className="patient-summary-list mt-4">
              <div>
                <span>Doctor</span>
                <strong>
                  {selectedDoctor
                    ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}`.trim()
                    : 'None yet'}
                </strong>
              </div>
              <div>
                <span>Priority</span>
                <strong>{bookingPriority}</strong>
              </div>
              <div>
                <span>Slot</span>
                <strong>{selectedSlot ? `${selectedSlot.label} (${selectedSlot.session})` : 'None yet'}</strong>
              </div>
            </div>
          </article>

          <article className={`${pagePanelClass} patient-flow-card p-5`}>
            <h3 className="text-lg font-semibold text-[color:var(--agent-ink)]">
              Upcoming booking
            </h3>
            {activeBookedAppointment ? (
              <div className="mt-4 space-y-3 text-sm text-[color:var(--agent-muted)]">
                <p className="font-semibold text-[color:var(--agent-ink)]">
                  {activeBookedAppointment.department}
                </p>
                <p>{formatPhilippineDateTime(activeBookedAppointment.requestedTime)}</p>
                <p>{activeBookedAppointment.summary}</p>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(activeBookedAppointment.status)}`}
                >
                  {activeBookedAppointment.status}
                </span>
              </div>
            ) : (
              <p className={`mt-3 text-sm leading-6 ${pageSubtleTextClass}`}>
                No active booking yet. Submit your first appointment request from this page.
              </p>
            )}
          </article>
        </div>
      </div>
    </section>
  )

  const renderHistoryList = () => {
    const searchControl = (
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--agent-muted-soft)]">
          Search history
        </span>
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by appointment ID, patient, department, or summary"
          className={pageFieldClass}
        />
      </label>
    )

    const historyStatCards = (
      <div className="patient-kpi-grid">
        {[
          { key: 'total', label: 'Total', value: historyStats.total, tone: 'slate' },
          { key: 'booked', label: 'Booked', value: historyStats.booked, tone: 'blue' },
          { key: 'recorded', label: 'Recorded', value: historyStats.recorded, tone: 'green' },
          { key: 'failed', label: 'Failed', value: historyStats.failed, tone: 'rose' },
        ].map((item) => (
          <article key={item.key} className={`patient-kpi-card tone-${item.tone}`}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
    )

    if (visibleReservations.length === 0) {
      return (
        <section className="space-y-5">
          {renderPatientSectionHeader({
            title: 'History',
            eyebrow: sectionEyebrowMap.history,
            description:
              'Review previous appointment requests, statuses, and e-prescription details in one place.',
            controls: searchControl,
            supporting: (
              <span className={`${pageChipButtonClass} bg-[color:var(--agent-overlay-strong)]`}>
                {sortedReservations.length} total record{sortedReservations.length === 1 ? '' : 's'}
              </span>
            ),
          })}

          {historyStatCards}

          <article className={`${pagePanelClass} patient-flow-card p-6`}>
            <h2 className="text-xl font-semibold text-[color:var(--agent-ink)]">
              No appointments found
            </h2>
            <p className={`mt-3 text-sm leading-6 ${pageSubtleTextClass}`}>
              {searchQuery
                ? 'No records match this search. Clear or adjust your query.'
                : "You haven't booked any appointments yet."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className={pagePrimaryButtonClass}
                onClick={() => setSection('booking_appointments')}
              >
                Open book appointment
              </button>
              {searchQuery ? (
                <button
                  type="button"
                  className={pageGhostButtonClass}
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              ) : null}
            </div>
          </article>
        </section>
      )
    }

    return (
      <section className="space-y-5">
        {renderPatientSectionHeader({
          title: 'History',
          eyebrow: sectionEyebrowMap.history,
          description:
            'Review previous appointment requests, statuses, and e-prescription details in one place.',
          controls: searchControl,
          supporting: (
            <span className={`${pageChipButtonClass} bg-[color:var(--agent-overlay-strong)]`}>
              Showing {visibleReservations.length} of {sortedReservations.length}
            </span>
          ),
        })}

        {historyStatCards}

        <section className="space-y-4">
          {visibleReservations.map((item) => (
            <article key={item.id} className={`${pagePanelClass} patient-flow-card p-5`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted)]">
                      {item.id}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[color:var(--agent-ink)]">
                    {dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                    {item.department} · {formatPhilippineDateTime(item.requestedTime)}
                  </p>
                </div>
                <div className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft min-w-[14rem] p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Summary
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
                    {item.summary || 'No summary recorded.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Symptoms
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
                    {item.symptoms || item.summary || 'No symptoms recorded.'}
                  </p>
                </div>

                <div className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    E-Prescription
                  </p>
                  {item.prescriptions && item.prescriptions.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {item.prescriptions.map((prescription, index) => (
                        <p
                          key={`${item.id}-rx-${index}`}
                          className="text-sm leading-6 text-[color:var(--agent-muted)]"
                        >
                          {prescription.medication} - {prescription.dosage}
                          {prescription.frequency ? ` · ${prescription.frequency}` : ''}
                          {prescription.durationDays
                            ? ` · ${prescription.durationDays} day(s)`
                            : ''}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[color:var(--agent-muted)]">
                      No e-prescriptions yet.
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      </section>
    )
  }

  const renderNotificationsSection = () => (
    <section className="space-y-5">
      {renderPatientSectionHeader({
        title: 'Notifications',
        eyebrow: sectionEyebrowMap.notifications,
        description:
          'Control how booking alerts, reminders, and security updates reach you across this device and your email inbox.',
        supporting: (
          <span className={`${pageChipButtonClass} bg-[color:var(--agent-overlay-strong)]`}>
            Session status: {sessionStatus}
          </span>
        ),
        controls: (
          <div className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-4`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--agent-muted-soft)]">
              Quick access
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={pageGhostButtonClass}
                onClick={() => setSection('history')}
              >
                View history
              </button>
              <button
                type="button"
                className={pageGhostButtonClass}
                onClick={() => setSection('settings')}
              >
                Open settings
              </button>
            </div>
          </div>
        ),
      })}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {renderNotificationPreferenceGroup('Delivery channels', notificationDeliveryItems)}
          {renderNotificationPreferenceGroup('Booking updates', notificationBookingItems)}
        </div>

        <div className="space-y-5">
          <article className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-5`}>
            <h3 className="text-lg font-semibold text-[color:var(--agent-ink)]">
              Current delivery setup
            </h3>
            <div className="mt-4 grid gap-3">
              <div>
                <p className="text-2xl font-semibold text-[color:var(--agent-ink)]">
                  {activeNotificationPreferenceCount}
                </p>
                <p className={`mt-1 text-sm ${pageSubtleTextClass}`}>
                  active notification preference{activeNotificationPreferenceCount === 1 ? '' : 's'}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[color:var(--agent-ink)]">
                  Booking reminders are {notificationPrefs.appointmentReminders ? 'on' : 'off'}
                </p>
                <p className={`mt-1 text-sm ${pageSubtleTextClass}`}>
                  Security alerts are {notificationPrefs.securityAlerts ? 'enabled' : 'disabled'}
                </p>
              </div>
            </div>
          </article>

          <article className={`${pagePanelClass} patient-flow-card p-5`}>
            <h3 className="text-lg font-semibold text-[color:var(--agent-ink)]">
              Sync status
            </h3>
            <p className={`mt-3 text-sm leading-6 ${pageSubtleTextClass}`}>
              Preferences are stored locally for this patient session and update immediately when
              you toggle them.
            </p>
            <p className="mt-4 text-sm font-semibold text-[color:var(--agent-ink)]">
              {sessionStatus}
            </p>
          </article>
        </div>
      </div>
    </section>
  )

  const renderAccountSettingsSection = () => (
    <section className={`${pagePanelClass} patient-flow-card p-5`}>
      <h2 className="text-2xl font-semibold text-[color:var(--agent-ink)]">Account settings</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
        Manage your session controls, privacy preferences, and password.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-4`}>
          <p className="text-sm text-[color:var(--agent-muted)]">
            Signed in as{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">
              {authUser?.username ?? 'Unknown'}
            </span>
          </p>
          <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
            Role:{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">
              {getRoleLabel(authUser?.role)}
            </span>
          </p>
          <p className="mt-2 text-xs text-[color:var(--agent-muted-soft)]">Session: {sessionStatus}</p>
        </div>

        <div className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-4`}>
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Quick controls
          </p>
          <div className="mt-3 grid gap-2">
            <button type="button" className={pageGhostButtonClass} onClick={onToggleTheme}>
              Theme: {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>
        </div>

        <form
          className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-4 xl:col-span-2`}
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
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Change password
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Current password"
              className={pageFieldClass}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className={pageFieldClass}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              className={pageFieldClass}
            />
          </div>
          {passwordError ? <p className="mt-3 text-xs font-semibold text-rose-500">{passwordError}</p> : null}
          {passwordMessage ? (
            <p className="mt-3 text-xs font-semibold text-emerald-600">{passwordMessage}</p>
          ) : null}
          <button type="submit" className={`mt-4 ${pagePrimaryButtonClass}`}>
            Update password
          </button>
        </form>

        <div className={`${pagePanelSoftClass} patient-flow-card patient-flow-card--soft p-4 xl:col-span-2`}>
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Session
          </p>
          <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
            Sign out from this device when you finish reviewing appointments and profile updates.
          </p>
          <div className="mt-4">
            <button
              type="button"
              className="patient-danger-button"
              onClick={() => setShowLogoutConfirm(true)}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </section>
  )

  const profileName = resolvePatientDisplayName(authUser)
  const profileInitials = resolvePatientInitials(profileName)

  return (
    <PageCanvas className="patient-theme">
      <div className="w-full">
        <SidebarShell
          className={`page-shell--full-side patient-shell${isSidebarCollapsed ? ' page-shell--rail-collapsed' : ''}`}
          contentClassName="patient-shell-content px-4 pb-10 pt-5 sm:px-6 lg:px-8 xl:px-10"
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
              secondaryItems={utilityItems}
              onSelectAuxiliary={(key) => {
                if (isUserSidebarSection(key)) {
                  setSection(key)
                }
              }}
              footerProfile={{
                name: profileName,
                subtitle: 'Patient',
                avatarText: profileInitials,
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
