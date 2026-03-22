import Appointments from "../Models/AppointmentsModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import DoctorSchedule from "../Models/DoctorScheduleModel.js";
import User from "../Models/UserModel.js";
import crypto from 'crypto';
import { blockchainService } from '../Utils/blockchainService.js';
import { DOCTOR_ROLE_ALIASES, isAdminRole, isDoctorRole, normalizeRole } from '../Utils/roles.js';
import {
    CLINIC_TIMEZONE,
    EMPTY_WEEK_DAYS,
    WEEK_DAY_SEQUENCE,
    parseDateKey,
    getWeekStartDateKey,
    getWeekStartDateKeyFromDateKey,
    getDayKeyFromDateKey,
    buildSlotsForDateByDaySessions,
    normalizeWeekDays,
    getWeekContextForDate,
} from '../Utils/schedulingService.js';

const ACTIVE_BOOKING_STATUSES = ['Pending', 'Confirmed']
const DOCTOR_ROLE_FILTER = { $in: DOCTOR_ROLE_ALIASES }

const getActorId = (req) => {
    const actorId = req.user?.id || req.user?._id
    return actorId ? String(actorId) : ''
}

const getActorRole = (req) => normalizeRole(req.user?.role) || 'user'

const logAppointmentAudit = async ({ action, userId, details, req }) => {
    try {
        await AuditLog.create({
            userId,
            action,
            details,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        })
    } catch (error) {
        console.warn('Failed to write appointment audit log', error)
    }
}

