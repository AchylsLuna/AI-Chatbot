import crypto from "crypto";
import Appointments from "../Models/AppointmentsModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import LedgerEntry from "../Models/LedgerEntryModel.js";
import User from "../Models/UserModel.js";

const STATUS_VALUES = ["Booked", "Recorded", "Failed"];
const PRIORITY_VALUES = ["Low", "Routine", "High"];

const normalizeRole = (role) => (role === "doctor" ? "nurse" : role);

const normalizeStatus = (status) => {
    if (!status) return "Booked";
    if (STATUS_VALUES.includes(status)) return status;

    const normalized = String(status).trim().toLowerCase();
    if (normalized === "pending" || normalized === "confirmed") return "Booked";
    if (normalized === "completed" || normalized === "recorded") return "Recorded";
    if (normalized === "cancelled" || normalized === "canceled" || normalized === "failed") return "Failed";

    return "Booked";
};

const normalizePriority = (priority) => {
    if (!priority) return "Routine";
    if (PRIORITY_VALUES.includes(priority)) return priority;

    const normalized = String(priority).trim().toLowerCase();
    if (normalized === "low") return "Low";
    if (normalized === "high") return "High";
    return "Routine";
};

const normalizeConfidence = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0.75;
    if (parsed < 0) return 0;
    if (parsed > 1) return 1;
    return parsed;
};

const isValidFutureDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getTime() > Date.now();
};

const buildSummary = ({ summary, symptoms, department }) => {
    const cleanedSummary = String(summary || "").trim();
    if (cleanedSummary) return cleanedSummary;

    const cleanedSymptoms = String(symptoms || "").trim();
    if (cleanedSymptoms) {
        const finalSymptoms = cleanedSymptoms.endsWith(".") ? cleanedSymptoms.slice(0, -1) : cleanedSymptoms;
        return `Decision Tree summary: ${finalSymptoms}. Recommend ${department}.`;
    }

    return `Decision Tree summary: No symptoms provided. Recommend ${department}.`;
};

const formatIso = (value) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
};

const mapAppointmentToReservation = ({ appointment, patientName }) => ({
    id: String(appointment._id),
    patientName: String(patientName || "Unknown patient"),
    symptoms: String(appointment.symptoms || "No symptoms provided"),
    department: String(appointment.department || "General Medicine"),
    priority: normalizePriority(appointment.priority),
    confidence: normalizeConfidence(appointment.confidence),
    requestedTime: formatIso(appointment.scheduledDate),
    createdAt: formatIso(appointment.createdAt || appointment._id?.getTimestamp?.()),
    status: normalizeStatus(appointment.status),
    summary: String(
        appointment.summary ||
            buildSummary({
                summary: appointment.reason,
                symptoms: appointment.symptoms,
                department: appointment.department,
            })
    ),
});

const mapLedgerEntry = (entry) => ({
    id: String(entry._id),
    reservationId: String(entry.reservationId),
    patientName: String(entry.patientName),
    department: String(entry.department),
    timestamp: formatIso(entry.timestamp),
    hash: String(entry.hash),
    txHash: entry.txHash ? String(entry.txHash) : undefined,
    txStatus: entry.txStatus,
    chainId: entry.chainId ? String(entry.chainId) : undefined,
});

const toIdString = (value) => {
    if (!value) return "";
    if (typeof value === "object") {
        if (value._id) return String(value._id);
        if (value.id) return String(value.id);
    }
    return String(value);
};

const createLedgerEntry = async ({ appointment, action, patientName, actorUserId }) => {
    const timestamp = new Date();
    const hash = crypto
        .createHash("sha256")
        .update(
            [
                String(appointment._id),
                action,
                String(appointment.status),
                String(appointment.department),
                String(timestamp.getTime()),
            ].join("|")
        )
        .digest("hex");

    const entry = await LedgerEntry.create({
        reservationId: String(appointment._id),
        appointmentId: appointment._id,
        patientName: String(patientName || "Unknown patient"),
        department: String(appointment.department || "General Medicine"),
        timestamp,
        hash,
        txStatus: "confirmed",
        chainId: "offchain-local",
        action,
        actorUserId: actorUserId || undefined,
        details: `${action} for appointment ${appointment._id}`,
    });

    return entry;
};

