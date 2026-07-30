import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../services/api';

export const fetchWorkflows = createAsyncThunk(
  'workflows/fetchWorkflows',
  async (queryString = '', { rejectWithValue }) => {
    try {
      const res = await apiFetch(`/api/workflows${queryString ? `?${queryString}` : ''}`);
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createWorkflowSlab = createAsyncThunk(
  'workflows/createWorkflowSlab',
  async (slabData, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch('/api/workflows', {
        method: 'POST',
        body: JSON.stringify(slabData)
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchWorkflows());
      return data.slab;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateWorkflowSlab = createAsyncThunk(
  'workflows/updateWorkflowSlab',
  async ({ id, payload }, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch(`/api/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchWorkflows());
      return data.slab;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteWorkflowSlab = createAsyncThunk(
  'workflows/deleteWorkflowSlab',
  async (id, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch(`/api/workflows/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchWorkflows());
      return id;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const workflowsSlice = createSlice({
  name: 'workflows',
  initialState: {
    slabs: [],
    loading: false,
    error: null,
    categoryFilter: 'All',
    searchQuery: '',
    pagination: {
      total: 0,
      page: 1,
      size: 10,
      totalPages: 1
    }
  },
  reducers: {
    setCategoryFilter: (state, action) => {
      state.categoryFilter = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkflows.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWorkflows.fulfilled, (state, action) => {
        state.loading = false;
        state.slabs = action.payload.slabs;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          size: action.payload.size,
          totalPages: action.payload.totalPages
        };
      })
      .addCase(fetchWorkflows.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { setCategoryFilter, setSearchQuery } = workflowsSlice.actions;
export default workflowsSlice.reducer;