const formatDateKeyFromUtcDate = (value) => {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const weekStartDateFromKey = (weekStartDateKey) => new Date(`${weekStartDateKey}T00:00:00.000Z`)

const resolveWeekStartDateKey = (value) => {
    const asDateKey = parseDateKey(value)
    if (asDateKey) {
        return getWeekStartDateKeyFromDateKey(
            `${asDateKey.year}-${String(asDateKey.month).padStart(2, '0')}-${String(asDateKey.day).padStart(2, '0')}`
        )
    }

    const asDate = new Date(String(value || '').trim())
    if (Number.isNaN(asDate.getTime())) return null
    return getWeekStartDateKey(asDate)
}

const daySessionsToResponse = (daySessions = {}) => ({
    morning: Boolean(daySessions?.morning),
    afternoon: Boolean(daySessions?.afternoon),
})

const serializeSchedule = (schedule, fallback = {}) => {
    const weekStart = schedule?.weekStart
        ? formatDateKeyFromUtcDate(schedule.weekStart)
        : String(fallback.weekStart || '')
    const doctorId = String(schedule?.doctor || fallback.doctorId || '')
    const normalizedDays = normalizeWeekDays(schedule?.days || fallback.days || EMPTY_WEEK_DAYS)

    const hasEnabledSession = WEEK_DAY_SEQUENCE.some(
        (dayKey) => normalizedDays[dayKey]?.morning || normalizedDays[dayKey]?.afternoon
    )

    return {
        id: schedule?._id ? String(schedule._id) : undefined,
        doctorId,
        weekStart,
        timezone: schedule?.timezone || CLINIC_TIMEZONE,
        hasSchedule: Boolean(schedule),
        hasEnabledSession,
        days: WEEK_DAY_SEQUENCE.reduce((acc, dayKey) => {
            acc[dayKey] = daySessionsToResponse(normalizedDays[dayKey])
            return acc
        }, {}),
    }
}

const buildWeeklySlots = (schedulePayload) => {
    const weekStartParts = parseDateKey(schedulePayload.weekStart)
    if (!weekStartParts) return {}

    const weeklySlots = {}
    for (let index = 0; index < WEEK_DAY_SEQUENCE.length; index += 1) {
        const dayKey = WEEK_DAY_SEQUENCE[index]
        const date = new Date(
            Date.UTC(weekStartParts.year, weekStartParts.month - 1, weekStartParts.day + index)
        )
        const dateKey = formatDateKeyFromUtcDate(date)
        weeklySlots[dayKey] = buildSlotsForDateByDaySessions(dateKey, schedulePayload.days[dayKey]).map((slot) => ({
            startIso: slot.startIso,
            endIso: slot.endIso,
            label: slot.label,
            session: slot.session,
        }))
    }

    return weeklySlots
}

export async function createAppointment(req, res) {
    try {
        let { doctorId, scheduledDate, department, reason, note } = req.body;
        const patientId = req.user.id;
        const requestedDepartment = String(department || '').trim()
        const normalizedDepartment = requestedDepartment === 'General Medicine'
            ? 'Internal Medicine'
            : requestedDepartment

        const patient = await User.findById(patientId).select('email profile personalHealthInfo');
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found." });
        }

        const profile = patient.profile || {};
        const health = patient.personalHealthInfo || {};

        const isProfileComplete = Boolean(
            profile.dateOfBirth &&
            String(profile.phoneNumber || '').trim() &&
            String(profile.address || '').trim() &&
            String(profile.gender || '').trim()
        );

        const isHealthInfoComplete = Boolean(
            String(health.bloodType || '').trim() &&
            health.emergencyContact &&
            String(health.emergencyContact.name || '').trim() &&
            String(health.emergencyContact.phone || '').trim() &&
            String(health.emergencyContact.relationship || '').trim()
        );

        if (!isProfileComplete || !isHealthInfoComplete) {
            return res.status(400).json({
                message: "Complete your profile and personal health information before booking an appointment."
            });
        }

        const appointmentDate = scheduledDate instanceof Date ? scheduledDate : new Date(scheduledDate)
        if (Number.isNaN(appointmentDate.getTime())) {
            return res.status(400).json({ message: "Invalid appointment date." });
        }

        if (appointmentDate < Date.now()) {
            return res.status(400).json({ message: "Appointment date must be in the future." });
        }

        //Check for Existing Pending/Confirmed Appointments
        const existingAppointment = await Appointments.findOne({
            patient: patientId,
            status: { $in: ACTIVE_BOOKING_STATUSES }
        });

        if (existingAppointment) {
            return res.status(400).json({ 
                message: "You already have an active appointment. Please complete or cancel it first." 
            });
        }

        //Prevent Self-Booking
        if (doctorId && patientId === doctorId) {
            return res.status(400).json({ message: "You cannot book an appointment with yourself." });
        }

        if (!doctorId) {
            return res.status(400).json({ message: "Please select a doctor for this appointment." });
        }
        if (!normalizedDepartment) {
            return res.status(400).json({ message: "Department is required." });
        }

        const doctor = await User.findOne({
            _id: doctorId,
            role: DOCTOR_ROLE_FILTER,
            status: 'active',
            department: normalizedDepartment,
        }).select('_id email department');
        if (!doctor) {
            return res.status(400).json({ message: "Selected doctor is invalid, unavailable, or not in the selected department." });
        }

        const weekContext = getWeekContextForDate(appointmentDate)
        if (!weekContext?.weekStartDateKey || !weekContext?.dayKey) {
            return res.status(400).json({ message: 'Unable to resolve clinic schedule context for this appointment.' })
        }

        if (weekContext.second !== 0 || weekContext.millisecond !== 0) {
            return res.status(400).json({
                message: 'Appointments must start exactly at a scheduled slot time.',
            })
        }

        if (!weekContext.sessionName) {
            return res.status(400).json({
                message: 'Select a valid 1-hour slot. Morning: 8:00, 9:00, 10:00, 11:00. Afternoon: 1:30, 2:30, 3:30 PM.',
            })
        }

        const weekStartDate = weekStartDateFromKey(weekContext.weekStartDateKey)
        const doctorSchedule = await DoctorSchedule.findOne({
            doctor: doctorId,
            weekStart: weekStartDate,
        }).select('days')

        if (!doctorSchedule) {
            return res.status(400).json({
                message: `No schedule is published for this doctor on week starting ${weekContext.weekStartDateKey}.`,
            })
        }

        const normalizedDays = normalizeWeekDays(doctorSchedule.days)
        const daySchedule = normalizedDays[weekContext.dayKey]
        if (!daySchedule?.[weekContext.sessionName]) {
            return res.status(400).json({
                message: `Doctor is not available on ${weekContext.dayKey} ${weekContext.sessionName} session.`,
            })
        }

        const validSlots = buildSlotsForDateByDaySessions(weekContext.clinicDateKey, daySchedule)
        const isValidSlot = validSlots.some((slot) => slot.startAt.getTime() === appointmentDate.getTime())
        if (!isValidSlot) {
            return res.status(400).json({
                message: 'Selected time is outside the doctor schedule or not a valid 1-hour slot.',
            })
        }

        const conflictingAppointment = await Appointments.findOne({
            doctor: doctorId,
            scheduledDate: appointmentDate,
            status: { $in: ACTIVE_BOOKING_STATUSES },
        }).select('_id')
        if (conflictingAppointment) {
            return res.status(409).json({
                message: 'Selected slot is already booked for this doctor.',
            })
        }

        const appointment = new Appointments({
            doctor: doctorId,
            patient: patientId,
            scheduledDate: appointmentDate,
            department: normalizedDepartment,
            reason: reason || note || 'General consultation',
        });

        await appointment.save();

        //LOG TO BLOCKCHAIN
        blockchainService.logAppointmentToChain(appointment._id, patientId, doctorId)
            .then(async (hash) => {
                if (hash) {
                    appointment.blockchainTxHash = hash;
                    await appointment.save();
                }
            });

        await logAppointmentAudit({
            action: "CREATED_APPOINTMENT",
            userId: patientId,
            details: `User ${patient.email} created appointment ${appointment._id} with Doctor ${doctorId} on ${appointment.scheduledDate.toISOString()} (${normalizedDepartment}).`,
            req,
        })

        return res.status(201).json({ message: "Appointment created successfully.", appointment });

    } catch (error) {
        if (
            error?.code === 11000 &&
            error?.keyPattern?.doctor === 1 &&
            error?.keyPattern?.scheduledDate === 1
        ) {
            return res.status(409).json({
                message: 'Selected slot is already booked for this doctor.',
            })
        }
        console.error("Failed to create appointment:", error);
        return res.status(500).json({ message: "Failed to create appointment." });
    }
}

