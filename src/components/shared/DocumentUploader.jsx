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
  onUploadComplete,
  onDocumentsChange,
  multiple = false,
  existingDocuments = [],
  readOnly = false
}) {
  const { showToast } = useToast();
  const { user } = useSelector((s) => s.auth || {});
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      return showToast({ title: 'No files selected', description: 'Please select at least one file', type: 'error' });
    }

    if (!documentableType || !documentableId) {
      return showToast({ title: 'Configuration Error', description: 'Missing documentableType or documentableId', type: 'error' });
    }

    setUploading(true);

    try {
      const formData = new FormData();

      if (multiple) {
        selectedFiles.forEach(file => {
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

        setSelectedFiles([]);
        if (onUploadComplete) onUploadComplete(json.data.uploaded);

        await loadDocuments();
      } else {
        formData.append('file', selectedFiles[0]);
        formData.append('title', selectedFiles[0].name);
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

        setSelectedFiles([]);
        if (onUploadComplete) onUploadComplete([json.data]);

        await loadDocuments();
      }
    } catch (error) {
      showToast({ title: 'Upload Failed', description: error.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const res = await apiFetch(`/api/documents?documentableType=${documentableType}&documentableId=${documentableId}`);
      const json = await res.json();
      if (json.success) {
        const docs = json.data || [];
        setDocuments(docs);
        if (onDocumentsChange) onDocumentsChange(docs);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await apiFetch(`/api/documents/${doc.documentId}/download`);
      const json = await res.json();
      
      if (res.ok && json.success && json.data?.downloadUrl) {
        window.open(json.data.downloadUrl, '_blank');
      } else {
        downloadDocumentFile(doc.fileName || doc.title || 'Document.pdf');
      }
    } catch (error) {
      downloadDocumentFile(doc.fileName || doc.title || 'Document.pdf');
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

            <input
              type="file"
              id="file-upload"
              multiple={multiple}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.csv,.zip"
              onChange={handleFileSelect}
              className="hidden"
            />

            <label
              htmlFor="file-upload"
              className="cursor-pointer rounded-lg border border-[#0d7676] bg-white px-4 py-2 text-xs font-bold text-[#0d7676] transition hover:bg-[#0d7676] hover:text-white"
            >
              Choose {multiple ? 'Files' : 'File'}
            </label>

            {selectedFiles.length > 0 && (
              <div className="w-full space-y-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">{file.name}</span>
                      <span className="text-xs text-slate-400">({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0f766e] disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents List */}
      {documents.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Uploaded Documents</h4>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {documents.map((doc) => (
              <div key={doc.documentId} className="flex items-center justify-between p-3">
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
