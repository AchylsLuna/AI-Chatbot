import Appointments from "../Models/AppointmentsModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import User from "../Models/UserModel.js"; // Needed to get user email

export async function createAppointment(req, res) {
    try {
        let { doctorId, scheduledDate, department, reason, note } = req.body;
        const patientId = req.user.id; // Use .id (from JWT)

        // 1. [NEW] Validate Date (Must be in the future)
        if (new Date(scheduledDate) < Date.now()) {
            return res.status(400).json({ message: "Appointment date must be in the future." });
        }

        // 2. [NEW] Check for Existing Pending/Confirmed Appointments
        const existingAppointment = await Appointments.findOne({
            patient: patientId,
            status: { $in: ["Pending", "Confirmed"] }
        });

        if (existingAppointment) {
            return res.status(400).json({ 
                message: "You already have an active appointment. Please complete or cancel it first." 
            });
        }

        // 3. [NEW] Prevent Self-Booking (If a doctor somehow tries to book themselves)
        if (doctorId && patientId === doctorId) {
            return res.status(400).json({ message: "You cannot book an appointment with yourself." });
        }

        // If no doctor specified, pick a default doctor from DB (first user with role 'doctor')
        if (!doctorId) {
            const defaultDoctor = await User.findOne({ role: 'doctor' })
            doctorId = defaultDoctor?._id || null
        }

        // 4. Fetch User Details for Logging (since JWT only has ID/Role)
        const user = await User.findById(patientId);

        const appointment = new Appointments({
            doctor: doctorId,
            patient: patientId,
            scheduledDate,
            department,
            reason: reason || note || '',
        });

        await appointment.save();

        // 5. Audit Log
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

        const query = role === 'doctor' ? { doctor: userId } : { patient: userId }

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