export async function getDoctorWeeklySchedule(req, res) {
    try {
        const actorId = getActorId(req)
        const actorRole = getActorRole(req)
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        const requestedDoctorId = String(req.query?.doctorId || '').trim()
        const doctorId = isAdminRole(actorRole) ? requestedDoctorId : actorId

        if (!doctorId) {
            return res.status(400).json({ message: 'doctorId is required for this role.' })
        }

        const weekStartDateKey = resolveWeekStartDateKey(req.params?.weekStart)
        if (!weekStartDateKey) {
            return res.status(400).json({ message: 'Invalid weekStart value. Use YYYY-MM-DD.' })
        }

        const doctor = await User.findOne({ _id: doctorId, role: DOCTOR_ROLE_FILTER }).select('_id status')
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found.' })
        }

        const schedule = await DoctorSchedule.findOne({
            doctor: doctorId,
            weekStart: weekStartDateFromKey(weekStartDateKey),
        })

        const payload = serializeSchedule(schedule, { doctorId, weekStart: weekStartDateKey })
        return res.json({
            schedule: payload,
            weeklySlots: buildWeeklySlots(payload),
        })
    } catch (error) {
        console.error('Failed to load doctor weekly schedule', error)
        return res.status(500).json({ message: 'Failed to load doctor weekly schedule.' })
    }
}

