import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE SERVICE — AWS S3 with automatic local filesystem fallback.
//
// If AWS credentials are present, files are stored in S3 (private, accessed via
// presigned URLs). If AWS is not configured OR an S3 call fails, files are
// written to <server>/uploads and served over the same Express server.
// This guarantees document upload → store → list → download always works.
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the uploads root relative to the server package (server/uploads).
// server/src/services/storage.service.js -> server/uploads
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// AWS S3 Configuration (optional)
const hasS3Credentials = () =>
  Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  );

const isS3Configured = () => hasS3Credentials();

let s3Client = null;
function getS3Client() {
  if (!s3Client) {
    const clientConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      maxAttempts: 1,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    };

    // Add custom endpoint for S3-compatible storage (Vultr, MinIO, etc.)
    if (process.env.AWS_ENDPOINT) {
      clientConfig.endpoint = process.env.AWS_ENDPOINT;
      clientConfig.forcePathStyle = process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true';
    }

    s3Client = new S3Client(clientConfig);
  }
  return s3Client;
}

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'rayzon-p2p-documents';

// Ensure the local uploads directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Generate a unique storage key for uploaded files
 * Works for both S3 keys and local relative paths.
 */
export function generateS3Key(originalFilename, folder = 'documents') {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalFilename || '');
  const sanitizedName = path.basename(originalFilename || 'file', ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .substring(0, 50);
  return `${folder}/${timestamp}-${randomId}-${sanitizedName}${ext}`;
}

/**
 * Convert an absolute local filesystem path into a web-accessible /uploads URL.
 */
export function toWebPath(absPath) {
  const relative = path.relative(UPLOAD_DIR, absPath);
  const normalized = relative.split(path.sep).join('/');
  return `/uploads/${normalized}`;
}

/**
 * Convert a stored url (s3://... or /uploads/...) into a local absolute path,
 * or return null if the url is not a local upload.
 */
export function toLocalPath(fileUrl) {
  if (!fileUrl) return null;
  if (String(fileUrl).startsWith('/uploads/')) {
    const rel = String(fileUrl).replace(/^\/uploads\//, '');
    return path.join(UPLOAD_DIR, ...rel.split('/'));
  }
  if (String(fileUrl).startsWith('file://')) {
    return fileURLToPath(fileUrl);
  }
  return null;
}

/**
 * Upload a file.
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} originalFilename - Original filename
 * @param {string} mimeType - MIME type of the file
 * @param {string} folder - S3 folder / local subfolder prefix
 * @returns {Promise<{key: string, url: string, bucket: string, size: number, storage: 's3'|'local'}>}
 */
export async function uploadToS3(fileBuffer, originalFilename, mimeType, folder = 'documents') {
  const key = generateS3Key(originalFilename, folder);

  // 1) Try S3 when configured
  if (isS3Configured()) {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: 'private',
        Metadata: {
          originalName: originalFilename || '',
          uploadedAt: new Date().toISOString()
        }
      });

      await getS3Client().send(command);

      return {
        key,
        bucket: BUCKET_NAME,
        url: `s3://${BUCKET_NAME}/${key}`,
        size: fileBuffer.length,
        storage: 's3'
      };
    } catch (error) {
      console.warn('[Storage Service] S3 upload failed, falling back to local storage:', error.message);
      // Fall through to local storage
    }
  } else {
    console.warn('[Storage Service] AWS S3 not configured — using local filesystem storage.');
  }

  // 2) Local filesystem fallback
  const safeFolder = String(folder || 'documents').replace(/\.\./g, '').replace(/[\\/]/g, '/');
  const targetDir = path.join(UPLOAD_DIR, ...safeFolder.split('/'));
  fs.mkdirSync(targetDir, { recursive: true });

  const localRelPath = `${safeFolder}/${path.basename(key)}`;
  const absPath = path.join(UPLOAD_DIR, ...localRelPath.split('/'));
  fs.writeFileSync(absPath, fileBuffer);

  return {
    key: localRelPath,
    bucket: 'local',
    url: toWebPath(absPath),
    size: fileBuffer.length,
    storage: 'local'
  };
}

/**
 * Generate a download URL (presigned S3 URL or local /uploads path).
 * @param {string} fileUrl - stored s3:// URL or /uploads/... path
 * @param {number} expiresIn - URL expiration in seconds (only used for S3)
 * @returns {Promise<string>}
 */
