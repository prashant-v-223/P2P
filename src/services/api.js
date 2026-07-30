// Centralized API Client Service with Automatic JWT Bearer Headers, Multi-Port Fallback & Silent Token Refresh

const getAccessToken = () => localStorage.getItem('rayzon_access_token') || sessionStorage.getItem('rayzon_access_token') || localStorage.getItem('rayzon_token');
const getRefreshToken = () => localStorage.getItem('rayzon_refresh_token') || sessionStorage.getItem('rayzon_refresh_token');

export const apiFetch = async (url, options = {}) => {
  const token = getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestOptions = {
    ...options,
    cache: options.cache || (options.method ? undefined : 'no-store'),
    headers
  };

  let res;
  try {
    res = await fetch(url, requestOptions);

    if (res.status === 404 && url.startsWith('/api')) {
      try {
        const directRes5000 = await fetch(`http://127.0.0.1:5000${url}`, requestOptions);
        if (directRes5000.ok || directRes5000.status < 400) return directRes5000;
      } catch (e) {}

      try {
        const directRes5001 = await fetch(`http://127.0.0.1:5001${url}`, requestOptions);
        if (directRes5001.ok || directRes5001.status < 400) return directRes5001;
      } catch (e) {}
    }
  } catch (netErr) {
    try {
      const directRes5000 = await fetch(`http://127.0.0.1:5000${url}`, requestOptions);
      if (directRes5000.ok || directRes5000.status < 400) return directRes5000;
    } catch (e) {}

    try {
      const directRes5001 = await fetch(`http://127.0.0.1:5001${url}`, requestOptions);
      if (directRes5001.ok || directRes5001.status < 400) return directRes5001;
    } catch (e) {}
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
        localStorage.setItem('rayzon_access_token', refreshData.accessToken);
        localStorage.setItem('rayzon_refresh_token', refreshData.refreshToken);

        headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
        res = await fetch(url, { ...requestOptions, headers });
      } else {
        localStorage.removeItem('rayzon_access_token');
        localStorage.removeItem('rayzon_refresh_token');
        localStorage.removeItem('rayzon_user');
      }
    } catch (err) {
      console.error('Silent token refresh failed:', err);
    }
  }

  return res;
};
