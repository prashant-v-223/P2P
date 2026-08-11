import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPendingApprovals } from './features/approvals/approvalsSlice';
import { useRealtimeNotifications } from './hooks/useRealtimeNotifications';
import { Loader2 } from 'lucide-react';

import ProtectedRoute from './components/layout/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import OverviewDashboard from './components/dashboard/OverviewDashboard';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';

// Code-split dynamic route imports
const WorkflowsDashboard = lazy(() => import('./features/workflows/WorkflowsDashboard'));
const ExchangeRatesDashboard = lazy(() => import('./features/exchangeRates/ExchangeRatesDashboard'));
const RolesAndPermissionsView = lazy(() => import('./components/admin/RolesAndPermissionsView'));
const UserManagementView = lazy(() => import('./components/admin/UserManagementView'));
const PendingApprovalsView = lazy(() => import('./components/approvals/PendingApprovalsView'));
const UserProfilePage = lazy(() => import('./features/users/UserProfilePage'));
const VendorListView = lazy(() => import('./components/vendors/VendorListView'));
const VendorDetailsView = lazy(() => import('./components/vendors/VendorDetailsView'));
const VendorFormView = lazy(() => import('./components/vendors/VendorFormView'));

const PurchaseOrdersView = lazy(() => import('./features/p2p/PurchaseOrdersView'));
const PurchaseOrderDetailView = lazy(() => import('./features/p2p/PurchaseOrderDetailView'));
const AdvancePaymentsView = lazy(() => import('./features/p2p/AdvancePaymentsView'));
const CreateAdvancePaymentWizard = lazy(() => import('./features/p2p/CreateAdvancePaymentWizard'));
const AdvancePaymentDetailView = lazy(() => import('./features/p2p/AdvancePaymentDetailView'));
const EditAdvancePaymentView = lazy(() => import('./features/p2p/EditAdvancePaymentView'));

const InvoicePaymentsView = lazy(() => import('./features/p2p/InvoicePaymentsView'));
const InvoicePaymentDetailView = lazy(() => import('./features/p2p/InvoicePaymentDetailView'));
const InvoicePaymentFormView = lazy(() => import('./features/p2p/InvoicePaymentFormView'));
const CustomDutyView = lazy(() => import('./features/p2p/CustomDutyView'));
const CreateCustomDutyWizard = lazy(() => import('./features/p2p/CreateCustomDutyWizard'));
const LogisticsPaymentsView = lazy(() => import('./features/p2p/LogisticsPaymentsView'));
const CreateLogisticsPaymentWizard = lazy(() => import('./features/p2p/CreateLogisticsPaymentWizard'));

const RfqSourcingView = lazy(() => import('./features/p2p/RfqSourcingView'));
const RfqFormView = lazy(() => import('./features/p2p/RfqFormView'));
const RfqDetailView = lazy(() => import('./features/p2p/RfqDetailView'));
const CustomsBrokerPortalPage = lazy(() => import('./features/p2p/CustomsBrokerPortalPage'));
const EximReviewView = lazy(() => import('./features/p2p/EximReviewView'));
const BlInvoicesView = lazy(() => import('./features/p2p/BlInvoicesView'));

const CustomAgentsView = lazy(() => import('./features/p2p/CustomAgentsView'));
const CustomAgentFormView = lazy(() => import('./features/p2p/CustomAgentFormView'));
const LogisticsProvidersView = lazy(() => import('./features/p2p/LogisticsProvidersView'));
const LogisticsProviderFormView = lazy(() => import('./features/p2p/LogisticsProviderFormView'));
const SapIntegrationView = lazy(() => import('./components/admin/SapIntegrationView'));

const ApprovalEngineView = lazy(() => import('./features/p2p/ApprovalEngineView'));
const SettlementLedgerView = lazy(() => import('./features/p2p/SettlementLedgerView'));
const HierarchicalReportView = lazy(() => import('./components/admin/HierarchicalReportView'));

