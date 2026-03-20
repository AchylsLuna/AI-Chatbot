import crypto from 'node:crypto';

export const BACKUP_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const BACKUP_FORMAT_MAGIC = Buffer.from('AIBKP1');
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_KEY_LENGTH = 32;
export const BACKUP_SALT_LENGTH = 16;
export const BACKUP_IV_LENGTH = 12;
export const BACKUP_AUTH_TAG_LENGTH = 16;

const HEADER_METADATA_LENGTH = 4;
const HEADER_PREFIX_LENGTH = BACKUP_FORMAT_MAGIC.length + HEADER_METADATA_LENGTH;

const assertFixedLengthBuffer = (buffer, expectedLength, label) => {
    if (!Buffer.isBuffer(buffer) || buffer.length !== expectedLength) {
        throw new Error(`${label} must be ${expectedLength} bytes.`);
    }
};

export const deriveBackupKey = (password, salt) => {
    const normalizedPassword = String(password || '');
    if (!normalizedPassword) {
        throw new Error('Backup password is required.');
    }

    assertFixedLengthBuffer(salt, BACKUP_SALT_LENGTH, 'Backup salt');
    return crypto.scryptSync(normalizedPassword, salt, BACKUP_KEY_LENGTH);
};

export const buildBackupEnvelopeHeader = ({
    salt,
    iv,
    authTagLength = BACKUP_AUTH_TAG_LENGTH,
} = {}) => {
    assertFixedLengthBuffer(salt, BACKUP_SALT_LENGTH, 'Backup salt');
    assertFixedLengthBuffer(iv, BACKUP_IV_LENGTH, 'Backup IV');

    if (authTagLength !== BACKUP_AUTH_TAG_LENGTH) {
        throw new Error(`Unsupported backup auth tag length: ${authTagLength}`);
    }

    return Buffer.concat([
        BACKUP_FORMAT_MAGIC,
        Buffer.from([
            BACKUP_FORMAT_VERSION,
            salt.length,
            iv.length,
            authTagLength,
        ]),
        salt,
        iv,
    ]);
};

export const parseEncryptedBackupPayload = (payload) => {
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || []);
    const minimumLength =
        HEADER_PREFIX_LENGTH +
        BACKUP_SALT_LENGTH +
        BACKUP_IV_LENGTH +
        BACKUP_AUTH_TAG_LENGTH;

    if (buffer.length < minimumLength) {
        throw new Error('Backup payload is incomplete.');
    }

    const magic = buffer.subarray(0, BACKUP_FORMAT_MAGIC.length);
    if (!magic.equals(BACKUP_FORMAT_MAGIC)) {
        throw new Error('Backup payload is not in the expected format.');
    }

    const version = buffer[BACKUP_FORMAT_MAGIC.length];
    if (version !== BACKUP_FORMAT_VERSION) {
        throw new Error(`Unsupported backup payload version: ${version}`);
    }

    const saltLength = buffer[BACKUP_FORMAT_MAGIC.length + 1];
    const ivLength = buffer[BACKUP_FORMAT_MAGIC.length + 2];
    const authTagLength = buffer[BACKUP_FORMAT_MAGIC.length + 3];

    if (
        saltLength !== BACKUP_SALT_LENGTH ||
        ivLength !== BACKUP_IV_LENGTH ||
        authTagLength !== BACKUP_AUTH_TAG_LENGTH
    ) {
        throw new Error('Backup payload metadata is invalid.');
    }

    const headerLength = HEADER_PREFIX_LENGTH + saltLength + ivLength;
    const header = buffer.subarray(0, headerLength);
    const salt = buffer.subarray(HEADER_PREFIX_LENGTH, HEADER_PREFIX_LENGTH + saltLength);
    const iv = buffer.subarray(HEADER_PREFIX_LENGTH + saltLength, headerLength);
    const authTag = buffer.subarray(buffer.length - authTagLength);
    const encryptedContent = buffer.subarray(headerLength, buffer.length - authTagLength);

    if (encryptedContent.length === 0) {
        throw new Error('Backup payload does not contain encrypted content.');
    }

    return {
        version,
        header,
        salt,
        iv,
        authTag,
        encryptedContent,
    };
};

export const decryptBackupBuffer = (payload, password) => {
    const { header, salt, iv, authTag, encryptedContent } = parseEncryptedBackupPayload(payload);
    const key = deriveBackupKey(password, salt);
    const decipher = crypto.createDecipheriv(BACKUP_ENCRYPTION_ALGORITHM, key, iv, {
        authTagLength: authTag.length,
    });

    decipher.setAAD(header);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
    ]);
};
