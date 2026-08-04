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
    <div className={`space-y-3 ${className}`}>
      {/* Upload Drop Zone */}
      <label
        htmlFor="file-upload-input"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 py-7 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${dragging 
            ? 'border-teal-400 bg-teal-50' 
            : 'border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/20'
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
        <Upload className={`w-5 h-5 ${dragging ? 'text-teal-500' : 'text-slate-400'}`} />
        <div className="text-center">
          <p className="font-bold text-slate-700 text-xs">
            {dragging ? 'Drop files here' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {getAcceptedTypesLabel()} (Max {maxSize} MB each)
          </p>
        </div>
      </label>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''} Selected
          </p>
          <div className="space-y-1.5">
            {selectedFiles.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-teal-200 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-xs truncate">
                      {doc.name}
                    </p>
                    <p className="text-[9px] text-slate-400">{doc.size}</p>
                  </div>
                </div>
                {onFileRemove && (
                  <button
                    type="button"
                    onClick={() => onFileRemove(idx)}
                    className="w-6 h-6 rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center shrink-0 transition-colors ml-2"
                    title="Remove file"
                  >
                    <X className="w-3 h-3" />
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
