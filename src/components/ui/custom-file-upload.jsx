import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { apiFetch } from '../../services/api';

export function CustomFileUpload({
  value,
  files,
  onChange,
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx',
  multiple = false,
  maxFiles = 10,
  label,
  required = false,
  error,
  helperText,
  disabled = false,
  onError
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  const actualValue = value !== undefined ? value : files;
  const isMultiple = multiple || maxFiles > 1 || Array.isArray(actualValue);
  const filesArray = isMultiple ? (Array.isArray(actualValue) ? actualValue : []) : (actualValue ? [actualValue] : []);

  const processUpload = async (rawFiles) => {
    if (!isMultiple && rawFiles.length !== 1) {
      onError?.('Please select exactly one file.');
      return;
    }
    const fileList = isMultiple ? Array.from(rawFiles) : [rawFiles[0]];
    const existingFiles = isMultiple && Array.isArray(actualValue) ? actualValue : [];
    if (isMultiple && existingFiles.length + fileList.length > maxFiles) {
      onError?.(`You can upload a maximum of ${maxFiles} files.`);
      return;
    }
    const acceptedExtensions = String(accept).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    const invalidFile = fileList.find((file) => {
      const extension = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
      return acceptedExtensions.length > 0 && !acceptedExtensions.includes(extension) && !acceptedExtensions.includes(file.type);
    });
    if (invalidFile) {
      onError?.(`${invalidFile.name} is not an accepted file type.`);
      return;
    }
    if (fileList.some((file) => file.size > 25 * 1024 * 1024)) {
      onError?.('Each file must not exceed 25 MB.');
      return;
    }
    onError?.('');
    setUploadCount(fileList.length);
    setUploading(true);

    try {
      const formData = new FormData();
      fileList.forEach((file) => formData.append(isMultiple ? 'files' : 'file', file));
      formData.append('folder', 'documents');

      const res = await apiFetch(isMultiple ? '/api/p2p/upload-files' : '/api/p2p/upload-file', {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'File upload failed.');

      const uploadedResults = isMultiple ? data.files : [data];
      const processedFiles = fileList.map((file, index) => {
        const uploaded = uploadedResults[index];
        if (!uploaded?.fileUrl) return file;
        file.fileUrl = uploaded.fileUrl;
        file.s3Key = uploaded.fileName;
        file.uploaded = true;
        return file;
      });

      const finalVal = isMultiple
        ? [...existingFiles, ...processedFiles].filter((file, index, filesArr) => (
            filesArr.findIndex((item) => (item.name || item.fileName) === (file.name || file.fileName) && item.size === file.size) === index
          ))
        : processedFiles[0];
      onChange?.(finalVal);
    } catch (err) {
      console.error('[FileUpload] Upload error:', err);
      onError?.(err.message || 'File upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadCount(0);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processUpload(e.target.files);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (disabled || uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUpload(e.dataTransfer.files);
    }
  };

  const removeFile = (indexToRemove) => {
    if (disabled || uploading) return;
    if (isMultiple && Array.isArray(actualValue)) {
      onChange?.(actualValue.filter((_, idx) => idx !== indexToRemove));
    } else {
      onChange?.(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytesOrStr) => {
    if (!bytesOrStr) return '';
    if (typeof bytesOrStr === 'string') return bytesOrStr;
    if (typeof bytesOrStr === 'number') {
      if (bytesOrStr < 1024) return `${bytesOrStr} B`;
      if (bytesOrStr < 1024 * 1024) return `${(bytesOrStr / 1024).toFixed(1)} KB`;
      return `${(bytesOrStr / (1024 * 1024)).toFixed(2)} MB`;
    }
    return '';
  };

  const resolveHref = (file) => {
    const url = file.fileUrl || file.url || file.s3Key || file.fileName;
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) return url;
    const token = (typeof window !== 'undefined' && (
      localStorage.getItem('rayzon_vendor_token') ||
      localStorage.getItem('rayzon_access_token') ||
      localStorage.getItem('rayzon_token')
    )) || '';
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `/api/documents/resolve-url?fileUrl=${encodeURIComponent(url)}&redirect=true${tokenParam}`;
  };

  return (
    <div className="space-y-1.5 font-sans">
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={isMultiple}
        disabled={disabled || uploading}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
          error
            ? 'border-rose-300 bg-rose-50/40 hover:bg-rose-50'
            : filesArray.length > 0
            ? 'border-teal-300 bg-teal-50/30 hover:bg-teal-50/60'
            : 'border-slate-200 bg-slate-50/60 hover:bg-teal-50/30 hover:border-teal-400'
        } ${disabled || uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="w-10 h-10 rounded-2xl bg-teal-100/80 text-teal-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
          {uploading ? <Loader2 className="w-5 h-5 text-[#0d7676] animate-spin" /> : <UploadCloud className="w-5 h-5 text-[#0d7676]" />}
        </div>

        <p className="text-xs font-bold text-slate-800">
          {uploading ? (
            <span className="text-[#0d7676]">Uploading {uploadCount > 1 ? `${uploadCount} files` : 'file'}...</span>
          ) : (
            <><span className="text-[#0d7676] hover:underline">Click to upload</span> or drag and drop</>
          )}
        </p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
          Accepted: {accept} (Max 25 MB){isMultiple ? '' : ' · One file only'}
        </p>
      </div>

      {/* Uploaded File Badges */}
      {filesArray.length > 0 && (
        <div className="space-y-2 pt-1">
          {filesArray.map((file, idx) => {
            const fileName = file.name || file.originalName || file.fileName || `Document ${idx + 1}`;
            const fileHref = resolveHref(file);
            const sizeFormatted = formatSize(file.size || file.fileSize);
            return (
              <div
                key={`${fileName}-${idx}`}
                className="flex items-center justify-between p-2.5 rounded-xl border border-teal-200 bg-teal-50/60 text-xs font-bold text-slate-800 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileText className="w-4 h-4 text-[#0d7676] shrink-0" />
                  <span className="truncate max-w-[220px] sm:max-w-[320px] font-mono text-slate-900">{fileName}</span>
                  {sizeFormatted && (
                    <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                      ({sizeFormatted})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {fileHref && (
                    <a
                      href={fileHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-[#0d7676] hover:bg-teal-100 rounded-lg transition"
                      title="View / Download File"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {file.uploaded || file.fileUrl ? 'Attached' : 'Ready'}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error ? (
        <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      ) : helperText ? (
        <p className="text-[11px] font-medium text-slate-400 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}
