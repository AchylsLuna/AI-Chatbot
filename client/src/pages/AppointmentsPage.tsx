import { useEffect, useMemo, useState } from 'react'
import DashboardTopBar from '../components/layout/DashboardTopBar'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../components/layout/Sidebar'
import WorkspaceSidebarShell from '../components/layout/WorkspaceSidebarShell'
import {
  workspaceFieldClass,
  workspaceGhostButtonClass,
  workspacePrimaryButtonClass,
} from '../styles/workspaceUi'
import { buildRouteFromCanonicalPath, normalizePath } from '../config/routing'
import {
  getAppointmentsTabPath,
  resolveAppointmentsTabFromPath,
} from '../config/workspaceTabRoutes'
import type { AppPage } from '../types/navigation'
import ConfirmModal from '../components/ui/ConfirmModal'
import type { AuthSession, Reservation, ReservationDraft } from '../types'
import { formatPhilippineDateTime } from '../utils/dateTime'
import { maskPersonName } from '../utils/privacy'
import { getWorkspaceRoleLabel } from '../utils/roles'
import {
  api,
  type DoctorAvailability,
  type DoctorAvailableSlot,
  type DoctorScheduleDay,
} from '../services/api'

type AppointmentsPageProps = {
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

const sidebarItems: SidebarItem[] = [
  { key: 'booking_appointments', label: 'Booking Appointments', icon: 'calendar' },
  { key: 'profile', label: 'Profile', icon: 'user' },
  { key: 'history', label: 'History', icon: 'report' },
]

const utilityItems: SidebarItem[] = [
  { key: 'notifications', label: 'Notifications', icon: 'alert' },
  { key: 'settings', label: 'Account Settings', icon: 'settings' },
]

const notificationPrefKey = 'pulse-ledger-notification-preferences'
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

const statusBadgeClass = (status: Reservation['status']) => {
  if (status === 'Recorded') return 'bg-emerald-100 text-emerald-700 border-emerald-300/70'
  if (status === 'Failed') return 'bg-rose-100 text-rose-700 border-rose-300/70'
  return 'bg-sky-100 text-sky-700 border-sky-300/70'
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
  `${workspaceFieldClass} ${shouldValidate && isMissing ? 'border-rose-500 focus:border-rose-500' : ''}`

const isUserSidebarSection = (key: string): key is UserSidebarSection =>
  USER_SIDEBAR_SECTIONS.includes(key as UserSidebarSection)

const AppointmentsPage = ({
  reservations,
  authUser,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onCreateReservation,
  onLogout,
}: AppointmentsPageProps) => {
  const [activeSection, setActiveSection] = useState<UserSidebarSection>(() => {
    if (typeof window === 'undefined') return 'booking_appointments'
    return resolveAppointmentsTabFromPath(window.location.pathname) ?? 'booking_appointments'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

  const updateListItem = (
    field: 'allergies' | 'medications' | 'chronicConditions' | 'surgeries',
    index: number,
    value: string
  ) => {
    setHealthForm((prev) => {
      const next = [...prev[field]]
      next[index] = value
      return { ...prev, [field]: next }
    })
  }

  const addListItem = (
    field: 'allergies' | 'medications' | 'chronicConditions' | 'surgeries'
  ) => {
    setHealthForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }))
  }

  const removeListItem = (
    field: 'allergies' | 'medications' | 'chronicConditions' | 'surgeries',
    index: number
  ) => {
    setHealthForm((prev) => {
      if (prev[field].length <= 1) return prev
      return { ...prev, [field]: prev[field].filter((_, itemIndex) => itemIndex !== index) }
    })
  }

  const sortedReservations = useMemo(
    () =>
      [...reservations].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [reservations]
  )

  const visibleReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sortedReservations

    return sortedReservations.filter((appointment) => {
      return (
        appointment.id.toLowerCase().includes(query) ||
        appointment.patientName.toLowerCase().includes(query) ||
        appointment.department.toLowerCase().includes(query) ||
        appointment.summary.toLowerCase().includes(query)
      )
    })
  }, [searchQuery, sortedReservations])

  const metrics = useMemo(() => {
    const source = sortedReservations
    const booked = source.filter((item) => item.status === 'Booked').length
    const recorded = source.filter((item) => item.status === 'Recorded').length
    const failed = source.filter((item) => item.status === 'Failed').length
    return { total: source.length, booked, recorded, failed }
  }, [sortedReservations])

  const activeBookedAppointment = useMemo(
    () => sortedReservations.find((item) => item.status === 'Booked') ?? null,
    [sortedReservations]
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
        disclaimer: 'Submitted via patient booking workspace.',
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
      <article className="reference-card p-5">
        <h2 className="reference-section-title">Patient Profile</h2>
        <p className="reference-widget-subtle mt-2">
          Complete this profile before booking appointments.
        </p>
        {!isProfileComplete ? (
          <p className="mt-3 text-sm font-semibold text-amber-600">
            Profile is incomplete. Booking is locked until all required fields are filled.
          </p>
        ) : null}
      </article>

      {isProfileLoading ? (
        <article className="reference-card p-5">
          <p className="text-sm text-[color:var(--agent-muted)]">Loading profile data...</p>
        </article>
      ) : (
        <>
          <article className="reference-card p-5">
            <h3 className="reference-section-title">Basic Information</h3>
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

          <article className="reference-card p-5">
            <h3 className="reference-section-title">Personal Health Information</h3>
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
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                  Allergies
                </p>
                <div className="space-y-2">
                  {healthForm.allergies.map((item, index) => (
                    <div key={`allergy-${index}`} className="flex gap-2">
                      <input
                        value={item}
                        onChange={(event) => updateListItem('allergies', index, event.target.value)}
                        placeholder={`Allergy ${index + 1}`}
                        className={workspaceFieldClass}
                      />
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        onClick={() => removeListItem('allergies', index)}
                        disabled={healthForm.allergies.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={`mt-2 ${workspaceGhostButtonClass}`}
                  onClick={() => addListItem('allergies')}
                >
                  Add allergy
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                  Medications
                </p>
                <div className="space-y-2">
                  {healthForm.medications.map((item, index) => (
                    <div key={`medication-${index}`} className="flex gap-2">
                      <input
                        value={item}
                        onChange={(event) => updateListItem('medications', index, event.target.value)}
                        placeholder={`Medication ${index + 1}`}
                        className={workspaceFieldClass}
                      />
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        onClick={() => removeListItem('medications', index)}
                        disabled={healthForm.medications.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={`mt-2 ${workspaceGhostButtonClass}`}
                  onClick={() => addListItem('medications')}
                >
                  Add medication
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                  Chronic Conditions
                </p>
                <div className="space-y-2">
                  {healthForm.chronicConditions.map((item, index) => (
                    <div key={`condition-${index}`} className="flex gap-2">
                      <input
                        value={item}
                        onChange={(event) =>
                          updateListItem('chronicConditions', index, event.target.value)
                        }
                        placeholder={`Condition ${index + 1}`}
                        className={workspaceFieldClass}
                      />
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        onClick={() => removeListItem('chronicConditions', index)}
                        disabled={healthForm.chronicConditions.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={`mt-2 ${workspaceGhostButtonClass}`}
                  onClick={() => addListItem('chronicConditions')}
                >
                  Add condition
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                  Surgeries
                </p>
                <div className="space-y-2">
                  {healthForm.surgeries.map((item, index) => (
                    <div key={`surgery-${index}`} className="flex gap-2">
                      <input
                        value={item}
                        onChange={(event) => updateListItem('surgeries', index, event.target.value)}
                        placeholder={`Surgery ${index + 1}`}
                        className={workspaceFieldClass}
                      />
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        onClick={() => removeListItem('surgeries', index)}
                        disabled={healthForm.surgeries.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={`mt-2 ${workspaceGhostButtonClass}`}
                  onClick={() => addListItem('surgeries')}
                >
                  Add surgery
                </button>
              </div>
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
                className={workspaceFieldClass}
              />
            </label>
          </article>

          <article className="reference-card p-5">
            <h3 className="reference-section-title">Emergency Contact</h3>
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
                className={workspacePrimaryButtonClass}
                onClick={() => void handleSavePatientProfile()}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? 'Saving...' : 'Save profile'}
              </button>
              <button
                type="button"
                className={workspaceGhostButtonClass}
                onClick={() => setSection('booking_appointments')}
              >
                Go to booking
              </button>
            </div>
          </article>
        </>
      )}
    </section>
  )

  const renderBookingAppointments = () => (
    <section className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
      <form
        className="reference-card p-5"
        onSubmit={(event) => {
          event.preventDefault()
          void submitBooking()
        }}
      >
        <h2 className="reference-section-title">New booking request</h2>
        <p className="reference-widget-subtle mt-2">
          Enter your preferred schedule and symptoms to submit an appointment request.
        </p>
        {!isProfileComplete ? (
          <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700">
            Complete your Profile tab first. Booking is locked until required profile details are saved.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
              Department
            </span>
            <select
              value={bookingDepartment}
              onChange={(event) =>
                setBookingDepartment(event.target.value as (typeof departmentOptions)[number])
              }
              className={workspaceFieldClass}
            >
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
              Doctor
            </span>
            <select
              value={selectedDoctorId}
              onChange={(event) => setSelectedDoctorId(event.target.value)}
              className={workspaceFieldClass}
              disabled={isLoadingDoctors || availableDoctors.length === 0}
            >
              <option value="">
                {isLoadingDoctors
                  ? 'Loading doctors...'
                  : availableDoctors.length > 0
                    ? 'Select a doctor'
                    : 'No available doctors'}
              </option>
              {availableDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {`${doctor.firstName} ${doctor.lastName}`.trim()}
                </option>
              ))}
            </select>
            {doctorLoadError ? <p className="text-xs font-semibold text-rose-600">{doctorLoadError}</p> : null}
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
              Priority
            </span>
            <select
              value={bookingPriority}
              onChange={(event) => setBookingPriority(event.target.value as Reservation['priority'])}
              className={workspaceFieldClass}
            >
              <option value="Low">Low</option>
              <option value="Routine">Routine</option>
              <option value="High">High</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
              Preferred Date
            </span>
            <input
              type="date"
              value={bookingDate}
              min={formatDateInput(new Date())}
              onChange={(event) => setBookingDate(event.target.value)}
              className={workspaceFieldClass}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
              Available Slot
            </span>
            <select
              value={selectedSlotStartIso}
              onChange={(event) => setSelectedSlotStartIso(event.target.value)}
              className={workspaceFieldClass}
              disabled={!selectedDoctorId || isLoadingSlots || availableSlots.length === 0}
            >
              <option value="">
                {!selectedDoctorId
                  ? 'Select a doctor first'
                  : isLoadingSlots
                    ? 'Loading slots...'
                    : availableSlots.length > 0
                      ? 'Select an available slot'
                      : 'No available slots'}
              </option>
              {availableSlots.map((slot) => (
                <option key={slot.startIso} value={slot.startIso}>
                  {slot.label} ({slot.session})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-2 space-y-1">
          <p className="text-xs text-[color:var(--agent-muted-soft)]">
            Day sessions: Morning {selectedDaySessions.morning ? 'open' : 'closed'} · Afternoon{' '}
            {selectedDaySessions.afternoon ? 'open' : 'closed'}
          </p>
          {slotStatusMessage ? (
            <p className="text-xs font-semibold text-[color:var(--agent-muted)]">{slotStatusMessage}</p>
          ) : null}
          {slotLoadError ? <p className="text-xs font-semibold text-rose-600">{slotLoadError}</p> : null}
        </div>

        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
            Symptoms
          </span>
          <textarea
            value={bookingSymptoms}
            onChange={(event) => setBookingSymptoms(event.target.value)}
            placeholder="Describe symptoms and how long you've experienced them."
            rows={4}
            className={workspaceFieldClass}
          />
        </label>

        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
            Additional Notes (optional)
          </span>
          <textarea
            value={bookingNote}
            onChange={(event) => setBookingNote(event.target.value)}
            placeholder="Add anything important for scheduling or care context."
            rows={3}
            className={workspaceFieldClass}
          />
        </label>

        {bookingError ? <p className="mt-3 text-sm font-semibold text-rose-600">{bookingError}</p> : null}
        {bookingMessage ? (
          <p className="mt-3 text-sm font-semibold text-emerald-600">{bookingMessage}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            className={workspacePrimaryButtonClass}
            disabled={isSubmittingBooking || !isProfileComplete}
          >
            {isSubmittingBooking ? 'Submitting...' : 'Submit booking appointment'}
          </button>
          {!isProfileComplete ? (
            <button
              type="button"
              className={workspaceGhostButtonClass}
              onClick={() => setSection('profile')}
            >
              Complete profile first
            </button>
          ) : null}
          <button
            type="button"
            className={workspaceGhostButtonClass}
            onClick={() => setSection('history')}
          >
            View booking history
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <article className="reference-card p-5">
          <h3 className="reference-section-title">Booking checklist</h3>
          <ul className="mt-3 space-y-2 text-sm text-[color:var(--agent-muted)]">
            <li>Complete Profile and Personal Health Information first.</li>
            <li>Choose a department, then select an available doctor.</li>
            <li>Pick a date, then choose one available 1-hour schedule slot.</li>
            <li>Describe symptoms clearly for faster triage.</li>
          </ul>
        </article>

        <article className="reference-card p-5">
          <h3 className="reference-section-title">Current active booking</h3>
          {activeBookedAppointment ? (
            <div className="mt-3 space-y-2 text-sm text-[color:var(--agent-muted)]">
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
            <p className="reference-widget-subtle mt-2">
              No active booking yet. Submit your first appointment request from this tab.
            </p>
          )}
        </article>
      </div>
    </section>
  )

  const renderHistoryList = () => {
    if (visibleReservations.length === 0) {
      return (
        <article className="reference-card p-5">
          <h2 className="reference-section-title">No history records found</h2>
          <p className="reference-widget-subtle mt-2">
            {searchQuery
              ? 'No records match this search. Clear or adjust your query.'
              : 'Create your first booking and track status from this page.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={workspacePrimaryButtonClass}
              onClick={() => setSection('booking_appointments')}
            >
              Open booking appointments
            </button>
            {searchQuery ? (
              <button
                type="button"
                className={workspaceGhostButtonClass}
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </button>
            ) : null}
          </div>
        </article>
      )
    }

    return (
      <section className="space-y-3">
        {visibleReservations.map((item) => (
          <article key={item.id} className="reference-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="mt-1 text-lg font-semibold text-[color:var(--agent-ink)]">
                  {dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName}
                </h3>
                <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                  {item.department} · {formatPhilippineDateTime(item.requestedTime)}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                {item.status}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">Symptoms</p>
                <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                  {item.symptoms || item.summary || 'No symptoms recorded.'}
                </p>
              </div>

              <div className="reference-card-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">E-Prescription</p>
                {item.prescriptions && item.prescriptions.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {item.prescriptions.map((prescription, index) => (
                      <p key={`${item.id}-rx-${index}`} className="text-sm text-[color:var(--agent-muted)]">
                        {prescription.medication} - {prescription.dosage}
                        {prescription.frequency ? ` · ${prescription.frequency}` : ''}
                        {prescription.durationDays ? ` · ${prescription.durationDays} day(s)` : ''}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--agent-muted)]">No e-prescriptions yet.</p>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    )
  }

  const renderNotificationsSection = () => (
    <section className="reference-card p-5">
      <h2 className="reference-section-title">Notifications</h2>
      <p className="reference-widget-subtle mt-2">
        Manage how booking alerts and workspace updates are delivered.
      </p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="reference-card-soft p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Delivery channels
          </p>
          <div className="mt-3 grid gap-2">
            {[
              { key: 'emailAlerts', label: 'Email alerts' },
              { key: 'browserAlerts', label: 'Browser alerts' },
            ].map((item) => {
              const prefKey = item.key as keyof NotificationPreferences
              const active = notificationPrefs[prefKey]
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setNotificationPrefs((prev) => ({ ...prev, [prefKey]: !prev[prefKey] }))}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)]'
                      : 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)] hover:border-[color:var(--agent-line)] hover:text-[color:var(--agent-ink)]'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="reference-card-soft p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Booking updates
          </p>
          <div className="mt-3 grid gap-2">
            {[
              { key: 'appointmentReminders', label: 'Appointment reminders' },
              { key: 'securityAlerts', label: 'Security alerts' },
            ].map((item) => {
              const prefKey = item.key as keyof NotificationPreferences
              const active = notificationPrefs[prefKey]
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setNotificationPrefs((prev) => ({ ...prev, [prefKey]: !prev[prefKey] }))}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)]'
                      : 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)] hover:border-[color:var(--agent-line)] hover:text-[color:var(--agent-ink)]'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="reference-card-soft p-4 xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Notification status
          </p>
          <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
            Current sync status: <span className="font-semibold text-[color:var(--agent-ink)]">{sessionStatus}</span>
          </p>
          <div className="mt-3">
            <button
              type="button"
              className={workspaceGhostButtonClass}
              onClick={() => setSection('history')}
            >
              View booking history
            </button>
          </div>
        </div>
      </div>
    </section>
  )

  const renderAccountSettingsSection = () => (
    <section className="reference-card p-5">
      <h2 className="reference-section-title">Account settings</h2>
      <p className="reference-widget-subtle mt-2">
        Manage your session controls, privacy preferences, and password.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="reference-card-soft p-4">
          <p className="text-sm text-[color:var(--agent-muted)]">
            Signed in as{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">
              {authUser?.username ?? 'Unknown'}
            </span>
          </p>
          <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
            Role:{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">
              {getWorkspaceRoleLabel(authUser?.role)} workspace
            </span>
          </p>
          <p className="mt-2 text-xs text-[color:var(--agent-muted-soft)]">Session: {sessionStatus}</p>
        </div>

        <div className="reference-card-soft p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Quick controls
          </p>
          <div className="mt-3 grid gap-2">
            <button type="button" className={workspaceGhostButtonClass} onClick={onToggleTheme}>
              Theme: {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>
        </div>

        <form
          className="reference-card-soft p-4 xl:col-span-2"
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
              className={workspaceFieldClass}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className={workspaceFieldClass}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              className={workspaceFieldClass}
            />
          </div>
          {passwordError ? <p className="mt-3 text-xs font-semibold text-rose-500">{passwordError}</p> : null}
          {passwordMessage ? (
            <p className="mt-3 text-xs font-semibold text-emerald-600">{passwordMessage}</p>
          ) : null}
          <button type="submit" className={`mt-4 ${workspacePrimaryButtonClass}`}>
            Update password
          </button>
        </form>
      </div>
    </section>
  )

  const profileName = resolvePatientDisplayName(authUser)
  const sectionTitleMap: Record<UserSidebarSection, string> = {
    booking_appointments: 'Booking Appointments',
    profile: 'Profile',
    history: 'History',
    notifications: 'Notifications',
    settings: 'Account Settings',
  }
  const sectionSearchPlaceholderMap: Record<UserSidebarSection, string> = {
    booking_appointments: 'Search booking history by id or department',
    profile: 'Search profile fields',
    history: 'Search booking history',
    notifications: 'Search notification preferences',
    settings: 'Search account settings',
  }

  return (
    <WorkspaceCanvas>
      <div className="w-full">
        <WorkspaceSidebarShell
          className={`workspace-shell--full-side${isSidebarCollapsed ? ' workspace-shell--rail-collapsed' : ''}`}
          contentClassName="px-4 pb-10 pt-5 sm:px-6 lg:px-8"
          mobileTitle="Patient workspace"
          stickyOffsetMode="auto"
          sidebar={
            <Sidebar
              variant="reference"
              mobileMode="drawer"
              fullRail
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
              brandTitle="AI Health Care"
              brandSubtitle="Patient workspace"
              sectionLabel="Main"
              items={sidebarItems}
              activeKey={activeSection}
              onSelect={(key) => {
                if (isUserSidebarSection(key)) {
                  setSection(key)
                }
              }}
              auxiliaryLabel="Utilities"
              secondaryItems={utilityItems}
              onSelectAuxiliary={(key) => {
                if (isUserSidebarSection(key)) {
                  setSection(key)
                }
              }}
              footerProfile={{
                name: profileName,
                subtitle: 'Patient workspace',
                onClick: () => setSection('settings'),
              }}
            />
          }
          content={
            <section className="reference-main reference-theme">
              {activeSection !== 'settings' ? (
                <DashboardTopBar
                  title={sectionTitleMap[activeSection]}
                  searchValue={searchQuery}
                  showSearch={activeSection === 'history'}
                  searchPlaceholder={sectionSearchPlaceholderMap[activeSection]}
                  onSearchChange={setSearchQuery}
                  profileName={profileName}
                  profileCaption={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                  messageCount={Math.min(metrics.total, 99)}
                  notificationCount={Math.min(metrics.failed + 1, 99)}
                  showMessages={false}
                  showNotifications
                  showProfile
                  showAccountMenu
                  onSignOut={() => setShowLogoutConfirm(true)}
                  borderlessActions
                />
              ) : null}

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
    </WorkspaceCanvas>
  )
}

export default AppointmentsPage
