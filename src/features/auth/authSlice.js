import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const initialAccessToken = localStorage.getItem('rayzon_access_token') || sessionStorage.getItem('rayzon_access_token') || localStorage.getItem('rayzon_token') || null;
const initialRefreshToken = localStorage.getItem('rayzon_refresh_token') || sessionStorage.getItem('rayzon_refresh_token') || null;
const storedUser = localStorage.getItem('rayzon_user') || sessionStorage.getItem('rayzon_user');
const initialUser = storedUser
  ? JSON.parse(storedUser)
  : null;

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ name, email, password, department, role }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, department, role })
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error || 'Registration failed');
      
      localStorage.setItem('rayzon_access_token', data.accessToken);
      localStorage.setItem('rayzon_refresh_token', data.refreshToken);
      localStorage.setItem('rayzon_user', JSON.stringify(data.user));
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password, twoFactorCode, rememberMe = true }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, twoFactorCode })
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error || 'Login failed');
      
      if (data.requiresTwoFactor) return data;
      const storage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;
      storage.setItem('rayzon_access_token', data.accessToken);
      storage.setItem('rayzon_refresh_token', data.refreshToken);
      storage.setItem('rayzon_user', JSON.stringify(data.user));
      otherStorage.removeItem('rayzon_access_token');
      otherStorage.removeItem('rayzon_refresh_token');
      otherStorage.removeItem('rayzon_user');
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const refreshAccessToken = createAsyncThunk(
  'auth/refreshAccessToken',
  async (_, { getState, rejectWithValue }) => {
    const refreshToken = getState().auth.refreshToken || localStorage.getItem('rayzon_refresh_token');
    if (!refreshToken) return rejectWithValue('No refresh token available');

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);

      localStorage.setItem('rayzon_access_token', data.accessToken);
      localStorage.setItem('rayzon_refresh_token', data.refreshToken);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const revokeAllSessions = createAsyncThunk(
  'auth/revokeAllSessions',
  async (_, { getState, rejectWithValue }) => {
    const token = getState().auth.accessToken || localStorage.getItem('rayzon_access_token');
    try {
      const res = await fetch('/api/auth/revoke-all-sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async ({ email }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ email, otpCode, newPassword }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode, newPassword })
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: initialUser,
    accessToken: initialAccessToken,
    refreshToken: initialRefreshToken,
    isAuthenticated: !!initialAccessToken, // STRICT Check: Requires actual token in localStorage!
    authMode: 'login',
    loading: false,
    error: null,
    forgotStep: 'email',
    resetMessage: '',
    demoOtp: ''
    ,twoFactorRequired: false
    ,twoFactorEmail: ''
  },
  reducers: {
    setAuthMode: (state, action) => {
      state.authMode = action.payload;
      state.error = null;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.authMode = 'login';
      localStorage.removeItem('rayzon_access_token');
      localStorage.removeItem('rayzon_refresh_token');
      localStorage.removeItem('rayzon_user');
      localStorage.removeItem('rayzon_token');
      sessionStorage.removeItem('rayzon_access_token');
      sessionStorage.removeItem('rayzon_refresh_token');
      sessionStorage.removeItem('rayzon_user');
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    updateCurrentUser: (state, action) => {
      state.user = action.payload;
      localStorage.setItem('rayzon_user', JSON.stringify(action.payload));
    },
    resetForgotStep: (state) => {
      state.forgotStep = 'email';
      state.resetMessage = '';
      state.demoOtp = '';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Registration failed';
      })
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.requiresTwoFactor) {
          state.twoFactorRequired = true;
          state.twoFactorEmail = action.payload.email;
          state.isAuthenticated = false;
          return;
        }
        state.isAuthenticated = true;
        state.twoFactorRequired = false;
        state.twoFactorEmail = '';
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Login failed';
      })
      // Refresh Token
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        state.isAuthenticated = false;
        state.accessToken = null;
        state.refreshToken = null;
        localStorage.removeItem('rayzon_access_token');
        localStorage.removeItem('rayzon_refresh_token');
        localStorage.removeItem('rayzon_user');
      })
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.forgotStep = 'otp';
        state.resetMessage = action.payload.message;
        state.demoOtp = action.payload.otpCode || '';
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Unable to generate reset code.';
      })
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.forgotStep = 'success';
        state.resetMessage = action.payload.message;
        state.demoOtp = '';
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Unable to reset password.';
      });
  }
});

export const { setAuthMode, logout, clearAuthError, updateCurrentUser, resetForgotStep } = authSlice.actions;
export default authSlice.reducer;
