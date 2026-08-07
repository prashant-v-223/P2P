// downloadHelper.js - Universal Instant File Downloader (AWS S3 & Server Storage)
export function downloadDocumentFile(fileUrlOrName, customTitle) {
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
  
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
