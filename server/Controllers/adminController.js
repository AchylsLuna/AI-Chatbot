import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import AccessRequest from "../Models/AccessRequestModel.js";
import LedgerEntry from "../Models/LedgerEntryModel.js";
import { Parser } from "json2csv";
import crypto from "crypto";
import { ZipFile } from "yazl";
import { appConfig } from "../Config/env.js";

const normalizeRole = (role) => (role === "doctor" ? "nurse" : role);

const fallbackText = (value, fallback) => {
    const normalized = String(value || "").trim();
    return normalized || fallback;
};

const mapLedgerEntry = (entry) => ({
    id: String(entry._id),
    reservationId: fallbackText(entry.reservationId, "unknown-reservation"),
    patientName: fallbackText(entry.patientName, "Unknown patient"),
    department: fallbackText(entry.department, "General Medicine"),
    timestamp: new Date(entry.timestamp || Date.now()).toISOString(),
    hash: fallbackText(entry.hash, "unknown-hash"),
    txHash: entry.txHash ? String(entry.txHash) : undefined,
    txStatus: entry.txStatus || "confirmed",
    chainId: entry.chainId ? String(entry.chainId) : undefined,
});

export async function getAllUsers(req, res) {
    try {
        const users = await User.find().select("-passwordHashed -otp -otpExpires").lean();

        try {
            await AuditLog.create({
                userId: req.user?.id || req.user?._id,
                action: "GET_USERS_SUCCESS",
                details: `${req.user?.role || "unknown"} retrieved ${users.length} user records.`,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } catch (logError) {
            console.warn("Failed to write audit log for getAllUsers", logError);
        }

        const normalizedUsers = users.map((user) => ({
            ...user,
            role: normalizeRole(user.role),
        }));

        return res.status(200).json(normalizedUsers);
    } catch (error) {
        console.error("Failed to get users", error);
        return res.status(500).json({ message: "Failed to retrieve users." });
    }
}

export async function getLedger(req, res) {
    try {
        const entries = await LedgerEntry.find().sort({ timestamp: -1 }).lean();
        return res.status(200).json({
            ledger: entries.map(mapLedgerEntry),
        });
    } catch (error) {
        console.error("Failed to retrieve ledger", error);
        return res.status(500).json({ message: "Failed to retrieve ledger." });
    }
}

export async function getAccessRequests(req, res) {
    try {
        const requests = await AccessRequest.find().sort({ createdAt: -1 }).lean();

        return res.status(200).json({
            requests: requests.map((request) => ({
                id: String(request._id),
                fullName: fallbackText(request.fullName, "Unknown requester"),
                email: fallbackText(request.email, "unknown@example.local"),
                organization: fallbackText(request.organization, "Not provided"),
                roleRequested: normalizeRole(request.roleRequested || "user"),
                status: request.status || "pending",
                createdAt: new Date(request.createdAt || Date.now()).toISOString(),
                notes: request.notes || undefined,
                reviewedAt: request.reviewedAt ? new Date(request.reviewedAt).toISOString() : undefined,
            })),
        });
    } catch (error) {
        console.error("Failed to retrieve access requests", error);
        return res.status(500).json({ message: "Failed to retrieve access requests." });
    }
}

export async function logAiAlertAction(req, res) {
    try {
        const { alertId, action, context } = req.body || {};

        if (!alertId || !action) {
            return res.status(400).json({ message: "alertId and action are required." });
        }

        await AuditLog.create({
            userId: req.user?.id || req.user?._id,
            action: "AI_ALERT_ACTION",
            details: `alertId=${alertId}; action=${action}; context=${context || ""}`,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Failed to log AI alert action", error);
        return res.status(500).json({ message: "Failed to log AI alert action." });
    }
}

export async function downloadAuditBackup(req, res) {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).lean();

        const fields = ["_id", "userId", "action", "details", "ipAddress", "userAgent", "timestamp"];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(logs || []);

        await AuditLog.create({
            userId: req.user?.id || req.user?._id,
            action: "BACKUP_DOWNLOADED",
            details: `Admin ${req.user?.id || "unknown"} downloaded an encrypted backup.`,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });

        const algorithm = "aes-256-cbc";
        const key = crypto.scryptSync(appConfig.backupPassword, "salt", 32);
        const iv = crypto.randomBytes(16);

        res.attachment("audit_logs_backup.zip.enc");
        res.write(iv);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        const zipFile = new ZipFile();
        let streamFailed = false;

        const handleStreamError = (streamError) => {
            if (streamFailed) return;
            streamFailed = true;
            console.error("Backup stream failed", streamError);

            if (!res.headersSent) {
                res.status(500).json({ message: "Failed to generate backup." });
                return;
            }

            if (!res.destroyed) {
                res.destroy(streamError);
            }
        };

        zipFile.outputStream.on("error", handleStreamError);
        cipher.on("error", handleStreamError);
        res.on("error", handleStreamError);

        zipFile.outputStream.pipe(cipher).pipe(res);
        zipFile.addBuffer(Buffer.from(csv, "utf8"), "audit_logs.csv");
        zipFile.end();
    } catch (error) {
        console.error("Backup failed", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate backup." });
        }
    }
}
