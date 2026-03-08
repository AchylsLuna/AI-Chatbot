import Appointments from "../Models/AppointmentsModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import User from "../Models/UserModel.js";
import crypto from 'crypto';
import { blockchainService } from '../Utils/blockchainService.js';

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

        if (new Date(scheduledDate) < Date.now()) {
            return res.status(400).json({ message: "Appointment date must be in the future." });
        }

        //Check for Existing Pending/Confirmed Appointments
        const existingAppointment = await Appointments.findOne({
            patient: patientId,
            status: { $in: ["Pending", "Confirmed"] }
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
            role: 'doctor',
            status: 'active',
            department: normalizedDepartment,
        }).select('_id email department');
        if (!doctor) {
            return res.status(400).json({ message: "Selected doctor is invalid, unavailable, or not in the selected department." });
        }


        const appointment = new Appointments({
            doctor: doctorId,
            patient: patientId,
            scheduledDate,
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

        //Audit Log
        await AuditLog.create({
            action: "CREATED_APPOINTMENT",
            userId: patientId,
            details: `User ${patient.email} created appointment with Doctor ${doctorId || 'TBD'} on ${scheduledDate}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(201).json({ message: "Appointment created successfully.", appointment });

    } catch (error) {
        console.error("Failed to create appointment:", error);
        return res.status(500).json({ message: "Failed to create appointment." });
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
            role: 'doctor',
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
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })

        const actor = await User.findById(userId).select('role')
        const role = actor?.role || req.user?.role || 'user'

        const query =
            role === 'doctor' ? { doctor: userId } :
            role === 'admin' || role === 'system_admin' ? {} :
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
        const userId = req.user?.id || req.user?._id
        const role = req.user?.role
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

        if (role === 'doctor' && String(appointment.doctor?._id || appointment.doctor) !== String(userId)) {
            return res.status(403).json({ message: 'You can only update your own appointments.' })
        }
        if (!['doctor', 'admin', 'system_admin'].includes(role)) {
            return res.status(403).json({ message: 'You are not allowed to update appointment status.' })
        }
        if (role === 'doctor' && !DOCTOR_ALLOWED_TRANSITIONS[appointment.status]?.includes(status)) {
            return res.status(400).json({ message: `Invalid status transition: ${appointment.status} -> ${status}` })
        }

        const previousStatus = appointment.status
        appointment.status = status
        await appointment.save()

        //Sync to Blockchain
        blockchainService.updateStatusOnChain(appointment._id, status);

        await AuditLog.create({
            userId,
            action: 'UPDATED_APPOINTMENT_STATUS',
            details: `Appointment ${appointment._id}: ${previousStatus} -> ${status}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
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
        const doctorId = req.user?.id || req.user?._id
        if (!doctorId) return res.status(401).json({ message: 'Invalid session' })

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
        const doctorId = req.user?.id || req.user?._id
        if (!doctorId) return res.status(401).json({ message: 'Invalid session' })

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
        const doctorId = req.user?.id || req.user?._id
        if (!doctorId) return res.status(401).json({ message: 'Invalid session' })

        const { appointmentId } = req.params
        const { queueStatus } = req.body

        if (!DOCTOR_QUEUE_STATUS.includes(queueStatus)) {
            return res.status(400).json({ message: 'Invalid queue status.' })
        }

        const appointment = await Appointments.findOne({ _id: appointmentId, doctor: doctorId })
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found.' })
        }

        appointment.queueStatus = queueStatus
        if (queueStatus === 'Checked-Out') appointment.status = 'Completed'
        if (queueStatus === 'No-Show') appointment.status = 'Cancelled'
        if (queueStatus === 'Arrived' && appointment.status === 'Pending') appointment.status = 'Confirmed'
        await appointment.save()

        await AuditLog.create({
            userId: doctorId,
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
        const doctorId = req.user?.id || req.user?._id
        if (!doctorId) return res.status(401).json({ message: 'Invalid session' })

        const { appointmentId } = req.params
        const { subjective, objective, assessment, plan } = req.body || {}

        const appointment = await Appointments.findOne({ _id: appointmentId, doctor: doctorId })
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
            updatedBy: doctorId,
            updatedAt: new Date(),
        }
        appointment.soapNoteHashRecord = soapHash; // Ensure this field exists in your Mongoose Schema!
        
        await appointment.save()

        // 4. [BLOCKCHAIN] Send hash to the ledger asynchronously (fire-and-forget)
        blockchainService.updateSoapNoteOnChain(appointment._id.toString(), soapHash)
            .catch(err => console.error('Blockchain sync failed for SOAP note:', err));

        await AuditLog.create({
            userId: doctorId,
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
        const doctorId = req.user?.id || req.user?._id
        if (!doctorId) return res.status(401).json({ message: 'Invalid session' })

        const { appointmentId } = req.params
        const prescriptions = Array.isArray(req.body?.prescriptions) ? req.body.prescriptions : []

        const appointment = await Appointments.findOne({ _id: appointmentId, doctor: doctorId })
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
            prescribedBy: doctorId,
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
            userId: doctorId,
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
        const doctorId = req.user?.id || req.user?._id
        if (!doctorId) return res.status(401).json({ message: 'Invalid session' })

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
