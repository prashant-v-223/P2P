// Centralized API Client Service with Automatic JWT Bearer Headers, Multi-Port Fallback & Silent Token Refresh

const getAccessToken = () => {
  const path = window.location.pathname;
  if (path.startsWith('/vendor')) {
    return localStorage.getItem('rayzon_vendor_token');
  }
  if (path.startsWith('/customs') || path.startsWith('/agent')) {
    return localStorage.getItem('rayzon_agent_token');
  }
  return localStorage.getItem('rayzon_access_token') ||
    sessionStorage.getItem('rayzon_access_token') ||
    localStorage.getItem('rayzon_token');
};
const getRefreshToken = () => {
  const path = window.location.pathname;
  if (path.startsWith('/vendor') || path.startsWith('/customs') || path.startsWith('/agent')) return null;
  return localStorage.getItem('rayzon_refresh_token') || sessionStorage.getItem('rayzon_refresh_token');
};

export const apiFetch = async (url, options = {}) => {
  const token = getAccessToken();
  const headers = { ...(options.headers || {}) };
  const body = options.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');

  if (!isFormData && !hasContentType && body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestOptions = {
    ...options,
    cache: options.cache || (options.method ? undefined : 'no-store'),
    headers
  };

  if (!isFormData && body !== undefined && body !== null && typeof body !== 'string' && !(body instanceof Blob) && !(body instanceof URLSearchParams)) {
    requestOptions.body = JSON.stringify(body);
  }

  let res;
  const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  let networkError = null;

  try {
    res = await fetch(url, requestOptions);

    if (res.status === 404 && url.startsWith('/api') && isLocalHost) {
      try {
        const directRes5001 = await fetch(`http://127.0.0.1:5001${url}`, requestOptions);
        if (directRes5001.ok || directRes5001.status < 400) return directRes5001;
      } catch (e) {}
    }
  } catch (netErr) {
    networkError = netErr;
    if (isLocalHost && url.startsWith('/api')) {
      try {
        const directRes5001 = await fetch(`http://127.0.0.1:5001${url}`, requestOptions);
        if (directRes5001.ok || directRes5001.status < 400) return directRes5001;
        res = directRes5001;
      } catch (e) {}
    }
  }

  if (!res) {
    // If request failed completely without a Response object, construct a standard Error response
    throw new Error(networkError?.message || 'Network request failed. Server unreachable.');
  }

  if (res && res.status === 401 && getRefreshToken()) {
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: getRefreshToken() })
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const storage = sessionStorage.getItem('rayzon_refresh_token') ? sessionStorage : localStorage;
        storage.setItem('rayzon_access_token', refreshData.accessToken);
        storage.setItem('rayzon_refresh_token', refreshData.refreshToken);
        if (refreshData.user) {
          storage.setItem('rayzon_user', JSON.stringify(refreshData.user));
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rayzon_auth_refreshed', { detail: refreshData }));
        }

        headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
        res = await fetch(url, { ...requestOptions, headers });
      } else {
        localStorage.removeItem('rayzon_access_token');
        localStorage.removeItem('rayzon_refresh_token');
        localStorage.removeItem('rayzon_user');
        sessionStorage.removeItem('rayzon_access_token');
        sessionStorage.removeItem('rayzon_refresh_token');
        sessionStorage.removeItem('rayzon_user');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rayzon_auth_logout'));
        }
      }
    } catch (err) {
      console.error('Silent token refresh failed:', err);
    }
  }

  return res;
};
