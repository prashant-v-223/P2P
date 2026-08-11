import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../services/api';

// ═══════════════════════════════════════════════════════════════════
// HIERARCHICAL APPROVALS - Updated for new hierarchy system
// ═══════════════════════════════════════════════════════════════════

export const fetchPendingApprovals = createAsyncThunk(
  'approvals/fetchPendingApprovals',
  async (_, { rejectWithValue }) => {
    try {
      // Use new hierarchical endpoint
      const res = await apiFetch('/api/approvals/pending');
      const data = await res.json();
      
      if (!res.ok) {
        return rejectWithValue(data.error || 'Failed to fetch approvals');
      }
      
      // The paginated approvals endpoint returns `approvals` and `total`.
      // Normalize it here so the shared sidebar/dashboard state never mistakes
      // the current page size (normally 10) for the full pending total.
      return {
        ...data,
        requests: data.requests || data.approvals || [],
        count: Number(data.total ?? data.count ?? 0)
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const processApprovalAction = createAsyncThunk(
  'approvals/processApprovalAction',
  async ({ id, action, remarks }, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Idempotency-Key': `${id}:${String(action).toLowerCase()}`
        },
        body: JSON.stringify({ action, remarks })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return rejectWithValue(data.error || 'Action failed');
      }
      
      // Refresh the list after action
      dispatch(fetchPendingApprovals());
      
      return { id, action, data };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const approvalsSlice = createSlice({
  name: 'approvals',
  initialState: {
    pendingQueue: [],
    pendingCount: 0,
    userInfo: null,           // User's hierarchy info
    loading: false,
    error: null,
    actionLoading: false,
    actionError: null
  },
  reducers: {
    setPendingCount: (state, action) => {
      state.pendingCount = Math.max(0, Number(action.payload) || 0);
    },
    clearError: (state) => {
      state.error = null;
      state.actionError = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch pending approvals
      .addCase(fetchPendingApprovals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPendingApprovals.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingQueue = action.payload.requests || [];
        state.pendingCount = action.payload.count || 0;
        state.userInfo = action.payload.userInfo || null;
        state.error = null;
      })
      .addCase(fetchPendingApprovals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to load approvals';
      })
      
      // Process approval action
      .addCase(processApprovalAction.pending, (state) => {
        state.actionLoading = true;
        state.actionError = null;
      })
      .addCase(processApprovalAction.fulfilled, (state) => {
        state.actionLoading = false;
        state.actionError = null;
      })
      .addCase(processApprovalAction.rejected, (state, action) => {
        state.actionLoading = false;
        state.actionError = action.payload || 'Action failed';
      });
  }
});

export default approvalsSlice.reducer;
export const { setPendingCount, clearError } = approvalsSlice.actions;
