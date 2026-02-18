import Appointments from "../Models/AppointmentsModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import User from "../Models/UserModel.js"; // Needed to get user email

export async function createAppointment(req, res) {
    try {
        const { doctorId, scheduledDate, department, reason } = req.body;
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
        if (patientId === doctorId) {
            return res.status(400).json({ message: "You cannot book an appointment with yourself." });
        }

        // 4. Fetch User Details for Logging (since JWT only has ID/Role)
        const user = await User.findById(patientId);

        const appointment = new Appointments({
            doctor: doctorId,
            patient: patientId,
            scheduledDate,
            department,
            reason
        });

        await appointment.save();

        // 5. Audit Log
        await AuditLog.create({
            action: "CREATED_APPOINTMENT",
            userId: patientId,
            details: `User ${user.email} created appointment with Doctor ${doctorId} on ${scheduledDate}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(201).json({ message: "Appointment created successfully.", appointment });

    } catch (error) {
        console.error("Failed to create appointment:", error);
        return res.status(500).json({ message: "Failed to create appointment." });
    }
}