const canEditAppointment = ({ role, userId, appointment }) => {
    if (role === "admin" || role === "system_admin") return true;

    if (role === "nurse") {
        const doctorId = toIdString(appointment.doctor);
        if (!doctorId) return true;
        return doctorId === String(userId);
    }

    if (role === "user") {
        return toIdString(appointment.patient) === String(userId);
    }

    return false;
};

const listAppointmentsForRole = async ({ role, userId }) => {
    if (role === "admin" || role === "system_admin") {
        return Appointments.find({})
            .populate("patient", "email firstName lastName")
            .sort({ createdAt: -1 });
    }

    if (role === "nurse") {
        return Appointments.find({ doctor: userId })
            .populate("patient", "email firstName lastName")
            .sort({ createdAt: -1 });
    }

    return Appointments.find({ patient: userId })
        .populate("patient", "email firstName lastName")
        .sort({ createdAt: -1 });
};

const mapAppointmentCollection = (appointments) =>
    appointments.map((appointment) =>
        mapAppointmentToReservation({
            appointment,
            patientName: appointment.patient
                ? `${appointment.patient.firstName || ""} ${appointment.patient.lastName || ""}`.trim()
                : "Unknown patient",
        })
    );

export async function createAppointment(req, res) {
    try {
        const patientId = req.user?.id || req.user?._id;
        if (!patientId) {
            return res.status(401).json({ message: "Invalid session" });
        }

        const role = normalizeRole(req.user?.role);
        if (role !== "user") {
            return res.status(403).json({ message: "Only user accounts can create appointments." });
        }

        const scheduledDate = req.body?.scheduledDate;
        const department = String(req.body?.department || "").trim();
        const reason = String(req.body?.reason || "").trim();
        const note = String(req.body?.note || "").trim();
        const symptoms = String(req.body?.symptoms || reason || note || "").trim() || "No symptoms provided";
        const priority = normalizePriority(req.body?.priority);
        const confidence = normalizeConfidence(req.body?.confidence);
        const summary = buildSummary({ summary: req.body?.summary || reason || note, symptoms, department });

        if (!scheduledDate || !department) {
            return res.status(400).json({ message: "Missing required appointment fields." });
        }

        if (!isValidFutureDate(scheduledDate)) {
            return res.status(400).json({ message: "Appointment date must be in the future." });
        }

        const existingAppointment = await Appointments.findOne({
            patient: patientId,
            status: "Booked",
        });

        if (existingAppointment) {
            return res.status(400).json({
                message: "You already have an active appointment. Please complete or cancel it first.",
            });
        }

        let doctorId = req.body?.doctorId;
        if (!doctorId) {
            const defaultDoctor = await User.findOne({ role: "nurse", status: "active" }).select("_id");
            doctorId = defaultDoctor?._id || null;
        }

        if (doctorId && String(patientId) === String(doctorId)) {
            return res.status(400).json({ message: "You cannot book an appointment with yourself." });
        }

        const patient = await User.findById(patientId).select("firstName lastName email");
        const patientName = patient
            ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || patient.email
            : "Unknown patient";

        const appointment = await Appointments.create({
            doctor: doctorId || undefined,
            patient: patientId,
            scheduledDate: new Date(scheduledDate),
            department,
            reason: reason || summary,
            symptoms,
            priority,
            confidence,
            summary,
            status: "Booked",
        });

        const ledgerEntry = await createLedgerEntry({
            appointment,
            action: "CREATED_APPOINTMENT",
            patientName,
            actorUserId: patientId,
        });

        await AuditLog.create({
            action: "CREATED_APPOINTMENT",
            userId: patientId,
            details: `User ${patientName} created appointment ${appointment._id}.`,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });

        return res.status(201).json({
            reservation: mapAppointmentToReservation({ appointment, patientName }),
            ledgerEntry: mapLedgerEntry(ledgerEntry),
        });
    } catch (error) {
        console.error("Failed to create appointment", error);
        return res.status(500).json({ message: "Failed to create appointment." });
    }
}

