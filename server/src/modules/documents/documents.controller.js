import crypto from 'crypto';
import { Document } from '../../models/Document.js';
import { uploadToS3, getDownloadUrl, deleteFromS3 } from '../../services/storage.service.js';

/**
 * Upload a single document
 * POST /api/documents/upload
 */
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Use multipart/form-data with a "file" field.'
      });
    }

    const { title, documentType, documentableType, documentableId } = req.body;

    if (!title || !documentType || !documentableType || !documentableId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, documentType, documentableType, documentableId'
      });
    }

    // Validate documentType
    const validTypes = ['vendor_invoice', 'advance_request', 'custom_duty_receipt', 'bill_of_lading', 'po_copy', 'rfq_document', 'other'];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid documentType. Allowed: ${validTypes.join(', ')}`
      });
    }

    // Validate documentableType
    const validEntities = ['AdvancePayment', 'InvoicePayment', 'CustomDutyPayment', 'LogisticsPayment', 'RfqHeader', 'PurchaseOrder'];
    if (!validEntities.includes(documentableType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid documentableType. Allowed: ${validEntities.join(', ')}`
      });
    }

    const folder = `${documentableType.toLowerCase()}/${documentableId}`;
    const storageResult = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    const documentId = `DOC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const document = await Document.create({
      documentId,
      title,
      documentType,
      fileUrl: storageResult.url,
      fileName: req.file.originalname,
      fileSize: storageResult.size,
      mimeType: req.file.mimetype,
      documentableType,
      documentableId,
      storageType: storageResult.storageType || 's3',
      uploadedBy: req.user?.name || req.user?.email || 'System User',
      metadata: {
        s3Key: storageResult.key,
        s3Bucket: storageResult.bucket,
        uploadedByUserId: req.user?.id || req.user?.userId || 'unknown',
        storageType: storageResult.storageType || 's3'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentId: document.documentId,
        title: document.title,
        fileName: document.fileName,
        fileSize: document.fileSize,
        documentType: document.documentType,
        uploadedAt: document.createdAt
      }
    });
  } catch (error) {
    console.error('[Documents] Upload Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload document'
    });
  }
};

/**
 * Upload multiple documents
 * POST /api/documents/upload-multiple
 */
export const uploadMultipleDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const { documentType, documentableType, documentableId } = req.body;

    if (!documentType || !documentableType || !documentableId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: documentType, documentableType, documentableId'
      });
    }

    const uploadedDocuments = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const folder = `${documentableType.toLowerCase()}/${documentableId}`;
        const storageResult = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          folder
        );

        const documentId = `DOC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        const document = await Document.create({
          documentId,
          title: file.originalname,
          documentType,
          fileUrl: storageResult.url,
          fileName: file.originalname,
          fileSize: storageResult.size,
          mimeType: file.mimetype,
          documentableType,
          documentableId,
          storageType: storageResult.storageType || 's3',
          uploadedBy: req.user?.name || req.user?.email || 'System User',
          metadata: {
            s3Key: storageResult.key,
            s3Bucket: storageResult.bucket,
            uploadedByUserId: req.user?.id || req.user?.userId || 'unknown',
            storageType: storageResult.storageType || 's3'
          }
        });

        uploadedDocuments.push({
          documentId: document.documentId,
          fileName: document.fileName,
          fileSize: document.fileSize
        });
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      data: {
        uploaded: uploadedDocuments,
        failed: errors
      }
    });
  } catch (error) {
    console.error('[Documents] Multiple Upload Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload documents'
    });
  }
};

/**
 * Get download URL for a document
 * GET /api/documents/:documentId/download
 */
export const getDocumentDownloadUrl = async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findOne({ documentId }).lean();
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const downloadUrl = await getDownloadUrl(document.fileUrl, 3600, req);

    return res.json({
      success: true,
      data: {
        documentId: document.documentId,
        fileName: document.fileName,
        downloadUrl,
        expiresIn: 3600 // seconds
      }
    });
  } catch (error) {
    console.error('[Documents] Download URL Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate download URL'
    });
  }
};

/**
 * Resolve any stored file URL (e.g. s3://... or /uploads/...) to a browser-viewable HTTP URL
 * GET /api/documents/resolve-url?fileUrl=...
 */
export const resolveFileUrl = async (req, res) => {
  try {
    const fileUrl = req.query.fileUrl || req.body?.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ success: false, error: 'fileUrl parameter is required' });
    }

    try {
      const downloadUrl = await getDownloadUrl(fileUrl, 3600, req);
      return res.json({ success: true, downloadUrl });
    } catch (err) {
      const key = String(fileUrl).replace(/^s3:\/\/[^\/]+\//, '').replace(/^\/+/, '');
      const localWebUrl = `/uploads/${key}`;
      return res.json({ success: true, downloadUrl: localWebUrl });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * List documents for an entity
 * GET /api/documents?documentableType=RfqHeader&documentableId=RFQ-001
 */
export const listDocuments = async (req, res) => {
  try {
    const { documentableType, documentableId, documentType } = req.query;

    const filter = { isDeleted: { $ne: true } };
    if (documentableType) filter.documentableType = documentableType;
    if (documentableId) filter.documentableId = documentableId;
    if (documentType) filter.documentType = documentType;

    const documents = await Document.find(filter)
      .sort({ createdAt: -1 })
      .select('-metadata')
      .lean();

    return res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error('[Documents] List Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list documents'
    });
  }
};

/**
 * Delete a document
 * DELETE /api/documents/:documentId
 */
export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findOne({ documentId });
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Permission Guard: Only the original uploader or an Administrator can delete uploaded documents
    const currentUser = req.user;
    const isUploader = currentUser && (
      currentUser.id === document.uploadedBy ||
      currentUser.email === document.uploadedBy ||
      currentUser.name === document.uploadedBy
    );
    const isAdmin = currentUser && (
      currentUser.role === 'Admin' ||
      currentUser.role === 'Super Admin' ||
      currentUser.role === 'admin'
    );

    if (!isUploader && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Permission Denied: You cannot delete this document. Only the original uploader or an administrator can delete uploaded files.'
      });
    }

    try {
      await deleteFromS3(document.fileUrl, document.storageType || document.metadata?.storageType || 's3');
    } catch (storageError) {
      console.error('[Documents] Storage Delete Warning:', storageError.message);
    }

    // Delete from MongoDB
    await document.deleteOne();

    return res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('[Documents] Delete Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete document'
    });
  }
};

/**
 * Get document details
 * GET /api/documents/:documentId
 */
export const getDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findOne({ documentId }).lean();
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    return res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('[Documents] Get Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get document'
    });
  }
};
