// Middleware/uploadMiddleware.js
import crypto from 'node:crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const LICENSE_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'licenses');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        fs.mkdir(LICENSE_UPLOAD_DIR, { recursive: true })
            .then(() => cb(null, LICENSE_UPLOAD_DIR))
            .catch((error) => cb(error));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = crypto.randomUUID();
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('INVALID_FILE_TYPE'), false);
    }
};

// 1. Export the Multer upload instance
export const uploadLicense = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 }, 
    fileFilter: fileFilter
});

// 2. Export the error handling middleware
export const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: "File is too large. Maximum size is 5MB." });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ message: "Too many files. You can upload up to 5 license files." });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: "Unexpected upload field. Please reselect your license files and try again." });
        }
        return res.status(400).json({ message: err.message });
    } else if (err) {
        if (err.message === 'INVALID_FILE_TYPE') {
            return res.status(400).json({ message: "Invalid file type. Only JPG, PNG, and PDF are allowed." });
        }
        if (err.code === 'ENOENT') {
            return res.status(500).json({ message: "License upload directory is unavailable." });
        }
        return res.status(500).json({ message: "File upload failed." });
    }
    next();
};
