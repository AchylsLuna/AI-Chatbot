import fs from 'fs';
import crypto from 'crypto';

const password = 'BackupPassword123!'; // Match your .env
const inputPath = 'audit_logs_backup.zip.enc';
const outputPath = 'restored_logs.zip';

const verify = () => {
    // 1. Read the file
    const fileData = fs.readFileSync(inputPath);

    // 2. Extract IV (first 16 bytes) and Content
    const iv = fileData.subarray(0, 16);
    const encryptedContent = fileData.subarray(16);

    // 3. Generate Key
    const key = crypto.scryptSync(password, 'salt', 32);

    // 4. Decrypt
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final()
    ]);

    // 5. Save
    fs.writeFileSync(outputPath, decrypted);
    console.log("Decrypted successfully! Open restored_logs.zip");
};

verify();