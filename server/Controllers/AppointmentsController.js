import Appointments from "../Models/AppointmentsModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import User from "../Models/UserModel.js";

export async function createAppointment(req, res) {
    try {
        let { doctorId, scheduledDate, department, reason, note } = req.body;
        const patientId = req.user.id;

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

        // If no doctor specified, pick a default doctor from DB
        if (!doctorId) {
            const defaultDoctor = await User.findOne({ role: 'doctor' })
            doctorId = defaultDoctor?._id || null
        }
        if (!doctorId) {
            return res.status(400).json({ message: "No doctor is currently available for booking." });
        }

        const doctor = await User.findOne({ _id: doctorId, role: 'doctor', status: 'active' }).select('_id email');
        if (!doctor) {
            return res.status(400).json({ message: "Selected doctor is invalid or unavailable." });
        }


        const user = await User.findById(patientId);

        const appointment = new Appointments({
            doctor: doctorId,
            patient: patientId,
            scheduledDate,
            department,
            reason: reason || note || 'General consultation',
        });

        await appointment.save();

        //Audit Log
        await AuditLog.create({
            action: "CREATED_APPOINTMENT",
            userId: patientId,
            details: `User ${user.email} created appointment with Doctor ${doctorId || 'TBD'} on ${scheduledDate}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(201).json({ message: "Appointment created successfully.", appointment });

    } catch (error) {
        console.error("Failed to create appointment:", error);
        return res.status(500).json({ message: "Failed to create appointment." });
    }
}

export async function getAppointments(req, res) {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })

        const role = req.user?.role || 'user'

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
            patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : undefined,
            doctorName: a.doctor ? `${a.doctor.firstName} ${a.doctor.lastName}` : undefined,
            requestedTime: a.scheduledDate,
            createdAt: a._id.getTimestamp ? a._id.getTimestamp() : undefined,
            status: a.status,
            department: a.department,
            summary: a.reason,
            reason: a.reason,
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
