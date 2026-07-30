import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPendingApprovals } from './features/approvals/approvalsSlice';

import ProtectedRoute from './components/layout/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import WorkflowsDashboard from './features/workflows/WorkflowsDashboard';
import ExchangeRatesDashboard from './features/exchangeRates/ExchangeRatesDashboard';
import RolesAndPermissionsView from './components/admin/RolesAndPermissionsView';
import UserManagementView from './components/admin/UserManagementView';
import PendingApprovalsView from './components/approvals/PendingApprovalsView';
import OverviewDashboard from './components/dashboard/OverviewDashboard';
import UserProfilePage from './features/users/UserProfilePage';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import VendorListView from './components/vendors/VendorListView';
import VendorDetailsView from './components/vendors/VendorDetailsView';
import VendorFormView from './components/vendors/VendorFormView';

// Vendor Portal Imports
import { VendorProvider } from './features/vendorPortal/vendorContext';
import VendorLayout from './features/vendorPortal/VendorLayout';
import VendorLoginPage from './features/vendorPortal/VendorLoginPage';
import VendorDashboardPage from './features/vendorPortal/VendorDashboardPage';
import VendorUploadInvoicePage from './features/vendorPortal/VendorUploadInvoicePage';
import VendorAdvancesPage from './features/vendorPortal/VendorAdvancesPage';
import VendorProfilePage from './features/vendorPortal/VendorProfilePage';
import VendorInvoicesListPage from './features/vendorPortal/VendorInvoicesListPage';

export default function App() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchPendingApprovals());
    }
  }, [isAuthenticated, dispatch]);

  return (
    <BrowserRouter>
      <VendorProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={isAuthenticated ? <Navigate to="/admin/workflows" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/admin/workflows" replace /> : <RegisterPage />} />

          {/* Dedicated Vendor Portal Routes */}
          <Route path="/vendor/login" element={<VendorLoginPage />} />
          <Route path="/vendor" element={<Navigate to="/vendor/dashboard" replace />} />
          <Route path="/vendor" element={<VendorLayout />}>
            <Route path="dashboard" element={<VendorDashboardPage />} />
            <Route path="invoices" element={<VendorInvoicesListPage />} />
            <Route path="invoices/upload" element={<VendorUploadInvoicePage />} />
            <Route path="advances" element={<VendorAdvancesPage />} />
            <Route path="profile" element={<VendorProfilePage />} />
          </Route>

          {/* Protected Main Admin/User Portal Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/workflows" replace />} />
            <Route path="dashboard" element={<OverviewDashboard />} />
            <Route path="admin/workflows" element={<WorkflowsDashboard />} />
            <Route path="admin/exchange-rates" element={<ExchangeRatesDashboard />} />
            <Route path="admin/users" element={<UserManagementView />} />
            <Route path="admin/roles" element={<RolesAndPermissionsView />} />
            <Route path="approvals" element={<PendingApprovalsView />} />
            <Route path="profile" element={<UserProfilePage />} />
            
            {/* Admin Vendor Management Routes */}
            <Route path="management/vendors" element={<VendorListView />} />
            <Route path="admin/vendors" element={<VendorListView />} />
            <Route path="admin/vendors/create" element={<VendorFormView />} />
            <Route path="admin/vendors/:id" element={<VendorDetailsView />} />
            <Route path="admin/vendors/:id/edit" element={<VendorFormView />} />

            <Route path="*" element={<Navigate to="/admin/workflows" replace />} />
          </Route>
        </Routes>
      </VendorProvider>
    </BrowserRouter>
  );
}