export async function upsertDoctorWeeklySchedule(req, res) {
    try {
        const actorId = getActorId(req)
        const actorRole = getActorRole(req)
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        const requestedDoctorId = String(req.body?.doctorId || '').trim()
        const doctorId = isAdminRole(actorRole) ? requestedDoctorId : actorId

        if (!doctorId) {
            return res.status(400).json({ message: 'doctorId is required.' })
        }

        if (isDoctorRole(actorRole) && requestedDoctorId && requestedDoctorId !== actorId) {
            return res.status(403).json({ message: 'Doctors can only modify their own schedules.' })
        }

        const weekStartDateKey = resolveWeekStartDateKey(req.params?.weekStart)
        if (!weekStartDateKey) {
            return res.status(400).json({ message: 'Invalid weekStart value. Use YYYY-MM-DD.' })
        }

        const doctor = await User.findOne({ _id: doctorId, role: DOCTOR_ROLE_FILTER }).select('_id email status')
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found.' })
        }

        const normalizedDays = normalizeWeekDays(req.body?.days || {})
        const schedule = await DoctorSchedule.findOneAndUpdate(
            {
                doctor: doctorId,
                weekStart: weekStartDateFromKey(weekStartDateKey),
            },
            {
                $set: {
                    timezone: CLINIC_TIMEZONE,
                    days: normalizedDays,
                },
            },
            {
                returnDocument: 'after',
                upsert: true,
                setDefaultsOnInsert: true,
            }
        )

        await AuditLog.create({
            action: 'UPDATED_DOCTOR_WEEKLY_SCHEDULE',
            userId: actorId,
            details: `Doctor ${doctor.email} weekly schedule updated for week ${weekStartDateKey}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        })

        const payload = serializeSchedule(schedule)
        return res.json({
            message: 'Doctor weekly schedule saved.',
            schedule: payload,
            weeklySlots: buildWeeklySlots(payload),
        })
    } catch (error) {
        console.error('Failed to save doctor weekly schedule', error)
        return res.status(500).json({ message: 'Failed to save doctor weekly schedule.' })
    }
}

export async function getDoctorAvailableSlots(req, res) {
    try {
        const doctorId = String(req.params?.doctorId || '').trim()
        if (!doctorId) {
            return res.status(400).json({ message: 'doctorId is required.' })
        }

        const dateKeyRaw = String(req.query?.date || '').trim()
        const dateParts = parseDateKey(dateKeyRaw)
        if (!dateParts) {
            return res.status(400).json({ message: 'date query is required in YYYY-MM-DD format.' })
        }

        const dateKey = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`
        const dayKey = getDayKeyFromDateKey(dateKey)
        const weekStartDateKey = getWeekStartDateKeyFromDateKey(dateKey)
        if (!dayKey || !weekStartDateKey) {
            return res.status(400).json({ message: 'Unable to resolve schedule week/day for this date.' })
        }

        const doctor = await User.findOne({
            _id: doctorId,
            role: DOCTOR_ROLE_FILTER,
            status: 'active',
        }).select('_id')
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found or inactive.' })
        }

        const schedule = await DoctorSchedule.findOne({
            doctor: doctorId,
            weekStart: weekStartDateFromKey(weekStartDateKey),
        }).select('days')

        if (!schedule) {
            return res.json({
                doctorId,
                date: dateKey,
                weekStart: weekStartDateKey,
                dayKey,
                timezone: CLINIC_TIMEZONE,
                hasWeekSchedule: false,
                daySessions: daySessionsToResponse(),
                slots: [],
                availableCount: 0,
            })
        }

        const normalizedDays = normalizeWeekDays(schedule.days)
        const daySessions = daySessionsToResponse(normalizedDays[dayKey])
        const daySlots = buildSlotsForDateByDaySessions(dateKey, daySessions)
        if (daySlots.length === 0) {
            return res.json({
                doctorId,
                date: dateKey,
                weekStart: weekStartDateKey,
                dayKey,
                timezone: CLINIC_TIMEZONE,
                hasWeekSchedule: true,
                daySessions,
                slots: [],
                availableCount: 0,
            })
        }

        const activeAppointments = await Appointments.find({
            doctor: doctorId,
            status: { $in: ACTIVE_BOOKING_STATUSES },
            scheduledDate: { $in: daySlots.map((slot) => slot.startAt) },
        }).select('scheduledDate')

        const bookedSet = new Set(
            activeAppointments.map((appointment) => new Date(appointment.scheduledDate).toISOString())
        )
        const nowMs = Date.now()
        const slots = daySlots.map((slot) => {
            const isBooked = bookedSet.has(slot.startIso)
            const isPast = slot.startAt.getTime() <= nowMs
            return {
                startIso: slot.startIso,
                endIso: slot.endIso,
                label: slot.label,
                session: slot.session,
                isBooked,
                isPast,
                isAvailable: !isBooked && !isPast,
            }
        })

        return res.json({
            doctorId,
            date: dateKey,
            weekStart: weekStartDateKey,
            dayKey,
            timezone: CLINIC_TIMEZONE,
            hasWeekSchedule: true,
            daySessions,
            slots,
            availableCount: slots.filter((slot) => slot.isAvailable).length,
        })
    } catch (error) {
        console.error('Failed to load doctor available slots', error)
        return res.status(500).json({ message: 'Failed to load doctor available slots.' })
    }
}

export async function getAvailableDoctorsByDepartment(req, res) {
    try {
        const departmentInput = String(req.query?.department || '').trim()
        if (!departmentInput) {
            return res.status(400).json({ message: 'department query is required.' })
        }
        // Backward-compat for older frontend label.
        const department = departmentInput === 'General Medicine' ? 'Internal Medicine' : departmentInput

        const doctors = await User.find({
            role: DOCTOR_ROLE_FILTER,
            status: 'active',
            department,
        }).select('_id firstName lastName email department')

        return res.json({
            doctors: doctors.map((doctor) => ({
                id: String(doctor._id),
                firstName: doctor.firstName,
                lastName: doctor.lastName,
                email: doctor.email,
                department: doctor.department,
            })),
        })
    } catch (error) {
        console.error('Failed to load available doctors by department', error)
        return res.status(500).json({ message: 'Failed to load available doctors.' })
    }
}

