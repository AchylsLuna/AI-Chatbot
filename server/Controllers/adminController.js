import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import Appointments from "../Models/AppointmentsModel.js";
import ErrorLog from "../Models/ErrorLogModel.js";
import { Parser } from "json2csv";
import archiver from "archiver";
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { appConfig } from "../Config/env.js";

async function resolveActorEmail(req) {
    const fallbackId = req.user?.id || req.user?._id;
    if (!fallbackId) return 'Unknown';
    if (req.user?.email) return req.user.email;

    try {
        const actor = await User.findById(fallbackId).select('email').lean();
        return actor?.email || String(fallbackId);
    } catch {
        return String(fallbackId);
    }
}

const STAFF_ROLES = ['doctor'];

const toIsoString = (value, fallback = new Date(0).toISOString()) => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const resolvePatientName = (patient) => {
    if (!patient) return "Unknown Patient";
    const fullName = `${String(patient.firstName || '').trim()} ${String(patient.lastName || '').trim()}`.trim();
    if (fullName) return fullName;
    if (patient.email) return String(patient.email);
    return "Unknown Patient";
};

const resolveAppointmentBaseTimestamp = (appointment) => {
    if (appointment?._id && typeof appointment._id.getTimestamp === "function") {
        return toIsoString(appointment._id.getTimestamp());
    }
    return toIsoString(appointment?.scheduledDate);
};

const toStaffApplicationDto = (user) => ({
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    department: user.department || '',
    hasLicenseFile: Boolean(user.licenseUrl) || (Array.isArray(user.licenseUrls) && user.licenseUrls.length > 0),
    licenseCount: Array.isArray(user.licenseUrls) && user.licenseUrls.length > 0 ? user.licenseUrls.length : (user.licenseUrl ? 1 : 0),
});

export async function getPendingStaffApplications(req, res) {
    try {
        const role = String(req.query?.role || 'all').toLowerCase();
        if (!['all', ...STAFF_ROLES].includes(role)) {
            return res.status(400).json({ message: "Invalid role filter." });
        }

        const query = {
            role: role === 'all' ? { $in: STAFF_ROLES } : role,
            status: 'disabled',
            staffApplicationReviewed: { $ne: true },
        };

        const users = await User.find(query)
            .select("email firstName lastName role status department licenseUrl licenseUrls")
            .sort({ _id: -1 })
            .lean();

        return res.status(200).json({
            applications: users.map(toStaffApplicationDto),
        });
    } catch (error) {
        console.error("Failed to get pending staff applications:", error);
        return res.status(500).json({ message: "Failed to retrieve pending staff applications." });
    }
}

export async function approveStaffApplication(req, res) {
    try {
        const { userId } = req.params;
        const actorId = req.user?.id || req.user?._id;

        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ message: "User not found." });
        }
        if (!STAFF_ROLES.includes(target.role)) {
            return res.status(400).json({ message: "Only doctor applications can be approved." });
        }
        const hasAnyLicense = Boolean(target.licenseUrl) || (Array.isArray(target.licenseUrls) && target.licenseUrls.length > 0);
        if (!hasAnyLicense) {
            return res.status(400).json({ message: "Cannot approve application without uploaded license." });
        }

        target.status = 'active';
        target.staffApplicationReviewed = true;
        await target.save();

        const adminEmail = await resolveActorEmail(req);
        await AuditLog.create({
            userId: actorId,
            action: "ADMIN_APPROVED_STAFF_APPLICATION",
            details: `Admin ${adminEmail} approved ${target.role} application for ${target.email}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(200).json({
            message: "Application approved successfully.",
            user: toStaffApplicationDto(target),
        });
    } catch (error) {
        console.error("Failed to approve staff application:", error);
        return res.status(500).json({ message: "Failed to approve staff application." });
    }
}

export async function rejectStaffApplication(req, res) {
    try {
        const { userId } = req.params;
        const actorId = req.user?.id || req.user?._id;

        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ message: "User not found." });
        }
        if (!STAFF_ROLES.includes(target.role)) {
            return res.status(400).json({ message: "Only doctor applications can be rejected." });
        }

        const removedEmail = target.email;
        const removedRole = target.role;
        const licensePaths = Array.from(new Set([
            ...(Array.isArray(target.licenseUrls) ? target.licenseUrls : []),
            ...(target.licenseUrl ? [target.licenseUrl] : []),
        ].map((item) => String(item || '').trim()).filter(Boolean)));
        await User.deleteOne({ _id: target._id });

        if (licensePaths.length > 0) {
            const baseDir = path.resolve(process.cwd(), 'uploads', 'licenses');
            for (const rawPath of licensePaths) {
                const resolvedPath = path.isAbsolute(rawPath)
                    ? path.resolve(rawPath)
                    : path.resolve(process.cwd(), rawPath);
                if (resolvedPath.startsWith(baseDir)) {
                    await fs.unlink(resolvedPath).catch(() => {});
                }
            }
        }

        const adminEmail = await resolveActorEmail(req);
        await AuditLog.create({
            userId: actorId,
            action: "ADMIN_REJECTED_STAFF_APPLICATION",
            details: `Admin ${adminEmail} rejected ${removedRole} application for ${removedEmail}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(200).json({ message: "Application rejected and account removed." });
    } catch (error) {
        console.error("Failed to reject staff application:", error);
        return res.status(500).json({ message: "Failed to reject staff application." });
    }
}

