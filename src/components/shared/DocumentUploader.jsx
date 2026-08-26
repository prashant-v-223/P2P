import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Upload, X, FileText, Loader2, Download, Trash2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';

import { downloadDocumentFile } from '../../utils/downloadHelper';

export default function DocumentUploader({ 
  documentableType, 
  documentableId, 
  documentType = 'other',
  filterDocumentType = null,
  onUploadComplete,
  onDocumentsChange,
  multiple = false,
  existingDocuments = [],
  readOnly = false
}) {
  const { showToast } = useToast();
  const { user } = useSelector((s) => s.auth || {});
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState(existingDocuments);

  const canDeleteDoc = (doc) => {
    if (readOnly) return false;
    if (!user) return true;
    const isUploader = (
      user.id === doc.uploadedBy ||
      user.email === doc.uploadedBy ||
      user.name === doc.uploadedBy
    );
    const isAdmin = ['Admin', 'Super Admin', 'admin'].includes(user?.role);
    return isUploader || isAdmin;
  };

  const performUpload = async (filesToUpload) => {
    if (!filesToUpload || !filesToUpload.length) return;
    if (!documentableType || !documentableId) {
      return showToast({ title: 'Configuration Error', description: 'Missing documentableType or documentableId', type: 'error' });
    }

    setUploading(true);

    try {
      const formData = new FormData();

      if (multiple && filesToUpload.length > 1) {
        filesToUpload.forEach(file => {
          formData.append('files', file);
        });
        formData.append('documentType', documentType);
        formData.append('documentableType', documentableType);
        formData.append('documentableId', documentableId);

        const res = await apiFetch('/api/documents/upload-multiple', {
          method: 'POST',
          body: formData
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');

        showToast({
          title: 'Upload Complete',
          description: `${json.data.uploaded.length} document(s) uploaded successfully`,
          type: 'success'
        });

        if (onUploadComplete) onUploadComplete(json.data.uploaded);
        await loadDocuments();
      } else {
        const file = filesToUpload[0];
        formData.append('file', file);
        formData.append('title', file.name);
        formData.append('documentType', documentType);
        formData.append('documentableType', documentableType);
        formData.append('documentableId', documentableId);

        const res = await apiFetch('/api/documents/upload', {
          method: 'POST',
          body: formData
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');

        showToast({
          title: 'Upload Complete',
          description: `${json.data.fileName} uploaded successfully`,
          type: 'success'
        });

        if (onUploadComplete) onUploadComplete([json.data]);
        await loadDocuments();
      }
    } catch (error) {
      showToast({ title: 'Upload Failed', description: error.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      await performUpload(files);
    }
    e.target.value = '';
  };

  const loadDocuments = async () => {
    try {
      const res = await apiFetch(`/api/documents?documentableType=${documentableType}&documentableId=${documentableId}`);
      const json = await res.json();
      let apiDocs = json.success && Array.isArray(json.data) ? json.data : [];
      
      if (filterDocumentType) {
        apiDocs = apiDocs.filter(d => d.documentType === filterDocumentType);
      }

      let combined = [...(existingDocuments || []), ...apiDocs];
      if (filterDocumentType) {
        combined = combined.filter(d => d.documentType === filterDocumentType || !d.documentType);
      }

      const seen = new Set();
      const uniqueDocs = [];
      for (const d of combined) {
        const key = d.documentId || d.fileUrl || d.fileName;
        if (key && !seen.has(key)) {
          seen.add(key);
          uniqueDocs.push(d);
        }
      }
      setDocuments(uniqueDocs);
      if (onDocumentsChange) onDocumentsChange(uniqueDocs);
    } catch (error) {
      console.error('Failed to load documents:', error);
      if (existingDocuments?.length > 0) setDocuments(existingDocuments);
    }
  };

  const handleDownload = async (doc) => {
    try {
      if (doc.documentId) {
        const res = await apiFetch(`/api/documents/${doc.documentId}/download`);
        const json = await res.json();
        if (res.ok && json.success && json.data?.downloadUrl) {
          window.open(json.data.downloadUrl, '_blank');
          return;
        }
      }

      if (doc.fileUrl) {
        if (doc.fileUrl.startsWith('http://') || doc.fileUrl.startsWith('https://') || doc.fileUrl.startsWith('/uploads/')) {
          window.open(doc.fileUrl, '_blank');
          return;
        }

        const res = await apiFetch(`/api/documents/resolve-url?fileUrl=${encodeURIComponent(doc.fileUrl)}`);
        const json = await res.json();
        if (res.ok && json.success && json.downloadUrl) {
          window.open(json.downloadUrl, '_blank');
          return;
        }
      }

      downloadDocumentFile(doc.fileName || doc.originalName || doc.title || 'Document.pdf');
    } catch (error) {
      console.error('Download error:', error);
      downloadDocumentFile(doc.fileName || doc.originalName || doc.title || 'Document.pdf');
    }
  };

  const handleDelete = async (doc) => {
    if (readOnly) return;
    if (!window.confirm(`Delete ${doc.fileName}?`)) return;

    try {
      const res = await apiFetch(`/api/documents/${doc.documentId}`, { method: 'DELETE' });
      const json = await res.json();
      
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete');

      showToast({ title: 'Deleted', description: 'Document deleted successfully', type: 'success' });
      await loadDocuments();
    } catch (error) {
      showToast({ title: 'Delete Failed', description: error.message, type: 'error' });
    }
  };

  React.useEffect(() => {
    if (documentableType && documentableId) {
      loadDocuments();
    }
  }, [documentableType, documentableId]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-4">
      {/* Upload Section (Hidden in readOnly view mode) */}
      {!readOnly && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6">
          <div className="flex flex-col items-center gap-4">
            <Upload className="h-10 w-10 text-slate-400" />
            
            <div className="text-center">
              <p className="text-sm font-bold text-slate-700">
                {multiple ? 'Upload Multiple Documents' : 'Upload Document'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 25 MB each)
              </p>
            </div>

            {uploading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-lg text-teal-700 font-bold text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-[#0d7676]" />
                <span>Uploading document...</span>
              </div>
            ) : (
              <label
                htmlFor={`file-upload-${documentableId || 'picker'}`}
                className="cursor-pointer rounded-lg border border-[#0d7676] bg-white px-4 py-2 text-xs font-bold text-[#0d7676] transition hover:bg-[#0d7676] hover:text-white"
              >
                Choose {multiple ? 'Files' : 'File'}
              </label>
            )}

            <input
              type="file"
              id={`file-upload-${documentableId || 'picker'}`}
              multiple={multiple}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.csv,.zip"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Documents List */}
      {documents.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Uploaded Documents</h4>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {documents.map((doc, idx) => (
              <div key={doc.documentId || doc.id || doc._id || `doc-${idx}`} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#0d7676]" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{doc.fileName}</p>
                    <p className="text-[10px] text-slate-500">
                      {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#0d7676] bg-white px-3 py-1.5 text-xs font-bold text-[#0d7676] transition hover:bg-[#0d7676] hover:text-white cursor-pointer"
                    title="Download / View document"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                  {!readOnly && canDeleteDoc(doc) && (
                    <button
                      onClick={() => handleDelete(doc)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 cursor-pointer"
                      title="Delete uploaded document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : readOnly && (
        <p className="text-xs text-slate-400 font-medium italic">No supporting documents uploaded.</p>
      )}
    </div>
  );
}