export async function getAppointments(req, res) {
    try {
        const userId = getActorId(req)
        if (!userId) return res.status(401).json({ message: 'Invalid session' })

        const actor = await User.findById(userId).select('role')
        const role = normalizeRole(actor?.role || req.user?.role) || 'user'

        const query =
            isDoctorRole(role) ? { doctor: userId } :
            isAdminRole(role) ? {} :
            { patient: userId }

        const appointments = await Appointments.find(query)
            .populate('patient', 'email firstName lastName')
            .populate('doctor', 'email firstName lastName')
            .sort({ scheduledDate: -1 })

        const mapped = appointments.map((a) => ({
            id: a._id,
            patientId: a.patient?._id ? String(a.patient._id) : undefined,
            patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : undefined,
            doctorId: a.doctor?._id ? String(a.doctor._id) : undefined,
            doctorName: a.doctor ? `${a.doctor.firstName} ${a.doctor.lastName}` : undefined,
            requestedTime: a.scheduledDate,
            createdAt: a._id.getTimestamp ? a._id.getTimestamp() : undefined,
            status: a.status,
            department: a.department,
            summary: a.reason,
            symptoms: a.reason,
            reason: a.reason,
            soapNote: a.soapNote ? {
                subjective: a.soapNote.subjective || '',
                objective: a.soapNote.objective || '',
                assessment: a.soapNote.assessment || '',
                plan: a.soapNote.plan || '',
                updatedAt: a.soapNote.updatedAt || null,
            } : undefined,
            prescriptions: Array.isArray(a.prescriptions)
                ? a.prescriptions.map((entry) => ({
                    medication: entry.medication,
                    dosage: entry.dosage,
                    frequency: entry.frequency || '',
                    durationDays: entry.durationDays || null,
                    instructions: entry.instructions || '',
                    createdAt: entry.createdAt || null,
                }))
                : [],
        }))

        return res.json({ appointments: mapped })
    } catch (error) {
        console.error('Failed to fetch appointments', error)
        return res.status(500).json({ message: 'Failed to fetch appointments' })
    }
}

const APPOINTMENT_STATUS = ['Pending', 'Confirmed', 'Completed', 'Cancelled']
const DOCTOR_ALLOWED_TRANSITIONS = {
    Pending: ['Confirmed', 'Cancelled'],
    Confirmed: ['Completed', 'Cancelled'],
    Completed: [],
    Cancelled: []
}

export async function updateAppointmentStatus(req, res) {
    try {
        const userId = getActorId(req)
        const role = getActorRole(req)
        const { appointmentId } = req.params
        const { status } = req.body

        if (!APPOINTMENT_STATUS.includes(status)) {
            return res.status(400).json({ message: 'Invalid appointment status.' })
        }

        const appointment = await Appointments.findById(appointmentId)
            .populate('patient', 'email firstName lastName')
            .populate('doctor', 'email firstName lastName')

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found.' })
        }

        if (isDoctorRole(role) && String(appointment.doctor?._id || appointment.doctor) !== String(userId)) {
            return res.status(403).json({ message: 'You can only update your own appointments.' })
        }
        if (!isDoctorRole(role) && !isAdminRole(role)) {
            return res.status(403).json({ message: 'You are not allowed to update appointment status.' })
        }
        if (isDoctorRole(role) && !DOCTOR_ALLOWED_TRANSITIONS[appointment.status]?.includes(status)) {
            return res.status(400).json({ message: `Invalid status transition: ${appointment.status} -> ${status}` })
        }

        const previousStatus = appointment.status
        appointment.status = status
        await appointment.save()

        //Sync to Blockchain
        blockchainService.updateStatusOnChain(appointment._id, status);

        await logAppointmentAudit({
            action: 'UPDATED_APPOINTMENT_STATUS',
            userId,
            details: `Appointment ${appointment._id}: ${previousStatus} -> ${status}`,
            req,
        })

        return res.status(200).json({
            message: 'Appointment status updated.',
            appointment: {
                id: appointment._id,
                status: appointment.status,
                previousStatus,
                patientName: appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : undefined,
                doctorName: appointment.doctor ? `${appointment.doctor.firstName} ${appointment.doctor.lastName}` : undefined,
            }
        })
    } catch (error) {
        console.error('Failed to update appointment status', error)
        return res.status(500).json({ message: 'Failed to update appointment status.' })
    }
}

// Doctor dashboard functions (overview, queue timeline, status toggles, SOAP notes, and e-prescriptions).
const DOCTOR_QUEUE_STATUS = ['Waiting', 'Arrived', 'In-Consultation', 'Checked-Out', 'No-Show']
const FREQUENT_MEDICATIONS = [
    'Paracetamol',
    'Ibuprofen',
    'Amoxicillin',
    'Metformin',
    'Amlodipine',
    'Losartan',
    'Atorvastatin',
    'Omeprazole',
    'Cetirizine',
    'Salbutamol',
]

const normalizeDoctorQueueStatus = (appointment) => {
    const queueStatus = String(appointment?.queueStatus || '').trim()
    if (DOCTOR_QUEUE_STATUS.includes(queueStatus)) return queueStatus
    if (appointment?.status === 'Completed') return 'Checked-Out'
    if (appointment?.status === 'Cancelled') return 'No-Show'
    if (appointment?.status === 'Confirmed') return 'Arrived'
    return 'Waiting'
}

