import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { uploadSingle, uploadMultiple, handleUploadError } from '../../middleware/upload.middleware.js';
import {
  uploadDocument,
  uploadMultipleDocuments,
  getDocumentDownloadUrl,
  listDocuments,
  deleteDocument,
  getDocument
} from './documents.controller.js';

const router = express.Router();

// Upload single document
router.post(
  '/upload',
  authenticateToken,
  uploadSingle('file'),
  handleUploadError,
  uploadDocument
);

// Upload multiple documents
router.post(
  '/upload-multiple',
  authenticateToken,
  uploadMultiple('files', 10),
  handleUploadError,
  uploadMultipleDocuments
);

// Get document download URL
router.get('/:documentId/download', authenticateToken, getDocumentDownloadUrl);

// List documents
router.get('/', authenticateToken, listDocuments);

// Get document details
router.get('/:documentId', authenticateToken, getDocument);

// Delete document
router.delete('/:documentId', authenticateToken, deleteDocument);

export default router;
