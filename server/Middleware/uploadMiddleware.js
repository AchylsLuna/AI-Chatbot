// Middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/licenses/'); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
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
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: fileFilter
});

// 2. Export the error handling middleware
export const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: "File is too large. Maximum size is 5MB." });
        }
        return res.status(400).json({ message: err.message });
    } else if (err) {
        if (err.message === 'INVALID_FILE_TYPE') {
            return res.status(400).json({ message: "Invalid file type. Only JPG, PNG, and PDF are allowed." });
        }
        return res.status(500).json({ message: "File upload failed." });
    }
    next();
};