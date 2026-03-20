import fs from 'node:fs';
import { decryptBackupBuffer } from '../server/Utils/backupEncryption.js';

const password = String(process.env.BACKUP_PASSWORD || '').trim();
const inputPath = process.argv[2] || 'audit_logs_backup.zip.enc';
const outputPath = process.argv[3] || 'restored_logs.zip';

const verify = () => {
    if (!password) {
        throw new Error('Set BACKUP_PASSWORD before running this script.');
    }

    const fileData = fs.readFileSync(inputPath);
    const decrypted = decryptBackupBuffer(fileData, password);

    fs.writeFileSync(outputPath, decrypted);
    console.log(`Decrypted ${inputPath} to ${outputPath}`);
};

verify();
