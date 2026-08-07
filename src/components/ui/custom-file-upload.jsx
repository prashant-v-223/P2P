import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

export function CustomFileUpload({
  value,
  onChange,
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx',
  multiple = false,
  label,
  required = false,
  error,
  helperText,
  disabled = false
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const processUpload = async (rawFiles) => {
    const fileList = multiple ? Array.from(rawFiles) : [rawFiles[0]];
    setUploading(true);

    try {
      const processedFiles = await Promise.all(fileList.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folder', 'documents');

          const res = await apiFetch('/api/p2p/upload-file', {
            method: 'POST',
            body: formData
          });

          if (res && res.ok) {
            const data = await res.json();
            file.fileUrl = data.fileUrl || data.fileName;
            file.s3Key = data.fileName;
            file.uploaded = true;
          }
        } catch (err) {
          console.warn('[FileUpload] Cloud storage upload warning:', err);
        }
        return file;
      }));

      const finalVal = multiple ? processedFiles : processedFiles[0];
      onChange(finalVal);
    } catch (err) {
      console.error('[FileUpload] Upload error:', err);
      onChange(multiple ? fileList : fileList[0]);
    } finally {
      setUploading(false);
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
    if (multiple && Array.isArray(value)) {
      onChange(value.filter((_, idx) => idx !== indexToRemove));
    } else {
      onChange(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filesArray = multiple ? (Array.isArray(value) ? value : []) : (value ? [value] : []);

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
        multiple={multiple}
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
            <span className="text-[#0d7676]">Uploading file to AWS S3 Storage...</span>
          ) : (
            <><span className="text-[#0d7676] hover:underline">Click to upload</span> or drag and drop</>
          )}
        </p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
          Supports PDF, JPG, PNG, DOCX, XLSX (Max 25MB)
        </p>
      </div>

      {/* Uploaded File Badges */}
      {filesArray.length > 0 && (
        <div className="space-y-2 pt-1">
          {filesArray.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between p-2.5 rounded-xl border border-teal-200 bg-teal-50/60 text-xs font-bold text-slate-800 shadow-2xs"
            >
              <div className="flex items-center gap-2.5 truncate">
                <FileText className="w-4 h-4 text-[#0d7676] shrink-0" />
                <span className="truncate max-w-[240px] sm:max-w-[320px] font-mono text-slate-900">{file.name}</span>
                {file.size && (
                  <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {file.uploaded ? 'Uploaded to S3' : 'Ready'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
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