export async function viewStaffApplicationLicense(req, res) {
    try {
        const { userId } = req.params;
        const target = await User.findById(userId).select("role licenseUrl licenseUrls");
        if (!target) {
            return res.status(404).json({ message: "User not found." });
        }
        if (!STAFF_ROLES.includes(target.role)) {
            return res.status(400).json({ message: "License is only available for doctor accounts." });
        }
        const licensePaths = Array.from(new Set([
            ...(Array.isArray(target.licenseUrls) ? target.licenseUrls : []),
            ...(target.licenseUrl ? [target.licenseUrl] : []),
        ].map((item) => String(item || '').trim()).filter(Boolean)));
        if (licensePaths.length === 0) {
            return res.status(404).json({ message: "License file not found." });
        }
        const requestedIndex = Math.max(0, Number(req.query?.index || 0) || 0);
        const selectedPath = licensePaths[Math.min(requestedIndex, licensePaths.length - 1)];

        const baseDir = path.resolve(process.cwd(), 'uploads', 'licenses');
        const resolvedPath = path.isAbsolute(selectedPath)
            ? path.resolve(selectedPath)
            : path.resolve(process.cwd(), selectedPath);

        if (!resolvedPath.startsWith(baseDir)) {
            return res.status(400).json({ message: "Invalid license file path." });
        }

        await fs.access(resolvedPath);
        return res.sendFile(resolvedPath);
    } catch (error) {
        console.error("Failed to view staff license:", error);
        return res.status(500).json({ message: "Failed to open license file." });
    }
}

export async function getAllUsers(req, res) {
    try {
        const users = await User.find()
            .select("email firstName lastName role status department profile")
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
        const allowedRoles = ['user', 'doctor', 'admin', 'system_admin'];
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
            if (status === 'active' && ['doctor'].includes(target.role)) {
                update.staffApplicationReviewed = true;
            }
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
        ).select("email firstName lastName role status department profile");

        const adminEmail = await resolveActorEmail(req);

        await AuditLog.create({
            userId: adminId,
            action: "ADMIN_MANAGED_USER",
            details: `Admin ${adminEmail} updated user ${updated.email}.`,
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

export async function getAuditLogs(req, res) {
    try {
        const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 1000);
        const logs = await AuditLog.find()
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({ logs });
    } catch (error) {
        console.error("Failed to get audit logs:", error);
        return res.status(500).json({ message: "Failed to retrieve audit logs." });
    }
}

export async function getErrorLogs(req, res) {
    try {
        const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 1000);
        const logs = await ErrorLog.find()
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({ logs });
    } catch (error) {
        console.error("Failed to get error logs:", error);
        return res.status(500).json({ message: "Failed to retrieve error logs." });
    }
}

export async function getLedger(req, res) {
    try {
        const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 1000);
        const chainId = String(process.env.CHAIN_ID || '').trim() || undefined;

        const appointments = await Appointments.find({
            $or: [
                { blockchainTxHash: { $ne: '' } },
                { soapNoteHashRecord: { $ne: '' } },
                { prescriptionsHashRecord: { $ne: '' } },
            ],
        })
            .select(
                "_id patient department scheduledDate blockchainTxHash soapNoteHashRecord prescriptionsHashRecord soapNote prescriptions"
            )
            .populate('patient', 'firstName lastName email')
            .sort({ _id: -1 })
            .limit(limit)
            .lean();

        const ledger = [];

        for (const appointment of appointments) {
            const reservationId = String(appointment._id);
            const patientName = resolvePatientName(appointment.patient);
            const department = String(appointment.department || 'General Medicine');
            const baseTimestamp = resolveAppointmentBaseTimestamp(appointment);
            const txHash = String(appointment.blockchainTxHash || '').trim();
            const soapHash = String(appointment.soapNoteHashRecord || '').trim();
            const prescriptionsHash = String(appointment.prescriptionsHashRecord || '').trim();

            if (txHash) {
                ledger.push({
                    id: `LEDGER-${reservationId}-appointment`,
                    reservationId,
                    patientName,
                    department,
                    timestamp: baseTimestamp,
                    hash: txHash,
                    txHash,
                    txStatus: 'confirmed',
                    chainId,
                });
            }

            if (soapHash) {
                ledger.push({
                    id: `LEDGER-${reservationId}-soap`,
                    reservationId,
                    patientName,
                    department,
                    timestamp: toIsoString(appointment.soapNote?.updatedAt, baseTimestamp),
                    hash: soapHash,
                    txStatus: txHash ? 'confirmed' : 'skipped',
                    chainId,
                });
            }

            if (prescriptionsHash) {
                const latestPrescriptionTimestamp = Array.isArray(appointment.prescriptions) && appointment.prescriptions.length > 0
                    ? appointment.prescriptions.reduce((latest, item) => {
                        const createdAt = item?.createdAt ? new Date(item.createdAt).getTime() : 0;
                        return createdAt > latest ? createdAt : latest;
                    }, 0)
                    : 0;

                ledger.push({
                    id: `LEDGER-${reservationId}-prescriptions`,
                    reservationId,
                    patientName,
                    department,
                    timestamp: toIsoString(
                        latestPrescriptionTimestamp ? new Date(latestPrescriptionTimestamp) : null,
                        baseTimestamp
                    ),
                    hash: prescriptionsHash,
                    txStatus: txHash ? 'confirmed' : 'skipped',
                    chainId,
                });
            }
        }

        ledger.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return res.status(200).json({ ledger: ledger.slice(0, limit) });
    } catch (error) {
        console.error("Failed to get ledger:", error);
        return res.status(500).json({ message: "Failed to retrieve ledger." });
    }
}

