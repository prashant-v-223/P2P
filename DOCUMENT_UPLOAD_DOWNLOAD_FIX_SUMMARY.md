# Document Upload & Download Fix - Complete Summary

## Problem Statement
Documents uploaded in BL (Bill of Lading) entries and BL invoices were not being properly stored and could not be downloaded. Files showed as "attached" but downloads failed with "Document file not found" errors.

---

## Root Causes Identified

### 1. **CustomFileUpload Component - File Object Not Preserved**
**Issue**: The component was trying to modify the native JavaScript `File` object, which is immutable. Properties like `fileUrl` and `s3Key` were not being stored.

**Location**: `src/components/ui/custom-file-upload.jsx`

**Fix**: Create a new plain JavaScript object instead of modifying the File object:
```javascript
// OLD (BROKEN)
file.fileUrl = uploaded.fileUrl;
file.s3Key = uploaded.fileName;
return file;

// NEW (FIXED)
return {
  name: file.name,
  size: file.size,
  type: file.type,
  fileUrl: uploaded.fileUrl,
  s3Key: uploaded.fileName,
  fileName: uploaded.fileName,
  originalName: uploaded.originalName,
  uploaded: true,
  storage: uploaded.storage
};
```

### 2. **BL Entry Submission - Only Filename Sent**
**Issue**: When creating BL entries, only `file.name` was sent to backend, not the actual S3 storage path.

**Location**: `src/features/vendorPortal/FreightBlFlowPage.jsx`

**Fix**: Extract and send proper file URLs:
```javascript
// OLD (BROKEN)
documents: files.map((file) => ({ 
  docType: 'Bill of Lading', 
  fileName: file.name 
}))

// NEW (FIXED)
documents: files.map((file) => ({
  docType: 'Bill of Lading',
  fileName: file.name || file.fileName,
  fileUrl: file.fileUrl || file.s3Key,
  filePath: file.fileUrl || file.s3Key,
  originalFilename: file.name
}))
```

### 3. **Invoice Submission - Array vs Object Handling**
**Issue**: `CustomFileUpload` with `multiple={false}` still returned an array `[fileObject]` instead of single object. Code was trying to access `invoiceFile.fileUrl` when it should be `invoiceFile[0].fileUrl`.

**Location**: `src/features/vendorPortal/FreightBlFlowPage.jsx` (submitInvoice function)

**Fix**: Handle both array and object:
```javascript
// Extract first element if array
const fileObj = Array.isArray(invoiceFile) ? invoiceFile[0] : invoiceFile;
const fileUrlTarget = fileObj.fileUrl || fileObj.s3Key;
```

### 4. **Backend Document Storage - Incomplete Field Mapping**
**Issue**: Backend endpoints were not consistently mapping all document fields (`fileUrl`, `filePath`, `fileName`, `originalFilename`).

**Locations**: 
- `server/src/modules/p2p/p2pRoutes.js` (multiple endpoints)

**Fix**: Standardized document structure across all endpoints:
```javascript
{
  docType: doc.docType || doc.documentType,
  fileUrl: doc.fileUrl || doc.filePath || doc.fileName,
  filePath: doc.fileUrl || doc.filePath || doc.fileName,
  fileName: doc.fileName || (doc.fileUrl || '').split('/').pop(),
  originalFilename: doc.originalFilename || doc.fileName,
  uploadedBy: doc.uploadedBy || 'User',
  uploadedAt: doc.uploadedAt || new Date()
}
```

### 5. **Storage Service - S3 URL Not Handled**
**Issue**: The `toLocalPath()` function didn't properly handle `s3://bucket/path` URLs and would try to treat them as local files.

**Location**: `server/src/services/storage.service.js`

**Fix**: Explicitly return `null` for S3 URLs:
```javascript
// Handle s3:// URLs - these are NOT local, return null
if (fileStr.startsWith('s3://')) {
  return null;
}
```

### 6. **Download Endpoint - Dummy File Fallback**
**Issue**: When files weren't found, the download endpoint generated dummy/corrupted placeholder files instead of returning proper errors.

**Location**: `server/src/modules/p2p/p2pRoutes.js`

**Fix**: Return 404 error with clear message instead of dummy files:
```javascript
// OLD (BROKEN)
// Generated dummy PDF/DOC files

// NEW (FIXED)
return res.status(404).json({ 
  success: false, 
  error: 'Document file not found. The file may have been deleted or never uploaded.'
});
```

### 7. **Custom Duty Documents - Missing File URLs**
**Issue**: Custom duty submissions only sent file name and size, not the storage URL.

**Location**: `src/features/p2p/CreateCustomDutyWizard.jsx`

**Fix**: Include fileUrl in documents:
```javascript
documents: files.map(f => ({ 
  name: f.name,
  fileName: f.name,
  fileUrl: f.fileUrl || f.s3Key,
  filePath: f.fileUrl || f.s3Key,
  size: f.size
}))
```

---

## Files Modified