const inferTriageLevel = (appointment) => {
    const fromField = String(appointment?.triageLevel || '').trim()
    if (fromField === 'High' || fromField === 'Routine' || fromField === 'Low') return fromField

    const text = String(appointment?.chiefComplaint || appointment?.reason || '').toLowerCase()
    if (
        text.includes('chest pain') ||
        text.includes('shortness of breath') ||
        text.includes('stroke') ||
        text.includes('bleeding') ||
        text.includes('severe')
    ) {
        return 'High'
    }
    if (text.includes('follow-up') || text.includes('routine')) return 'Routine'
    return 'Routine'
}

const startOfDay = (date = new Date()) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

const endOfDay = (date = new Date()) => {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d
}

export async function getDoctorDashboardOverview(req, res) {
    try {
        const actorId = getActorId(req)
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        const actorRole = getActorRole(req)
        const requestedDoctorId = String(req.query?.doctorId || '').trim()
        if (isAdminRole(actorRole) && !requestedDoctorId) {
            return res.status(400).json({ message: 'doctorId is required for this role.' })
        }

        const doctorId = isAdminRole(actorRole) ? requestedDoctorId : actorId

        const now = new Date()
        const dayStart = startOfDay(now)
        const dayEnd = endOfDay(now)

        const todaysAppointments = await Appointments.find({
            doctor: doctorId,
            scheduledDate: { $gte: dayStart, $lte: dayEnd },
        })
            .populate('patient', 'firstName lastName email')
            .sort({ scheduledDate: 1 })

        const counter = {
            total: todaysAppointments.length,
            completed: 0,
            pending: 0,
            noShows: 0,
        }

        for (const appointment of todaysAppointments) {
            const queueStatus = normalizeDoctorQueueStatus(appointment)
            if (appointment.status === 'Completed' || queueStatus === 'Checked-Out') counter.completed += 1
            else if (appointment.status === 'Cancelled' || queueStatus === 'No-Show') counter.noShows += 1
            else counter.pending += 1
        }

        const nextPatientRecord = todaysAppointments.find((appointment) => {
            const queueStatus = normalizeDoctorQueueStatus(appointment)
            return appointment.scheduledDate >= now && !['Checked-Out', 'No-Show'].includes(queueStatus)
        })

        const nextPatient = nextPatientRecord
            ? {
                appointmentId: String(nextPatientRecord._id),
                patientId: String(nextPatientRecord.patient?._id || ''),
                patientName: nextPatientRecord.patient
                    ? `${nextPatientRecord.patient.firstName || ''} ${nextPatientRecord.patient.lastName || ''}`.trim() || 'Patient'
                    : 'Patient',
                chiefComplaint: String(nextPatientRecord.chiefComplaint || nextPatientRecord.reason || 'General consultation'),
                scheduledDate: nextPatientRecord.scheduledDate,
                countdownSeconds: Math.max(
                    0,
                    Math.floor((new Date(nextPatientRecord.scheduledDate).getTime() - Date.now()) / 1000)
                ),
            }
            : null

        const urgencyFlags = todaysAppointments
            .map((appointment) => {
                const triageLevel = inferTriageLevel(appointment)
                const urgentFollowUp = Boolean(appointment.urgentFollowUp)
                if (triageLevel !== 'High' && !urgentFollowUp) return null

                return {
                    appointmentId: String(appointment._id),
                    patientId: String(appointment.patient?._id || ''),
                    patientName: appointment.patient
                        ? `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim() || 'Patient'
                        : 'Patient',
                    triageLevel,
                    urgentFollowUp,
                    queueStatus: normalizeDoctorQueueStatus(appointment),
                }
            })
            .filter(Boolean)

        return res.json({
            counter,
            nextPatient,
            urgencyFlags,
            generatedAt: new Date().toISOString(),
        })
    } catch (error) {
        console.error('Failed to build doctor dashboard overview', error)
        return res.status(500).json({ message: 'Failed to load doctor dashboard overview.' })
    }
}

export async function getDoctorQueueTimeline(req, res) {
    try {
        const actorId = getActorId(req)
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        const actorRole = getActorRole(req)
        const requestedDoctorId = String(req.query?.doctorId || '').trim()
        if (isAdminRole(actorRole) && !requestedDoctorId) {
            return res.status(400).json({ message: 'doctorId is required for this role.' })
        }

        const doctorId = isAdminRole(actorRole) ? requestedDoctorId : actorId

        const now = new Date()
        const dayStart = startOfDay(now)
        const dayEnd = endOfDay(now)

        const todaysAppointments = await Appointments.find({
            doctor: doctorId,
            scheduledDate: { $gte: dayStart, $lte: dayEnd },
        })
            .populate('patient', 'firstName lastName')
            .sort({ scheduledDate: 1 })

        const timeline = await Promise.all(
            todaysAppointments.map(async (appointment) => {
                const patientId = appointment.patient?._id || appointment.patient
                const history = await Appointments.find({
                    patient: patientId,
                    _id: { $ne: appointment._id },
                })
                    .sort({ scheduledDate: -1 })
                    .limit(3)
                    .select('scheduledDate reason department')

                return {
                    appointmentId: String(appointment._id),
                    patientId: String(patientId || ''),
                    patientName: appointment.patient
                        ? `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim() || 'Patient'
                        : 'Patient',
                    scheduledDate: appointment.scheduledDate,
                    department: String(appointment.department || 'General Medicine'),
                    chiefComplaint: String(appointment.chiefComplaint || appointment.reason || 'General consultation'),
                    triageLevel: inferTriageLevel(appointment),
                    urgentFollowUp: Boolean(appointment.urgentFollowUp),
                    queueStatus: normalizeDoctorQueueStatus(appointment),
                    checkupHistory: history.map((item) => ({
                        visitDate: item.scheduledDate,
                        primaryDiagnosis: String(item.reason || item.department || 'General consultation'),
                    })),
                }
            })
        )

        return res.json({ timeline })
    } catch (error) {
        console.error('Failed to load doctor queue timeline', error)
        return res.status(500).json({ message: 'Failed to load doctor queue timeline.' })
    }
}