export async function getDownloadUrl(fileUrl, expiresIn = 3600) {
  // Local storage path
  const localPath = toLocalPath(fileUrl);
  if (localPath) {
    if (!fs.existsSync(localPath)) {
      throw new Error('File not found in local storage.');
    }
    // Return the web path (served by Express static middleware)
    return toWebPath(localPath);
  }

  // S3 URL or key
  if (isS3Configured()) {
    const key = String(fileUrl || '').startsWith('s3://')
      ? String(fileUrl).replace(`s3://${BUCKET_NAME}/`, '')
      : String(fileUrl || '');
    if (!key) throw new Error('No file reference provided.');

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    return await getSignedUrl(getS3Client(), command, { expiresIn });
  }

  throw new Error('File not available for download.');
}

/**
 * Open a stored object for same-origin streaming through an API response.
 * This avoids exposing a presigned cross-origin URL to browser fetch(), which
 * requires CORS rules on the S3-compatible bucket.
 */
export async function openDownloadStream(fileUrl) {
  const localPath = toLocalPath(fileUrl);
  if (localPath) {
    if (!fs.existsSync(localPath)) throw new Error('File not found in local storage.');
    const stat = fs.statSync(localPath);
    return {
      body: fs.createReadStream(localPath),
      contentLength: stat.size,
      contentType: 'application/octet-stream'
    };
  }

  if (!isS3Configured()) throw new Error('File not available for download.');
  const key = String(fileUrl || '').startsWith('s3://')
    ? String(fileUrl).replace(`s3://${BUCKET_NAME}/`, '')
    : String(fileUrl || '').replace(/^\/+/, '');
  if (!key) throw new Error('No file reference provided.');

  const response = await getS3Client().send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
  return {
    body: response.Body,
    contentLength: response.ContentLength,
    contentType: response.ContentType || 'application/octet-stream'
  };
}

/**
 * Delete a file (S3 or local).
 * @param {string} fileUrl - stored s3:// URL or /uploads/... path
 */
export async function deleteFromS3(fileUrl) {
  const localPath = toLocalPath(fileUrl);
  if (localPath) {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log(`[Storage Service] Deleted local file: ${localPath}`);
      // Best-effort removal of empty parent dirs
      try {
        let dir = path.dirname(localPath);
        while (dir.startsWith(UPLOAD_DIR) && dir !== UPLOAD_DIR && fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
          dir = path.dirname(dir);
        }
      } catch (_) {}
    }
    return;
  }

  if (isS3Configured()) {
    const key = String(fileUrl || '').startsWith('s3://')
      ? String(fileUrl).replace(`s3://${BUCKET_NAME}/`, '')
      : String(fileUrl || '');
    if (!key) return;

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    await getS3Client().send(command);
    console.log(`[Storage Service] Deleted S3: ${key}`);
  }
}

/**
 * Check if a file exists (S3 or local).
 * @param {string} fileUrl
 * @returns {Promise<boolean>}
 */
export async function fileExistsInS3(fileUrl) {
  const localPath = toLocalPath(fileUrl);
  if (localPath) return fs.existsSync(localPath);

  if (isS3Configured()) {
    try {
      const key = String(fileUrl || '').startsWith('s3://')
        ? String(fileUrl).replace(`s3://${BUCKET_NAME}/`, '')
        : String(fileUrl || '');
      const command = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
      await getS3Client().send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') return false;
      throw error;
    }
  }
  return false;
}

/**
 * Get file metadata (S3 or local).
 * @param {string} fileUrl
 * @returns {Promise<object>}
 */
export async function getFileMetadata(fileUrl) {
  const localPath = toLocalPath(fileUrl);
  if (localPath) {
    if (!fs.existsSync(localPath)) throw new Error('File not found in local storage.');
    const stat = fs.statSync(localPath);
    return {
      size: stat.size,
      contentType: 'application/octet-stream',
      lastModified: stat.mtime,
      metadata: {}
    };
  }

  if (isS3Configured()) {
    const key = String(fileUrl || '').startsWith('s3://')
      ? String(fileUrl).replace(`s3://${BUCKET_NAME}/`, '')
      : String(fileUrl || '');
    const command = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await getS3Client().send(command);
    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata
    };
  }

  throw new Error('File not found.');
}

export default {
  uploadToS3,
  getDownloadUrl,
  openDownloadStream,
  deleteFromS3,
  fileExistsInS3,
  getFileMetadata,
  generateS3Key,
  UPLOAD_DIR,
  isS3Configured
};

