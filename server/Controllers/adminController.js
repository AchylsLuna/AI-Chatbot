import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import Appointments from "../Models/AppointmentsModel.js";
import ErrorLog from "../Models/ErrorLogModel.js";
import { Parser } from "json2csv";
import archiver from "archiver";
import crypto from 'crypto';

export async function getAllUsers(req, res) {
    try {
        const users = await User.find()
            .select("-passwordHashed -otp -otpExpires")
            .sort({ _id: -1 });

        // create audit log (non-fatal)
        try {
            const requesterId = req.user?.id || req.user?._id;
            await AuditLog.create({
                userId: requesterId,
                action: "GET_USERS_SUCCESS",
                details: `${(req.user?.role || 'UNKNOWN').toUpperCase()} retrieved ${users.length} user records.`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.warn('Failed to write audit log for getAllUsers', logErr)
        }
        return res.status(200).json(users);
    } catch (error) {
        console.error("Failed to get users:", error);
        return res.status(500).json({ message: "Failed to retrieve users." });
    }
}

export async function updateUserByAdmin(req, res) {
    try {
        const { userId } = req.params;
        const { role, status, department } = req.body;
        const adminRole = req.user?.role;
        const adminId = req.user?.id || req.user?._id;

        if (!['admin', 'system_admin'].includes(adminRole)) {
            return res.status(403).json({ message: "Only admins can manage users." });
        }

        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ message: "User not found." });
        }

        if (String(target._id) === String(adminId)) {
            return res.status(400).json({ message: "You cannot modify your own account from this endpoint." });
        }

        const update = {};
        const allowedRoles = ['user', 'doctor', 'nurse', 'admin', 'system_admin'];
        const allowedStatus = ['active', 'disabled'];

        if (role !== undefined) {
            if (!allowedRoles.includes(role)) {
                return res.status(400).json({ message: "Invalid role value." });
            }
            update.role = role;
        }
        if (status !== undefined) {
            if (!allowedStatus.includes(status)) {
                return res.status(400).json({ message: "Invalid status value." });
            }
            update.status = status;
        }
        if (department !== undefined) {
            update.department = String(department || '').trim();
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ message: "No updatable fields provided." });
        }

        const updated = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            { new: true }
        ).select("-passwordHashed -otp -otpExpires");

        await AuditLog.create({
            userId: adminId,
            action: "ADMIN_MANAGED_USER",
            details: `Admin ${req.user?.email || adminId} updated user ${updated.email}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(200).json({
            message: "User updated successfully.",
            user: updated
        });
    } catch (error) {
        console.error("Failed to update user:", error);
        return res.status(500).json({ message: "Failed to update user." });
    }
}

export async function downloadAuditBackup(req, res) {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).lean();

        if (!logs.length) {
            return res.status(404).json({ message: "No audit logs found to backup." });
        }

        // 1. Convert JSON to CSV
        const fields = ['_id', 'userId', 'action', 'details', 'ipAddress', 'userAgent', 'timestamp'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(logs);

        // 2. Audit this action
        await AuditLog.create({
            userId: req.user.id,
            action: "BACKUP_DOWNLOADED",
            details: `Admin ${req.user.email} downloaded an ENCRYPTED backup.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        // 3. Setup Encryption (AES-256)
        const algorithm = 'aes-256-cbc';
        const password = process.env.BACKUP_PASSWORD || 'default_secret_password';
        // Create a 32-byte key from the password
        const key = crypto.scryptSync(password, 'salt', 32);
        // Create a random Initialization Vector (IV)
        const iv = crypto.randomBytes(16);

        // 4. Set Response Headers
        // We name it .enc so the OS knows it's not a normal zip
        res.attachment('audit_logs_backup.zip.enc'); 
        
        // 5. Send the IV first (needed for decryption), then the encrypted stream
        res.write(iv);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        const archive = archiver('zip', { zlib: { level: 9 } });

        // Pipe: Archive (Zip) -> Cipher (Encrypt) -> Response (Download)
        archive.pipe(cipher).pipe(res);

        // Add CSV to the zip
        archive.append(csv, { name: 'audit_logs.csv' });
        
        // Finalize
        await archive.finalize();

    } catch (error) {
        console.error("Backup failed:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate backup." });
        }
    }
}

export async function downloadSystemBackup(req, res) {
    try {
        const [appointments, archivedAppointments, auditLogs, errorLogs] = await Promise.all([
            Appointments.find().lean(),
            Appointments.db.collection('appointments_archive').find({}).toArray(),
            AuditLog.find().lean(),
            ErrorLog.find().lean(),
        ]);

        const toCsv = (rows, fields) => {
            if (!rows.length) return null;
            const parser = new Parser({ fields });
            return parser.parse(rows);
        };

        const appointmentsCsv = toCsv(appointments, ['_id', 'patient', 'doctor', 'scheduledDate', 'status', 'department', 'reason']);
        const archivedAppointmentsCsv = toCsv(archivedAppointments, ['_id', 'patient', 'doctor', 'scheduledDate', 'status', 'department', 'reason', 'archivedAt']);
        const auditCsv = toCsv(auditLogs, ['_id', 'userId', 'action', 'details', 'ipAddress', 'userAgent', 'timestamp']);
        const errorCsv = toCsv(errorLogs, ['_id', 'message', 'stack', 'route', 'method', 'userId', 'ipAddress', 'userAgent', 'timestamp']);

        if (!appointmentsCsv && !archivedAppointmentsCsv && !auditCsv && !errorCsv) {
            return res.status(404).json({ message: "No records found to backup." });
        }

        await AuditLog.create({
            userId: req.user.id,
            action: "SYSTEM_BACKUP_DOWNLOADED",
            details: `Admin ${req.user.email} downloaded encrypted system backup.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        const algorithm = 'aes-256-cbc';
        const password = process.env.BACKUP_PASSWORD || 'default_secret_password';
        const key = crypto.scryptSync(password, 'salt', 32);
        const iv = crypto.randomBytes(16);

        res.attachment('system_backup.zip.enc');
        res.write(iv);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(cipher).pipe(res);

        if (appointmentsCsv) archive.append(appointmentsCsv, { name: 'appointments.csv' });
        if (archivedAppointmentsCsv) archive.append(archivedAppointmentsCsv, { name: 'appointments_archive.csv' });
        if (auditCsv) archive.append(auditCsv, { name: 'audit_logs.csv' });
        if (errorCsv) archive.append(errorCsv, { name: 'error_logs.csv' });

        await archive.finalize();
    } catch (error) {
        console.error("System backup failed:", error);
        if (!res.headersSent) {
            return res.status(500).json({ message: "Failed to generate system backup." });
        }
    }
}
