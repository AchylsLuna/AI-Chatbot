import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import { Parser } from "json2csv";
import archiver from "archiver";
import crypto from 'crypto';

export async function getAllUsers(req, res) {
    try {
        const users = await User.find().select("-passwordHashed -otp -otpExpires");

        // create audit log (non-fatal)
        try {
            await AuditLog.create({
                userId: req.user._id, // Taken from authMiddleware
                action: "GET_USERS_SUCCESS",
                details: `${req.user.role.toUpperCase()} | ${req.user.email} successfully retrieved ${users.length} user records.`,
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