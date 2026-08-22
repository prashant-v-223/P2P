import { apiFetch } from '../services/api';

// downloadHelper.js - Universal Instant File Downloader (AWS S3 & Server Storage)
export async function downloadDocumentFile(fileUrlOrName, customTitle) {
  const fileStr = String(fileUrlOrName || customTitle || 'Document.pdf').trim();
  if (!fileStr) return;

  // Extract extension from file string if available
  let fileExt = '';
  const dotIdx = fileStr.lastIndexOf('.');
  if (dotIdx !== -1 && dotIdx > fileStr.lastIndexOf('/')) {
    fileExt = fileStr.slice(dotIdx);
  }

  let filename = fileStr.split('/').pop() || customTitle || 'document';
  if (customTitle && fileExt && !customTitle.toLowerCase().endsWith(fileExt.toLowerCase())) {
    filename = `${customTitle}${fileExt}`;
  }

  // 1) Handle Data URIs or Blob URIs directly
  if (fileStr.startsWith('data:') || fileStr.startsWith('blob:')) {
    const a = document.createElement('a');
    a.href = fileStr;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 2) Direct Backend File Streaming Endpoint (/api/p2p/download-file)
  // Triggers native browser attachment download immediately without async gesture blocking
  const downloadUrl = `/api/p2p/download-file?fileUrl=${encodeURIComponent(fileStr)}&name=${encodeURIComponent(filename)}`;
  
  try {
    const response = await apiFetch(downloadUrl);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Document is not available for download.');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    window.alert(error.message);
  }
}
