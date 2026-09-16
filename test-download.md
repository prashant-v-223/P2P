# BL Invoice Document Download Test

## Test Cases to Check

1. **Check Document Structure**
   - Open browser DevTools (F12)
   - Go to BL Invoices page
   - Click on an invoice to open details
   - In Console, type: `console.log(JSON.stringify(invoice, null, 2))`
   - Check if `documents` array has proper `fileUrl` or `filePath` values

2. **Check Network Request**
   - Open browser DevTools → Network tab
   - Click Download button on a document
   - Look for request to `/api/p2p/download-file`
   - Check the request URL parameters
   - Check the response status and error message

3. **Check Server Logs**
   - When download fails, check server console for errors
   - Look for `[Download API]` or `[Storage Service]` log messages

## Common Issues & Fixes

### Issue 1: Missing fileUrl/filePath
**Symptom**: Download button is disabled or nothing happens
**Fix**: Documents must have `fileUrl` or `filePath` property

### Issue 2: File not found in S3 or local storage
**Symptom**: 400 or 404 error "File not found"
**Fix**: Check if file actually exists in:
- AWS S3 bucket (if configured)
- `server/uploads/` directory (local fallback)

### Issue 3: Invalid file path
**Symptom**: 400 error "File path or name required"
**Fix**: Ensure document object has valid file reference

### Issue 4: CORS or authentication issues
**Symptom**: 401 or CORS errors in browser console
**Fix**: Check authentication token and CORS settings

## Quick Fix Commands

### Check if uploads directory exists
```bash
dir server\uploads
```

### Check S3 configuration
```bash
echo %AWS_ACCESS_KEY_ID%
echo %AWS_S3_BUCKET%
```

### View recent server logs
Check the terminal where you ran `npm run dev` or `npm start`