export async function downloadAuditBackup(req, res) {
    try {
        const actorId = req.user?.id || req.user?._id;
        const logs = await AuditLog.find().sort({ timestamp: -1 }).lean();

        if (!logs.length) {
            return res.status(404).json({ message: "No audit logs found to backup." });
        }

        // 1. Convert JSON to CSV
        const fields = ['_id', 'userId', 'action', 'details', 'ipAddress', 'userAgent', 'timestamp'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(logs);

        // 2. Audit this action
        const adminEmail = await resolveActorEmail(req);

        await AuditLog.create({
            userId: actorId,
            action: "BACKUP_DOWNLOADED",
            details: `Admin ${adminEmail} downloaded an ENCRYPTED backup.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        // 3. Setup Encryption (AES-256)
        const algorithm = 'aes-256-cbc';
        const password = appConfig.backupPassword;
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

export async function downloadErrorBackup(req, res) {
    try {
        const actorId = req.user?.id || req.user?._id;
        const logs = await ErrorLog.find().sort({ timestamp: -1 }).lean();

        if (!logs.length) {
            return res.status(404).json({ message: "No error logs found to backup." });
        }

        const fields = ['_id', 'message', 'stack', 'route', 'method', 'userId', 'ipAddress', 'userAgent', 'timestamp'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(logs);

        const adminEmail = await resolveActorEmail(req);

        await AuditLog.create({
            userId: actorId,
            action: "ERROR_BACKUP_DOWNLOADED",
            details: `Admin ${adminEmail} downloaded an ENCRYPTED error-log backup.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        const algorithm = 'aes-256-cbc';
        const password = appConfig.backupPassword;
        const key = crypto.scryptSync(password, 'salt', 32);
        const iv = crypto.randomBytes(16);

        res.attachment('error_logs_backup.zip.enc');
        res.write(iv);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(cipher).pipe(res);

        archive.append(csv, { name: 'error_logs.csv' });

        await archive.finalize();
    } catch (error) {
        console.error("Error backup failed:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate error backup." });
        }
    }
}

export async function downloadSystemBackup(req, res) {
    try {
        const actorId = req.user?.id || req.user?._id;
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

        const adminEmail = await resolveActorEmail(req);

        await AuditLog.create({
            userId: actorId,
            action: "SYSTEM_BACKUP_DOWNLOADED",
            details: `Admin ${adminEmail} downloaded encrypted system backup.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        const algorithm = 'aes-256-cbc';
        const password = appConfig.backupPassword;
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
