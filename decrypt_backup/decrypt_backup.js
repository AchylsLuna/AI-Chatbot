import fs from 'fs';
import crypto from 'crypto';

const BACKUP_MAGIC = Buffer.from('AGB1');

const password = String(process.env.BACKUP_PASSWORD || '').trim();
const inputPath = process.env.BACKUP_INPUT || 'audit_logs_backup.zip.enc';
const outputPath = process.env.BACKUP_OUTPUT || 'restored_logs.zip';

if (!password) {
    throw new Error('BACKUP_PASSWORD is required to decrypt backup files.');
}

const decryptGcmPayload = (fileData) => {
    const headerLength = 4 + 16 + 12 + 16;
    if (fileData.length <= headerLength) {
        throw new Error('Encrypted backup payload is too short.');
    }

    const salt = fileData.subarray(4, 20);
    const iv = fileData.subarray(20, 32);
    const authTag = fileData.subarray(32, 48);
    const encryptedContent = fileData.subarray(48);

    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
    ]);
};

const decryptLegacyCbcPayload = (fileData) => {
    // Legacy format: [16-byte IV][ciphertext], key derived with static salt.
    const iv = fileData.subarray(0, 16);
    const encryptedContent = fileData.subarray(16);
    const key = crypto.scryptSync(password, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    return Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
    ]);
};

const verify = () => {
    const fileData = fs.readFileSync(inputPath);
    const isGcmPayload = fileData.subarray(0, 4).equals(BACKUP_MAGIC);
    const decrypted = isGcmPayload
        ? decryptGcmPayload(fileData)
        : decryptLegacyCbcPayload(fileData);

    fs.writeFileSync(outputPath, decrypted);
    console.log(`Decrypted successfully to ${outputPath}`);
};

verify();