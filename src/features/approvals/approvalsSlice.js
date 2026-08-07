import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../services/api';

export const fetchPendingApprovals = createAsyncThunk(
  'approvals/fetchPendingApprovals',
  async (roleArg, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const role  = roleArg || state.auth.user?.role || 'Finance Lead';
      const params = new URLSearchParams({ role, scope: 'actionable' });

      const res  = await apiFetch(`/api/approvals/pending?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const processApprovalAction = createAsyncThunk(
  'approvals/processApprovalAction',
  async ({ id, action }, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `${id}:${String(action).toLowerCase()}` },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchPendingApprovals());
      return { id, action };
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
    loading: false,
    error: null
  },
  reducers: {
    setPendingCount: (state, action) => {
      state.pendingCount = Math.max(0, Number(action.payload) || 0);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPendingApprovals.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPendingApprovals.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingQueue = action.payload.approvals;
        state.pendingCount = action.payload.actionableCount ?? action.payload.total ?? action.payload.count ?? 0;
      });
  }
});

export default approvalsSlice.reducer;
export const { setPendingCount } = approvalsSlice.actions;