// Vendor Portal Imports
import { VendorProvider } from './features/vendorPortal/vendorContext';
import VendorLayout from './features/vendorPortal/VendorLayout';
import VendorLoginPage from './features/vendorPortal/VendorLoginPage';
import VendorDashboardPage from './features/vendorPortal/VendorDashboardPage';
import VendorUploadInvoicePage from './features/vendorPortal/VendorUploadInvoicePage';
import VendorAdvancesPage from './features/vendorPortal/VendorAdvancesPage';
import VendorProfilePage from './features/vendorPortal/VendorProfilePage';
import VendorInvoicesListPage from './features/vendorPortal/VendorInvoicesListPage';
import FreightRfqListPage from './features/vendorPortal/FreightRfqListPage';
import FreightRfqDetailPage from './features/vendorPortal/FreightRfqDetailPage';
import { FreightBlEntriesPage, FreightBlCreatePage, FreightBlDetailPage } from './features/vendorPortal/FreightBlFlowPage';

// Custom Agent Portal Imports
import { CustomAgentProvider } from './features/customAgentPortal/customAgentContext';
import CustomAgentLoginPage from './features/customAgentPortal/CustomAgentLoginPage';

import { getFirstAllowedRoute } from './lib/permissions';

function HomeRedirect() {
  const { user } = useSelector((state) => state.auth);
  const customPerms = user?.permissions || user?.customPermissions;
  const homePath = getFirstAllowedRoute(user?.role, customPerms);
  return <Navigate to={homePath} replace />;
}