export async function updateDoctorQueueStatus(req, res) {
    try {
        const actorId = getActorId(req)
        const actorRole = getActorRole(req)
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        const { appointmentId } = req.params
        const { queueStatus } = req.body

        if (!DOCTOR_QUEUE_STATUS.includes(queueStatus)) {
            return res.status(400).json({ message: 'Invalid queue status.' })
        }

        const appointment = await Appointments.findOne(
            isAdminRole(actorRole)
                ? { _id: appointmentId }
                : { _id: appointmentId, doctor: actorId }
        )
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found.' })
        }

        const previousStatus = appointment.status
        appointment.queueStatus = queueStatus
        if (queueStatus === 'Checked-Out') appointment.status = 'Completed'
        if (queueStatus === 'No-Show') appointment.status = 'Cancelled'
        if (queueStatus === 'Arrived' && appointment.status === 'Pending') appointment.status = 'Confirmed'
        await appointment.save()

        // Keep blockchain status in sync when queue updates drive status transitions.
        if (appointment.status !== previousStatus) {
            blockchainService.updateStatusOnChain(appointment._id, appointment.status)
                .catch((err) => console.error('Blockchain sync failed for queue status update:', err))
        }

        await AuditLog.create({
            userId: actorId,
            action: 'UPDATED_DOCTOR_QUEUE_STATUS',
            details: `Appointment ${appointment._id} queue status -> ${queueStatus}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        })

        return res.json({
            message: 'Queue status updated.',
            appointment: {
                id: String(appointment._id),
                queueStatus: appointment.queueStatus,
                status: appointment.status,
            },
        })
    } catch (error) {
        console.error('Failed to update doctor queue status', error)
        return res.status(500).json({ message: 'Failed to update queue status.' })
    }
}

export async function saveAppointmentSoapNote(req, res) {
    try {
        const actorId = getActorId(req)
        const actorRole = getActorRole(req)
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        const { appointmentId } = req.params
        const { subjective, objective, assessment, plan } = req.body || {}

        const appointment = await Appointments.findOne(
            isAdminRole(actorRole)
                ? { _id: appointmentId }
                : { _id: appointmentId, doctor: actorId }
        )
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found.' })
        }

        // 1. Build the SOAP Note object
        const soapData = {
            subjective: String(subjective || ''),
            objective: String(objective || ''),
            assessment: String(assessment || ''),
            plan: String(plan || ''),
        }

        // 2. Generate an Immutable SHA-256 Hash of the medical content
        const dataString = JSON.stringify(soapData);
        const soapHash = crypto.createHash('sha256').update(dataString).digest('hex');

        // 3. Update the MongoDB document
        appointment.soapNote = {
            ...soapData,
            updatedBy: actorId,
            updatedAt: new Date(),
        }
        appointment.soapNoteHashRecord = soapHash; // Ensure this field exists in your Mongoose Schema!
        
        await appointment.save()

        // 4. [BLOCKCHAIN] Send hash to the ledger asynchronously (fire-and-forget)
        blockchainService.updateSoapNoteOnChain(appointment._id.toString(), soapHash)
            .catch(err => console.error('Blockchain sync failed for SOAP note:', err));

        await AuditLog.create({
            userId: actorId,
            action: 'SAVED_APPOINTMENT_SOAP_NOTE',
            details: `Appointment ${appointment._id} SOAP note updated. Blockchain Hash: ${soapHash.substring(0,8)}...`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        })

        return res.json({
            message: 'SOAP note saved securely.',
            soapNote: appointment.soapNote,
            blockchainHash: soapHash
        })
    } catch (error) {
        console.error('Failed to save SOAP note', error)
        return res.status(500).json({ message: 'Failed to save SOAP note.' })
    }
}


export async function saveAppointmentPrescriptions(req, res) {
    try {
        const actorId = getActorId(req)
        const actorRole = getActorRole(req)
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        const { appointmentId } = req.params
        const prescriptions = Array.isArray(req.body?.prescriptions) ? req.body.prescriptions : []

        const appointment = await Appointments.findOne(
            isAdminRole(actorRole)
                ? { _id: appointmentId }
                : { _id: appointmentId, doctor: actorId }
        )
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found.' })
        }

        const normalized = prescriptions
            .map((item) => ({
                medication: String(item?.medication || '').trim(),
                dosage: String(item?.dosage || '').trim(),
                frequency: String(item?.frequency || '').trim(),
                durationDays: Number(item?.durationDays) || undefined,
                instructions: String(item?.instructions || '').trim(),
            }))
            .filter((item) => item.medication && item.dosage)

        if (normalized.length === 0) {
            return res.status(400).json({ message: 'At least one valid prescription is required.' })
        }

        // 1. Generate SHA-256 Hash of the exact prescription instructions
        const dataString = JSON.stringify(normalized);
        const prescriptionsHash = crypto.createHash('sha256').update(dataString).digest('hex');

        // 2. Add metadata (dates, doctorId) AFTER hashing to preserve clean content hashing
        const dbPrescriptions = normalized.map(item => ({
            ...item,
            prescribedBy: actorId,
            createdAt: new Date()
        }))

        // 3. Update the MongoDB document
        appointment.prescriptions = dbPrescriptions
        appointment.prescriptionsHashRecord = prescriptionsHash; // Ensure this field exists in Schema!
        await appointment.save()

        // 4. [BLOCKCHAIN] Send hash to the ledger asynchronously
        blockchainService.updatePrescriptionsOnChain(appointment._id.toString(), prescriptionsHash)
            .catch(err => console.error('Blockchain sync failed for prescriptions:', err));

        await AuditLog.create({
            userId: actorId,
            action: 'SAVED_APPOINTMENT_PRESCRIPTIONS',
            details: `Appointment ${appointment._id} prescriptions updated (${normalized.length}). Blockchain Hash: ${prescriptionsHash.substring(0,8)}...`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        })

        return res.json({ 
            message: 'Prescriptions saved securely.', 
            prescriptions: appointment.prescriptions,
            blockchainHash: prescriptionsHash
        })
    } catch (error) {
        console.error('Failed to save prescriptions', error)
        return res.status(500).json({ message: 'Failed to save prescriptions.' })
    }
}

export async function getMedicationSearch(req, res) {
    try {
        const query = String(req.query?.q || '').trim().toLowerCase()
        const matches = FREQUENT_MEDICATIONS
            .filter((name) => !query || name.toLowerCase().includes(query))
            .slice(0, 20)
            .map((name) => ({ name }))

        return res.json({ medications: matches })
    } catch (error) {
        console.error('Failed medication search', error)
        return res.status(500).json({ message: 'Failed to search medications.' })
    }
}

export async function getFrequentPrescriptions(req, res) {
    try {
        const actorId = getActorId(req)
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        const actorRole = getActorRole(req)
        const requestedDoctorId = String(req.query?.doctorId || '').trim()
        if (isAdminRole(actorRole) && !requestedDoctorId) {
            return res.status(400).json({ message: 'doctorId is required for this role.' })
        }

        const doctorId = isAdminRole(actorRole) ? requestedDoctorId : actorId

        const appointments = await Appointments.find({ doctor: doctorId }).select('prescriptions')
        const counter = new Map()

        for (const appointment of appointments) {
            const prescriptions = Array.isArray(appointment.prescriptions) ? appointment.prescriptions : []
            for (const entry of prescriptions) {
                const name = String(entry?.medication || '').trim()
                if (!name) continue
                counter.set(name, (counter.get(name) || 0) + 1)
            }
        }

        const frequent = Array.from(counter.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([medication, count]) => ({ medication, count }))

        if (frequent.length === 0) {
            return res.json({
                frequentPrescriptions: FREQUENT_MEDICATIONS.slice(0, 5).map((medication) => ({ medication, count: 0 })),
            })
        }

        return res.json({ frequentPrescriptions: frequent })
    } catch (error) {
        console.error('Failed to load frequent prescriptions', error)
        return res.status(500).json({ message: 'Failed to load frequent prescriptions.' })
    }
}
