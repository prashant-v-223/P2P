import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import workflowsReducer from '../features/workflows/workflowsSlice';
import exchangeRatesReducer from '../features/exchangeRates/exchangeRatesSlice';
import usersReducer from '../features/users/usersSlice';
import rolesReducer from '../features/roles/rolesSlice';
import approvalsReducer from '../features/approvals/approvalsSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workflows: workflowsReducer,
    exchangeRates: exchangeRatesReducer,
    users: usersReducer,
    roles: rolesReducer,
    approvals: approvalsReducer,
    notifications: notificationsReducer,
  },
});