export default function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // Sync token refresh & logout events across tabs/fetches
  useEffect(() => {
    const handleAuthRefreshed = (e) => {
      if (e.detail) {
        dispatch(updateSessionTokens(e.detail));
      }
    };
    const handleAuthLogout = () => {
      dispatch(logout());
    };

    window.addEventListener('rayzon_auth_refreshed', handleAuthRefreshed);
    window.addEventListener('rayzon_auth_logout', handleAuthLogout);

    return () => {
      window.removeEventListener('rayzon_auth_refreshed', handleAuthRefreshed);
      window.removeEventListener('rayzon_auth_logout', handleAuthLogout);
    };
  }, [dispatch]);

  // Automatic proactive token refresh every 10 minutes to maintain an infinite smooth session
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshTimer = setInterval(() => {
      dispatch(refreshAccessToken());
    }, 10 * 60 * 1000); // Proactively refresh token every 10 min (before 15m expiry)

    return () => clearInterval(refreshTimer);
  }, [isAuthenticated, dispatch]);

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
      Notification.requestPermission().catch(() => { }); // fire-and-forget
    }, 3000);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // Connect to real-time SSE stream for live approval events
  useRealtimeNotifications();

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <VendorProvider>
        <CustomAgentProvider>
          <Suspense fallback={
            <div className="py-24 flex flex-col items-center justify-center text-slate-500 text-xs font-semibold gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
              Loading module...
            </div>
          }>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
              <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
              {/* Dedicated Vendor & Customs Portal Routes */}
              <Route path="/vendor/login" element={<VendorLoginPage />} />
              <Route path="/vendor" element={<VendorLayout />}>
                <Route index element={<Navigate to="/vendor/dashboard" replace />} />
                <Route path="dashboard" element={<VendorDashboardPage />} />
                <Route path="invoices" element={<VendorInvoicesListPage />} />
                <Route path="invoices/upload" element={<VendorUploadInvoicePage />} />
                <Route path="advances" element={<VendorAdvancesPage />} />
                <Route path="profile" element={<VendorProfilePage />} />
                <Route path="rfqs" element={<FreightRfqListPage />} />
                <Route path="rfqs/:id" element={<FreightRfqDetailPage />} />
                <Route path="rfqs/:id/bl-entries" element={<FreightBlEntriesPage />} />
                <Route path="rfqs/:id/bl-entries/create" element={<FreightBlCreatePage />} />
                <Route path="rfqs/:id/bl-entries/:blId" element={<FreightBlDetailPage />} />
              </Route>

              {/* Customs Agent Portal Routes */}
              <Route path="/customs-agent/login" element={<CustomAgentLoginPage />} />
              <Route path="/customs/login" element={<CustomAgentLoginPage />} />
              <Route path="/customs/dashboard" element={<CustomsBrokerPortalPage />} />
              <Route path="/customs-agent/dashboard" element={<CustomsBrokerPortalPage />} />
              <Route path="/customs-agent/bl-entries" element={<CustomsBrokerPortalPage />} />
              <Route path="/customs-agent/bl-entries/:blId" element={<CustomsBrokerPortalPage />} />
              <Route path="/customs-agent/profile" element={<CustomsBrokerPortalPage />} />
              <Route path="/agent/bl-entries" element={<CustomsBrokerPortalPage />} />
              <Route path="/agent/bl-entries/:blId" element={<CustomsBrokerPortalPage />} />
              <Route path="/agent/profile" element={<CustomsBrokerPortalPage />} />

              {/* Protected Main Admin/User Portal Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<HomeRedirect />} />
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
                <Route path="p2p/custom-duty/create" element={<CreateCustomDutyWizard />} />
                <Route path="admin/custom-duty/create" element={<CreateCustomDutyWizard />} />

                <Route path="p2p/logistics-payments" element={<LogisticsPaymentsView />} />
                <Route path="p2p/logistics-payments/create" element={<CreateLogisticsPaymentWizard />} />
                <Route path="admin/logistics-payments/create" element={<CreateLogisticsPaymentWizard />} />

                {/* LOGISTICS Group Routes */}
                <Route path="p2p/rfq" element={<RfqSourcingView />} />
                <Route path="p2p/rfq-logistics" element={<RfqSourcingView />} />
                <Route path="admin/rfqs" element={<RfqSourcingView />} />
                <Route path="admin/rfqs/create" element={<RfqFormView />} />
                <Route path="p2p/rfqs/create" element={<RfqFormView />} />
                <Route path="admin/rfqs/:id" element={<RfqDetailView />} />
                <Route path="admin/rfqs/:id/edit" element={<RfqFormView />} />
                <Route path="p2p/exim-review" element={<EximReviewView />} />
                <Route path="p2p/exim-review/:blId" element={<EximReviewView />} />
                <Route path="admin/exim" element={<EximReviewView />} />
                <Route path="admin/exim/:blId" element={<EximReviewView />} />
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

                {/* MANAGEMENT / ADMIN: Custom Agents Routes */}
                <Route path="p2p/custom-agents" element={<CustomAgentsView />} />
                <Route path="management/custom-agents" element={<CustomAgentsView />} />
                <Route path="admin/custom-agents" element={<CustomAgentsView />} />
                <Route path="p2p/custom-agents/create" element={<CustomAgentFormView />} />
                <Route path="management/custom-agents/create" element={<CustomAgentFormView />} />
                <Route path="admin/custom-agents/create" element={<CustomAgentFormView />} />
                <Route path="p2p/custom-agents/:id/edit" element={<CustomAgentFormView />} />
                <Route path="management/custom-agents/:id/edit" element={<CustomAgentFormView />} />
                <Route path="admin/custom-agents/:id/edit" element={<CustomAgentFormView />} />

                {/* MANAGEMENT / ADMIN: Logistics Providers Routes */}
                <Route path="p2p/logistics-providers" element={<LogisticsProvidersView />} />
                <Route path="management/logistics-providers" element={<LogisticsProvidersView />} />
                <Route path="admin/logistics-providers" element={<LogisticsProvidersView />} />
                <Route path="p2p/logistics-providers/create" element={<LogisticsProviderFormView />} />
                <Route path="management/logistics-providers/create" element={<LogisticsProviderFormView />} />
                <Route path="admin/logistics-providers/create" element={<LogisticsProviderFormView />} />
                <Route path="p2p/logistics-providers/:id/edit" element={<LogisticsProviderFormView />} />
                <Route path="management/logistics-providers/:id/edit" element={<LogisticsProviderFormView />} />
                <Route path="admin/logistics-providers/:id/edit" element={<LogisticsProviderFormView />} />

                <Route path="users" element={<UserManagementView />} />
                <Route path="admin/users" element={<UserManagementView />} />
                <Route path="roles" element={<RolesAndPermissionsView />} />
                <Route path="admin/roles" element={<RolesAndPermissionsView />} />
                <Route path="admin/hierarchy-report" element={<HierarchicalReportView />} />

                {/* SYSTEM Group Routes */}
                <Route path="p2p/sap-sync" element={<SapIntegrationView />} />
                <Route path="admin/sap-sync" element={<SapIntegrationView />} />
                <Route path="workflows" element={<WorkflowsDashboard />} />
                <Route path="admin/workflows" element={<WorkflowsDashboard />} />
                <Route path="exchange-rates" element={<ExchangeRatesDashboard />} />
                <Route path="admin/exchange-rates" element={<ExchangeRatesDashboard />} />
                <Route path="profile" element={<UserProfilePage />} />
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </Suspense>
        </CustomAgentProvider>
      </VendorProvider>
    </BrowserRouter>
  );
}
