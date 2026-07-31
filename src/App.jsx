import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPendingApprovals } from './features/approvals/approvalsSlice';
import { useRealtimeNotifications } from './hooks/useRealtimeNotifications';

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

// P2P System Features matching exact user screenshot sidebar routes
import PurchaseOrdersView from './features/p2p/PurchaseOrdersView';
import PurchaseOrderDetailView from './features/p2p/PurchaseOrderDetailView';
import AdvancePaymentsView from './features/p2p/AdvancePaymentsView';
import CreateAdvancePaymentWizard from './features/p2p/CreateAdvancePaymentWizard';
import AdvancePaymentDetailView from './features/p2p/AdvancePaymentDetailView';
import EditAdvancePaymentView from './features/p2p/EditAdvancePaymentView';

import InvoicePaymentsView from './features/p2p/InvoicePaymentsView';
import InvoicePaymentDetailView from './features/p2p/InvoicePaymentDetailView';
import InvoicePaymentFormView from './features/p2p/InvoicePaymentFormView';
import CustomDutyView from './features/p2p/CustomDutyView';
import LogisticsPaymentsView from './features/p2p/LogisticsPaymentsView';

import RfqSourcingView from './features/p2p/RfqSourcingView';
import EximReviewView from './features/p2p/EximReviewView';
import BlInvoicesView from './features/p2p/BlInvoicesView';

import CustomAgentsView from './features/p2p/CustomAgentsView';
import LogisticsProvidersView from './features/p2p/LogisticsProvidersView';
import SapSyncView from './features/p2p/SapSyncView';

import ApprovalEngineView from './features/p2p/ApprovalEngineView';
import SettlementLedgerView from './features/p2p/SettlementLedgerView';

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
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // Initial fetch + live-refresh every 60 s so the sidebar badge stays current
  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(fetchPendingApprovals(user?.role));
    const interval = setInterval(() => {
      dispatch(fetchPendingApprovals(user?.role));
    }, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user?.role, dispatch]);

  // Request browser notification permission 3s after login
  // Only prompts if not yet decided (default state) — never asks twice
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return; // already granted or denied

    const timer = setTimeout(() => {
      Notification.requestPermission().catch(() => {}); // fire-and-forget
    }, 3000);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // Connect to real-time SSE stream for live approval events
  useRealtimeNotifications();

  return (
    <BrowserRouter>
      <VendorProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

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
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<OverviewDashboard />} />
            
            {/* PAYMENTS Group Routes */}
            <Route path="p2p/purchase-orders" element={<PurchaseOrdersView />} />
            <Route path="p2p/purchase-orders/:poId" element={<PurchaseOrderDetailView />} />
            <Route path="admin/purchase-orders/:poId" element={<PurchaseOrderDetailView />} />

            <Route path="p2p/advances" element={<AdvancePaymentsView />} />
            <Route path="p2p/advance-payments/create" element={<CreateAdvancePaymentWizard />} />
            <Route path="admin/advance-payments/create" element={<CreateAdvancePaymentWizard />} />
            <Route path="p2p/advance-payments/:id" element={<AdvancePaymentDetailView />} />
            <Route path="admin/advance-payments/:id" element={<AdvancePaymentDetailView />} />
            <Route path="p2p/advance-payments/:id/edit" element={<EditAdvancePaymentView />} />
            <Route path="admin/advance-payments/:id/edit" element={<EditAdvancePaymentView />} />

            <Route path="p2p/invoices" element={<InvoicePaymentsView />} />
            <Route path="p2p/invoice-payments" element={<InvoicePaymentsView />} />
            <Route path="admin/invoice-payments" element={<InvoicePaymentsView />} />

            <Route path="p2p/invoice-payments/create" element={<InvoicePaymentFormView />} />
            <Route path="admin/invoice-payments/create" element={<InvoicePaymentFormView />} />

            <Route path="p2p/invoice-payments/:id" element={<InvoicePaymentDetailView />} />
            <Route path="admin/invoice-payments/:id" element={<InvoicePaymentDetailView />} />

            <Route path="p2p/invoice-payments/:id/edit" element={<InvoicePaymentFormView />} />
            <Route path="admin/invoice-payments/:id/edit" element={<InvoicePaymentFormView />} />
            <Route path="p2p/custom-duty" element={<CustomDutyView />} />
            <Route path="p2p/logistics-payments" element={<LogisticsPaymentsView />} />

            {/* LOGISTICS Group Routes */}
            <Route path="p2p/rfq" element={<RfqSourcingView />} />
            <Route path="p2p/rfq-logistics" element={<RfqSourcingView />} />
            <Route path="p2p/exim-review" element={<EximReviewView />} />
            <Route path="p2p/bl-invoices" element={<BlInvoicesView />} />

            {/* APPROVALS & SETTLEMENT */}
            <Route path="approvals" element={<PendingApprovalsView />} />
            <Route path="p2p/approval-engine" element={<ApprovalEngineView />} />
            <Route path="p2p/settlement-ledger" element={<SettlementLedgerView />} />

            {/* MANAGEMENT Group Routes */}
            <Route path="vendors" element={<VendorListView />} />
            <Route path="management/vendors" element={<VendorListView />} />
            <Route path="admin/vendors" element={<VendorListView />} />

            <Route path="vendors/create" element={<VendorFormView />} />
            <Route path="management/vendors/create" element={<VendorFormView />} />
            <Route path="admin/vendors/create" element={<VendorFormView />} />

            <Route path="vendors/:id" element={<VendorDetailsView />} />
            <Route path="management/vendors/:id" element={<VendorDetailsView />} />
            <Route path="admin/vendors/:id" element={<VendorDetailsView />} />

            <Route path="vendors/:id/edit" element={<VendorFormView />} />
            <Route path="management/vendors/:id/edit" element={<VendorFormView />} />
            <Route path="admin/vendors/:id/edit" element={<VendorFormView />} />

            <Route path="p2p/custom-agents" element={<CustomAgentsView />} />
            <Route path="management/custom-agents" element={<CustomAgentsView />} />
            <Route path="p2p/logistics-providers" element={<LogisticsProvidersView />} />
            <Route path="management/logistics-providers" element={<LogisticsProvidersView />} />

            <Route path="users" element={<UserManagementView />} />
            <Route path="admin/users" element={<UserManagementView />} />
            <Route path="roles" element={<RolesAndPermissionsView />} />
            <Route path="admin/roles" element={<RolesAndPermissionsView />} />
            
            {/* SYSTEM Group Routes */}
            <Route path="p2p/sap-sync" element={<SapSyncView />} />
            <Route path="admin/sap-sync" element={<SapSyncView />} />
            <Route path="workflows" element={<WorkflowsDashboard />} />
            <Route path="admin/workflows" element={<WorkflowsDashboard />} />
            <Route path="exchange-rates" element={<ExchangeRatesDashboard />} />
            <Route path="admin/exchange-rates" element={<ExchangeRatesDashboard />} />
            <Route path="profile" element={<UserProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </VendorProvider>
    </BrowserRouter>
  );
}
