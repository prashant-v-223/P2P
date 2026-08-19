import React, { useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';

/**
 * Reusable File Upload Zone Component
 * Provides drag-and-drop and click-to-upload functionality
 * 
 * @param {Object} props
 * @param {boolean} props.multiple - Allow multiple file selection
 * @param {string} props.accept - Accepted file types (default: common document types)
 * @param {number} props.maxSize - Max file size in MB (default: 25)
 * @param {Function} props.onFilesSelected - Callback when files are selected
 * @param {Array} props.selectedFiles - Array of selected file objects
 * @param {Function} props.onFileRemove - Callback to remove a file
 * @param {string} props.className - Additional CSS classes
 */
export default function FileUploadZone({
  multiple = true,
  accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls,.csv,.zip',
  maxSize = 25,
  onFilesSelected,
  selectedFiles = [],
  onFileRemove,
  className = ''
}) {
  const [dragging, setDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    // Reset input to allow re-selecting the same file
    e.target.value = '';
  };

  const handleFiles = (files) => {
    const validFiles = files.filter(file => {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        alert(`File "${file.name}" exceeds ${maxSize}MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0 && onFilesSelected) {
      const fileObjects = validFiles.map(file => ({
        file,
        name: file.name,
        size: formatFileSize(file.size),
        sizeBytes: file.size
      }));
      onFilesSelected(fileObjects);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    if (bytes < k) return `${bytes} B`;
    if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
    return `${(bytes / (k * k)).toFixed(2)} MB`;
  };

  const getAcceptedTypesLabel = () => {
    const types = accept.split(',').map(t => t.replace('.', '').toUpperCase());
    if (types.length > 5) return `${types.slice(0, 5).join(', ')}, etc.`;
    return types.join(', ');
  };

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Upload Drop Zone */}
      <label
        htmlFor="file-upload-input"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 py-10 sm:py-8 px-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all shadow-2xs
          ${dragging 
            ? 'border-teal-500 bg-teal-50/80 scale-[1.01]' 
            : 'border-slate-200 bg-gradient-to-b from-slate-50/80 to-white hover:border-teal-400 hover:bg-teal-50/30'
          }`}
      >
        <input
          type="file"
          id="file-upload-input"
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          accept={accept}
        />
        
        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#0d7676] shadow-2xs">
          <Upload className={`w-6 h-6 transition-transform ${dragging ? 'scale-110 text-teal-600' : 'text-[#0d7676]'}`} />
        </div>

        <div className="text-center space-y-1">
          <p className="font-extrabold text-slate-800 text-sm sm:text-base">
            {dragging ? 'Drop files here to attach' : 'Drag & drop or click to browse files'}
          </p>
          <p className="text-xs text-slate-400 font-medium max-w-md">
            Supports {getAcceptedTypesLabel()} up to {maxSize} MB per file
          </p>
        </div>
      </label>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Attached Documents ({selectedFiles.length})
            </p>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              ✓ Ready for submit
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedFiles.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-teal-300 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-[#0d7676] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                      {doc.name}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{doc.size}</p>
                  </div>
                </div>
                {onFileRemove && (
                  <button
                    type="button"
                    onClick={() => onFileRemove(idx)}
                    className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 flex items-center justify-center shrink-0 transition-colors ml-2"
                    title="Remove document"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