export async function getAppointments(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ message: "Invalid session" });

        const role = normalizeRole(req.user?.role || "user");
        const appointments = await listAppointmentsForRole({ role, userId });

        return res.json({ appointments: mapAppointmentCollection(appointments) });
    } catch (error) {
        console.error("Failed to fetch appointments", error);
        return res.status(500).json({ message: "Failed to fetch appointments" });
    }
}

export async function getReservations(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ message: "Invalid session" });

        const role = normalizeRole(req.user?.role || "user");
        const appointments = await listAppointmentsForRole({ role, userId });

        return res.json({ reservations: mapAppointmentCollection(appointments) });
    } catch (error) {
        console.error("Failed to fetch reservations", error);
        return res.status(500).json({ message: "Failed to fetch reservations" });
    }
}

export async function updateAppointment(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ message: "Invalid session" });

        const role = normalizeRole(req.user?.role || "user");
        const appointmentId = req.params?.id;

        const appointment = await Appointments.findById(appointmentId).populate("patient", "firstName lastName email");
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        if (!canEditAppointment({ role, userId, appointment })) {
            return res.status(403).json({ message: "You do not have permission to update this appointment." });
        }

        const updates = req.body || {};

        if (typeof updates.requestedTime === "string") {
            const nextDate = new Date(updates.requestedTime);
            if (Number.isNaN(nextDate.getTime())) {
                return res.status(400).json({ message: "Invalid requestedTime value." });
            }
            appointment.scheduledDate = nextDate;
        }

        if (typeof updates.status === "string") {
            const normalizedStatus = normalizeStatus(updates.status);
            if (!STATUS_VALUES.includes(normalizedStatus)) {
                return res.status(400).json({ message: "Invalid status value." });
            }
            appointment.status = normalizedStatus;
        }

        if (typeof updates.department === "string") {
            const nextDepartment = updates.department.trim();
            if (nextDepartment) {
                appointment.department = nextDepartment;
            }
        }

        if (typeof updates.priority === "string") {
            const normalizedPriority = normalizePriority(updates.priority);
            if (!PRIORITY_VALUES.includes(normalizedPriority)) {
                return res.status(400).json({ message: "Invalid priority value." });
            }
            appointment.priority = normalizedPriority;
        }

        if (typeof updates.summary === "string") {
            const nextSummary = updates.summary.trim();
            if (nextSummary) {
                appointment.summary = nextSummary;
                appointment.reason = nextSummary;
            }
        }

        await appointment.save();

        const patientName = appointment.patient
            ? `${appointment.patient.firstName || ""} ${appointment.patient.lastName || ""}`.trim() ||
              appointment.patient.email ||
              "Unknown patient"
            : "Unknown patient";

        const ledgerEntry = await createLedgerEntry({
            appointment,
            action: "UPDATED_APPOINTMENT",
            patientName,
            actorUserId: userId,
        });

        await AuditLog.create({
            action: "UPDATED_APPOINTMENT",
            userId,
            details: `Appointment ${appointment._id} updated to status ${appointment.status}.`,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });

        return res.json({
            appointment: mapAppointmentToReservation({ appointment, patientName }),
            ledgerEntry: mapLedgerEntry(ledgerEntry),
        });
    } catch (error) {
        console.error("Failed to update appointment", error);
        return res.status(500).json({ message: "Failed to update appointment" });
    }
}
