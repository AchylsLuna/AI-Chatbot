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
import { DOCTOR_ROLE_ALIASES, isAdminRole, isDoctorRole, normalizeRole } from "../Utils/roles.js";
import {
    BACKUP_AUTH_TAG_LENGTH,
    BACKUP_ENCRYPTION_ALGORITHM,
    BACKUP_IV_LENGTH,
    BACKUP_SALT_LENGTH,
    buildBackupEnvelopeHeader,
    deriveBackupKey,
} from "../Utils/backupEncryption.js";

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

const streamEncryptedBackupArchive = async (res, { filename, appendEntries }) => {
    const salt = crypto.randomBytes(BACKUP_SALT_LENGTH);
    const iv = crypto.randomBytes(BACKUP_IV_LENGTH);
    const key = deriveBackupKey(appConfig.backupPassword, salt);
    const header = buildBackupEnvelopeHeader({ salt, iv, authTagLength: BACKUP_AUTH_TAG_LENGTH });
    const cipher = crypto.createCipheriv(BACKUP_ENCRYPTION_ALGORITHM, key, iv, {
        authTagLength: BACKUP_AUTH_TAG_LENGTH,
    });
    const archive = archiver('zip', { zlib: { level: 9 } });

    cipher.setAAD(header);

    res.type('application/octet-stream');
    res.attachment(filename);
    res.write(header);

    const completion = new Promise((resolve, reject) => {
        let settled = false;

        const fail = (error) => {
            if (settled) return;
            settled = true;
            archive.destroy(error);
            cipher.destroy(error);
            if (!res.writableEnded) {
                res.destroy(error);
            }
            reject(error);
        };

        archive.on('warning', (warning) => {
            if (warning?.code === 'ENOENT') {
                console.warn('Backup archive warning:', warning);
                return;
            }
            fail(warning);
        });
        archive.once('error', fail);
        cipher.once('error', fail);
        res.once('error', fail);
        res.once('close', () => {
            if (!settled && !res.writableEnded) {
                fail(new Error('Backup download connection closed.'));
            }
        });
        res.once('finish', () => {
            if (settled) return;
            settled = true;
            resolve();
        });
        cipher.once('end', () => {
            if (settled) return;
            try {
                res.write(cipher.getAuthTag());
                res.end();
            } catch (error) {
                fail(error);
            }
        });
    });

    cipher.pipe(res, { end: false });
    archive.pipe(cipher);

    await appendEntries(archive);
    await archive.finalize();
    await completion;
};

const STAFF_ROLE_FILTER = { $in: DOCTOR_ROLE_ALIASES };

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
    role: normalizeRole(user.role) || 'user',
    status: user.status,
    department: user.department || '',
    hasLicenseFile: Boolean(user.licenseUrl) || (Array.isArray(user.licenseUrls) && user.licenseUrls.length > 0),
    licenseCount: Array.isArray(user.licenseUrls) && user.licenseUrls.length > 0 ? user.licenseUrls.length : (user.licenseUrl ? 1 : 0),
});

export async function getPendingStaffApplications(req, res) {
    try {
        const requestedRole = String(req.query?.role || 'all').toLowerCase();
        if (requestedRole !== 'all' && !isDoctorRole(requestedRole)) {
            return res.status(400).json({ message: "Invalid role filter." });
        }

        const query = {
            role: STAFF_ROLE_FILTER,
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
        if (!isDoctorRole(target.role)) {
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
        if (!isDoctorRole(target.role)) {
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
        if (!isDoctorRole(target.role)) {
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
        const responseUsers = users.map((user) => ({
            ...user.toObject(),
            role: normalizeRole(user.role) || 'user',
        }));

        // create audit log (non-fatal)
        try {
            const requesterId = req.user?.id || req.user?._id;
            const requesterRole = normalizeRole(req.user?.role) || 'UNKNOWN';
            await AuditLog.create({
                userId: requesterId,
                action: "GET_USERS_SUCCESS",
                details: `${requesterRole.toUpperCase()} retrieved ${users.length} user records.`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.warn('Failed to write audit log for getAllUsers', logErr)
        }
        return res.status(200).json(responseUsers);
    } catch (error) {
        console.error("Failed to get users:", error);
        return res.status(500).json({ message: "Failed to retrieve users." });
    }
}

export async function updateUserByAdmin(req, res) {
    try {
        const { userId } = req.params;
        const { role, status, department } = req.body;
        const adminRole = normalizeRole(req.user?.role);
        const adminId = req.user?.id || req.user?._id;

        if (!isAdminRole(adminRole)) {
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
        const allowedStatus = ['active', 'disabled'];

        if (role !== undefined) {
            const normalizedRole = normalizeRole(role);
            if (!normalizedRole) {
                return res.status(400).json({ message: "Invalid role value." });
            }
            update.role = normalizedRole;
        }
        if (status !== undefined) {
            if (!allowedStatus.includes(status)) {
                return res.status(400).json({ message: "Invalid status value." });
            }
            update.status = status;
            if (status === 'active' && isDoctorRole(update.role || target.role)) {
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
            { returnDocument: 'after' }
        ).select("email firstName lastName role status department profile");
        const updatedUser = {
            ...updated.toObject(),
            role: normalizeRole(updated.role) || 'user',
        };

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
            user: updatedUser
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

        await streamEncryptedBackupArchive(res, {
            filename: 'audit_logs_backup.zip.enc',
            appendEntries: async (archive) => {
                archive.append(csv, { name: 'audit_logs.csv' });
            },
        });

    } catch (error) {
        console.error("Backup failed:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate backup." });
        } else if (!res.writableEnded) {
            res.destroy(error);
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

        await streamEncryptedBackupArchive(res, {
            filename: 'error_logs_backup.zip.enc',
            appendEntries: async (archive) => {
                archive.append(csv, { name: 'error_logs.csv' });
            },
        });
    } catch (error) {
        console.error("Error backup failed:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate error backup." });
        } else if (!res.writableEnded) {
            res.destroy(error);
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

        await streamEncryptedBackupArchive(res, {
            filename: 'system_backup.zip.enc',
            appendEntries: async (archive) => {
                if (appointmentsCsv) archive.append(appointmentsCsv, { name: 'appointments.csv' });
                if (archivedAppointmentsCsv) archive.append(archivedAppointmentsCsv, { name: 'appointments_archive.csv' });
                if (auditCsv) archive.append(auditCsv, { name: 'audit_logs.csv' });
                if (errorCsv) archive.append(errorCsv, { name: 'error_logs.csv' });
            },
        });
    } catch (error) {
        console.error("System backup failed:", error);
        if (!res.headersSent) {
            return res.status(500).json({ message: "Failed to generate system backup." });
        } else if (!res.writableEnded) {
            res.destroy(error);
        }
    }
}
