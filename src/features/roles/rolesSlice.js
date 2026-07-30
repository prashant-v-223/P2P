import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../services/api';

export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiFetch('/api/roles');
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      return data.roles;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const saveRolePermissions = createAsyncThunk(
  'roles/saveRolePermissions',
  async ({ roleId, permissions }, { rejectWithValue, dispatch }) => {
    try {
      const res = await apiFetch(`/api/roles/${roleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions })
      });
      const data = await res.json();
      if (!res.ok) return rejectWithValue(data.error);
      dispatch(fetchRoles());
      return data.role;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const rolesSlice = createSlice({
  name: 'roles',
  initialState: {
    roles: [],
    selectedRoleId: null,
    loading: false,
    saving: false,
    successToast: ''
  },
  reducers: {
    selectRole: (state, action) => {
      state.selectedRoleId = action.payload;
    },
    togglePermission: (state, action) => {
      const { roleId, moduleKey, actionKey } = action.payload;
      const role = state.roles.find(r => r.id === roleId);
      if (role && role.permissions[moduleKey]) {
        const current = role.permissions[moduleKey];
        if (current.includes(actionKey)) {
          role.permissions[moduleKey] = current.filter(a => a !== actionKey);
        } else {
          role.permissions[moduleKey] = [...current, actionKey];
        }
      }
    },
    clearRolesToast: (state) => {
      state.successToast = '';
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = action.payload;
        if (!state.selectedRoleId && action.payload.length > 0) {
          state.selectedRoleId = action.payload[0].id;
        }
      })
      .addCase(saveRolePermissions.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveRolePermissions.fulfilled, (state) => {
        state.saving = false;
        state.successToast = 'Permissions saved successfully!';
      });
  }
});

export const { selectRole, togglePermission, clearRolesToast } = rolesSlice.actions;
export default rolesSlice.reducer;
