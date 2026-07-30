import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../services/api';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiFetch('/api/users');
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createNewUser = createAsyncThunk(
  'users/createNewUser',
  async (userData, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchUsers());
      return data.user;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState: {
    usersList: [],
    totalUsers: 3420,
    searchQuery: '',
    loading: false,
    error: null
  },
  reducers: {
    setUserSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.usersList = action.payload.users;
        state.totalUsers = action.payload.totalUsers;
      });
  }
});

export const { setUserSearchQuery } = usersSlice.actions;
export default usersSlice.reducer;
