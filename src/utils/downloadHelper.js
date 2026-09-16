import { apiFetch } from '../services/api';

// downloadHelper.js - Universal Instant File Downloader (AWS S3 & Server Storage)
export async function downloadDocumentFile(fileUrlOrName, customTitle) {
  const fileStr = String(fileUrlOrName || customTitle || 'Document.pdf').trim();
  if (!fileStr) {
    window.alert('No file reference provided');
    return;
  }

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
      const errorMsg = payload.error || 'Document is not available for download.';
      console.error('[Download Error]', errorMsg, payload.details);
      window.alert(errorMsg + '\n\nThis may happen if:\n- The file was never uploaded\n- The file was deleted\n- Storage configuration is incorrect');
      return;
    }
    const blob = await response.blob();
    
    // Check if blob is empty or very small (likely corrupted)
    if (blob.size < 100) {
      console.error('[Download Error] Downloaded file is too small (likely corrupted):', blob.size, 'bytes');
      window.alert('Downloaded file appears to be empty or corrupted. Please contact support.');
      return;
    }
    
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    
    console.log('[Download Success]', filename, `(${(blob.size / 1024).toFixed(2)} KB)`);
  } catch (error) {
    console.error('[Download Error]', error);
    window.alert('Failed to download document: ' + error.message);
  }
}
