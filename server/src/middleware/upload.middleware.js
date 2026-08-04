import multer from 'multer';
import path from 'path';

// Configure multer to use memory storage (files stored in RAM before S3 upload)
const storage = multer.memoryStorage();

// File filter - only allow specific document types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ];

  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.csv', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, CSV, ZIP. Received: ${file.mimetype}`), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max file size
    files: 10 // Max 10 files per request
  }
});

// Middleware for single file upload
export const uploadSingle = (fieldName = 'file') => upload.single(fieldName);

// Middleware for multiple files upload
export const uploadMultiple = (fieldName = 'files', maxCount = 10) => upload.array(fieldName, maxCount);

// Middleware for multiple fields with different file inputs
export const uploadFields = (fields) => upload.fields(fields);

// Error handler middleware for multer errors
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 25 MB.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 10 files per upload.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field. Check your form data.'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload failed'
    });
  }
  
  next();
};

export default upload;