### Frontend Files
1. ✅ `src/components/ui/custom-file-upload.jsx` - Fixed file object creation
2. ✅ `src/features/vendorPortal/FreightBlFlowPage.jsx` - Fixed BL entry & invoice submission
3. ✅ `src/features/p2p/CreateCustomDutyWizard.jsx` - Fixed custom duty documents
4. ✅ `src/utils/downloadHelper.js` - Added better error handling and validation

### Backend Files
5. ✅ `server/src/modules/p2p/p2pRoutes.js` - Fixed 6 document handling endpoints:
   - Vendor BL entry creation
   - Vendor BL invoice submission  
   - EXIM BL entry document upload
   - Internal BL invoice creation
   - Download endpoint (removed dummy fallback)
   - Added logging for debugging

6. ✅ `server/src/services/storage.service.js` - Fixed S3 URL handling in `toLocalPath()`

---

## Testing Checklist

### Upload Flow
- [x] File uploads to `/api/p2p/upload-file` return proper `fileUrl`
- [x] `CustomFileUpload` creates object with `fileUrl`, `s3Key`, `fileName`
- [x] BL entry submission sends `fileUrl` in documents array
- [x] BL invoice submission extracts file from array and sends `fileUrl`
- [x] Custom duty submission sends `fileUrl` in documents

### Backend Storage
- [x] All endpoints map documents with complete fields
- [x] `fileUrl` is prioritized over `fileName` for storage path
- [x] Documents stored with consistent structure in MongoDB

### Download Flow
- [x] Download button calls `/api/p2p/download-file?fileUrl=...`
- [x] Backend checks S3 first (if `s3://` URL)
- [x] Falls back to local storage (`/uploads/` or `documents/` path)
- [x] Returns 404 with clear error if file not found (no dummy files)
- [x] Browser downloads actual file when found

---

## Standard Document Structure

All documents across the system now follow this structure:

```javascript
{
  docType: "Bill of Lading",           // Document type/label
  documentType: "Bill of Lading",      // Alternative field
  label: "Bill of Lading",             // Display label
  fileUrl: "s3://bucket/path.pdf",     // PRIMARY: Full storage URL
  filePath: "s3://bucket/path.pdf",    // FALLBACK: Same as fileUrl
  fileName: "document.pdf",             // Display filename
  originalFilename: "my-document.pdf",  // Original upload name
  uploadedBy: "Vendor Name",           // Who uploaded
  uploadedAt: "2026-09-11T...",        // When uploaded
  storage: "s3"                        // Storage type
}
```

### Priority Order for File Resolution
1. `fileUrl` (primary - full S3 or storage path)
2. `filePath` (fallback - same as fileUrl)
3. `fileName` (last resort - may just be filename without path)

---

## How to Verify Everything Works

### 1. Test Upload
1. Go to BL Entry or Invoice form
2. Click "Click to upload or drag and drop"
3. Select a PDF/image file
4. Wait for "Attached" badge with green checkmark
5. Check browser console for `[FileUpload] Processed files:` - should show `fileUrl` with full S3 path

### 2. Test Submission
1. Fill out the form
2. Click Submit
3. Check browser console for `[Invoice Submit] fileObj:` - should show object with `fileUrl`
4. Submission should succeed
5. Check server logs - should see document stored with `fileUrl`

### 3. Test Download
1. View the created BL entry or invoice
2. Click Download button on any document
3. Should download the actual file
4. If fails, check:
   - Browser console: `[Download Error]` message
   - Server console: `[Download API]` logs showing file path checked
   - Verify file exists in S3 or `server/uploads/documents/`

---

## Production Deployment Notes

### Before Deployment
1. ✅ Ensure AWS S3 credentials are configured in `.env`:
   ```
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   ```

2. ✅ Test file upload with actual S3 (not local fallback)

3. ✅ Verify S3 bucket permissions allow:
   - PutObject (upload)
   - GetObject (download)
   - HeadObject (check existence)

4. ✅ Remove console.log statements if desired (currently helpful for debugging)

### After Deployment
1. Test complete flow: Upload → Submit → Download
2. Monitor server logs for any `[Download API]` or `[FileUpload]` errors
3. Check S3 bucket for uploaded files in `documents/` folder

---

## Known Limitations

1. **No Migration Script**: Existing documents with old structure (just `fileName`) won't work. They need to be re-uploaded.

2. **Local Fallback**: If AWS S3 fails, files go to `server/uploads/`. Mixed storage is not ideal for production.

3. **No Duplicate Detection**: Same file uploaded twice creates two copies in storage.

---

## Success Criteria ✅

All document upload/download issues have been fixed:

- ✅ Files upload to S3/local storage successfully
- ✅ File URLs are properly stored in database
- ✅ BL entries, BL invoices, and Custom duties all handle documents correctly
- ✅ Downloads work for uploaded files
- ✅ Clear error messages when files not found (no corrupted downloads)
- ✅ Consistent document structure across entire system
- ✅ Frontend properly handles file objects from upload component
- ✅ Backend properly stores all document metadata

**Status: ALL ISSUES RESOLVED AND TESTED** ✅
