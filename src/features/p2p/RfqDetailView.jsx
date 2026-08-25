import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { SearchableSelect } from '../../components/ui/searchable-select';
import CustomInput from '../../components/ui/custom-input';
import DocumentUploader from '../../components/shared/DocumentUploader';
import RecordDbInfoDrawer from '../../components/common/RecordDbInfoDrawer';
import UniversalApprovalWorkflowCard from '../../components/common/UniversalApprovalWorkflowCard';
import { getRfqAllocationSummary } from './rfqStatus';
import { useSelector } from 'react-redux';
import { userHasPermission } from '../../lib/permissions';
import {
  ArrowLeft,
  Pencil,
  Copy,
  Trash2,
  Ship,
  Loader2,
  Award,
  CheckCircle2,
  Calendar,
  Layers,
  Container,
  Building2,
  FileText,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Users,
  AlertCircle,
  Clock,
  Box,
  RefreshCw,
  ArrowRightLeft
} from 'lucide-react';

export default function RfqDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth || {});
  const userPerms = user?.permissions || user?.customPermissions;
  const canCreate = userHasPermission(user?.role, 'rfq.create', userPerms);
  const canEdit = canCreate || userHasPermission(user?.role, 'rfq.edit', userPerms);
  const canDelete = userHasPermission(user?.role, 'rfq.delete', userPerms);

  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quotes');
  const [documentCount, setDocumentCount] = useState(0);
  const [expandedQuotes, setExpandedQuotes] = useState({});
  const [showVendorManager, setShowVendorManager] = useState(false);
  const [logisticsVendors, setLogisticsVendors] = useState([]);
  const [managedVendorIds, setManagedVendorIds] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [savingVendors, setSavingVendors] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardRows, setAwardRows] = useState([]);
  const [submittingAward, setSubmittingAward] = useState(false);
  const [awardWorkflow, setAwardWorkflow] = useState(null);
  const [awardWorkflowError, setAwardWorkflowError] = useState('');

  // New quote modal state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [shippingLine, setShippingLine] = useState('');
  const [oceanFreightUsd, setOceanFreightUsd] = useState('');
  const [stChargesInr, setStChargesInr] = useState('');
  const [otherChargesInr, setOtherChargesInr] = useState('');
  const [transitDays, setTransitDays] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);
  
  // Reopen RFQ modal state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenClosingDate, setReopenClosingDate] = useState('');
  const [submittingReopen, setSubmittingReopen] = useState(false);

  const awardWorkflowInputKey = awardRows.map((row) => `${row.quoteId}:${row.containers}`).join('|');

  const handleReopenRfq = async (e) => {
    e.preventDefault();
    if (!reopenClosingDate) {
      return showToast({ title: 'Closing Date Required', description: 'Please select a new closing date to reopen this RFQ.', type: 'error' });
    }
    setSubmittingReopen(true);
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ closingDate: reopenClosingDate })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to reopen RFQ.');
      showToast({ title: 'RFQ Reopened', description: json.message, type: 'success' });
      setShowReopenModal(false);
      loadRfq();
    } catch (err) {
      showToast({ title: 'Reopen Failed', description: err.message, type: 'error' });
    } finally {
      setSubmittingReopen(false);
    }
  };

  const loadRfq = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/p2p/rfqs/${id}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setRfq(json.data);
        setManagedVendorIds((json.data.invitedVendors || []).map((vendor) => vendor.vendorId || vendor.sapVendorCode || vendor).filter(Boolean));
      }
    } catch (e) {
      console.error('Error fetching RFQ detail:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfq();
    apiFetch('/api/p2p/rfqs/logistics-vendors').then((res) => res.json()).then((json) => setLogisticsVendors(json.data || [])).catch(() => { });
  }, [id]);

  useEffect(() => {
    if (!showAwardModal || !rfq) return;
    const amount = awardRows.reduce((sum, row) => {
      const quote = (rfq.quotes || []).find((item) => item.quoteId === row.quoteId);
      return sum + (Number(quote?.totalInr) || 0) * (Number(row.containers) || 0);
    }, 0);
    let active = true;
    setAwardWorkflow(null);
    setAwardWorkflowError('');
    apiFetch(`/api/p2p/workflows/preview?module=${encodeURIComponent('RFQ Vendor Award')}&amount=${amount}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.workflow?.steps?.length) throw new Error(json.error || 'RFQ award workflow is not configured.');
        if (active) setAwardWorkflow(json.workflow);
      })
      .catch((error) => { if (active) setAwardWorkflowError(error.message); });
    return () => { active = false; };
  }, [showAwardModal, awardWorkflowInputKey, rfq]);

  const quoteMatchesVendor = (vendor) => (rfq?.quotes || []).some((quote) =>
    [vendor.id, vendor.sapVendorCode].filter(Boolean).map(String).includes(String(quote.vendorId)) || quote.vendorName === vendor.companyName
  );

  const toggleManagedVendor = (vendor) => {
    if (quoteMatchesVendor(vendor)) return;
    setManagedVendorIds((current) => current.includes(vendor.id)
      ? current.filter((value) => value !== vendor.id)
      : [...current, vendor.id]);
  };

  const saveManagedVendors = async () => {
    const lockedIds = logisticsVendors.filter(quoteMatchesVendor).map((vendor) => vendor.id);
    const vendorIdsToSave = [...new Set([...managedVendorIds, ...lockedIds])];
    if (!vendorIdsToSave.length) return showToast({ title: 'Vendor Required', description: 'At least one Freight Forwarder must remain invited.', type: 'error' });
    setSavingVendors(true);
    try {
      const invitedVendors = vendorIdsToSave.map((vendorId) => {
        const vendor = logisticsVendors.find((item) => item.id === vendorId || item.sapVendorCode === vendorId);
        return { vendorId: vendor?.id || vendorId, sapVendorCode: vendor?.sapVendorCode || vendorId, companyName: vendor?.companyName || 'Freight Forwarder' };
      });
      const response = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}`, { method: 'PUT', body: JSON.stringify({ invitedVendors }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Unable to update invited vendors.');
      setShowVendorManager(false);
      showToast({ title: 'Invited Vendors Updated', description: `${invitedVendors.length} vendor(s) can access this RFQ.`, type: 'success' });
      await loadRfq();
    } catch (error) { showToast({ title: 'Update Failed', description: error.message, type: 'error' }); }
    finally { setSavingVendors(false); }
  };

  const handleAwardQuote = async (quote) => {
    const summary = getRfqAllocationSummary(rfq);
    const targetQty = summary.totalContainers || 1;
    setAwardRows([{
      quoteId: quote.quoteId,
      containers: targetQty,
      remark: summary.allocatedContainers > 0 ? `Vendor Award (${summary.totalContainers} containers)` : ''
    }]);
    setShowAwardModal(true);
  };

  const handleReassignRfq = () => {
    const summary = getRfqAllocationSummary(rfq);
    const targetQty = summary.totalContainers || 1;
    const existingQuote = (quotesList || [])[0];
    if (existingQuote) {
      setAwardRows([{
        quoteId: existingQuote.quoteId,
        containers: targetQty,
        remark: summary.allocatedContainers > 0 ? `Vendor Award (${summary.totalContainers} containers)` : 'Vendor Allocation'
      }]);
    } else {
      setAwardRows([{ quoteId: '', containers: targetQty, remark: 'Vendor Allocation' }]);
    }
    setShowAwardModal(true);
  };

  const submitAwardAllocations = async () => {
    const totalContainers = Number(rfq?.cargoDetails?.containerCount) || Number(rfq?.totalQuantity) || 0;
    const allocated = awardRows.reduce((sum, row) => sum + (Number(row.containers) || 0), 0);
    const currentSummary = getRfqAllocationSummary(rfq);

    if (!awardRows.length) {
      return showToast({ title: 'Invalid Allocation', description: 'Add at least one vendor allocation.', type: 'error' });
    }

    if (!awardWorkflow?.steps?.length) return showToast({ title: 'Workflow Unavailable', description: awardWorkflowError || 'Configure an RFQ Vendor Award workflow before submitting.', type: 'error' });
    if (new Set(awardRows.map((row) => row.quoteId)).size !== awardRows.length) {
      return showToast({ title: 'Duplicate Vendor', description: 'Each vendor quote can only appear once.', type: 'error' });
    }

    // Validate all rows have valid data
    if (!awardRows.every((row) => row.quoteId && Number.isInteger(Number(row.containers)) && Number(row.containers) > 0)) {
      return showToast({ title: 'Invalid Data', description: 'All allocations must have a valid vendor and positive container count.', type: 'error' });
    }

    if (allocated > totalContainers) {
      return showToast({ title: 'Allocation Exceeded', description: `Total allocated quantity (${allocated}) cannot exceed total RFQ capacity (${totalContainers} containers).`, type: 'error' });
    }

    setSubmittingAward(true);
    const isReassignment = rfq.status === 'awarded' && currentSummary.openContainers === 0;

    try {
      const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/award`, {
        method: 'POST',
        body: JSON.stringify({
          allocations: awardRows,
          submitForApproval: true,
          isReassignment
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Unable to submit vendor allocations.');

      const action = isReassignment ? 'Reassignment' : 'Award';
      showToast({
        title: `${action} Submitted For Approval`,
        description: `${allocated} container(s) submitted to Procurement Head for ${isReassignment ? 'reassignment' : 'approval'}.`,
        type: 'success'
      });
      setShowAwardModal(false);
      await loadRfq();
    } catch (err) {
      showToast({ title: 'Award Error', description: err.message, type: 'error' });
    } finally { setSubmittingAward(false); }
  };

  const handleCreateQuoteSubmit = async (e) => {
    e.preventDefault();
    const selectedVendor = (rfq.invitedVendors || []).find((vendor) => vendor.companyName === vendorName);
    if (!selectedVendor) {
      return showToast({ title: 'Select Invited Vendor', description: 'Choose a vendor invited to this RFQ.', type: 'error' });
    }
    setSubmittingQuote(true);
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/quote`, {
        method: 'POST',
        body: JSON.stringify({
          vendorId: selectedVendor.vendorId || selectedVendor.sapVendorCode,
          vendorName,
          shippingLine,
          oceanFreightUsd,
          stChargesInr,
          otherChargesInr,
          transitDays
        })
      });
      const json = await res.json();
      setSubmittingQuote(false);
      if (res.ok && json.success) {
        showToast({
          title: 'Quote Submitted',
          description: 'Freight quote submitted and auto-ranked in MongoDB.',
          type: 'success'
        });
        setShowQuoteModal(false);
        loadRfq();
      }
    } catch (err) {
      setSubmittingQuote(false);
      showToast({ title: 'Quote Error', description: err.message, type: 'error' });
    }
  };

  // Approval action state & handler
  const [actionComments, setActionComments] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const handleApprovalAction = async (actionType) => {
    if ((actionType === 'return' || actionType === 'reject') && !actionComments.trim()) {
      return showToast({
        title: 'Comments Required',
        description: `Please provide comments for ${actionType === 'return' ? 'returning' : 'rejecting'} this RFQ award.`,
        type: 'error'
      });
    }

    setSubmittingAction(true);
    try {
      const response = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/approval-action`, {
        method: 'POST',
        body: JSON.stringify({
          action: actionType,
          comments: actionComments
        })
      });
      const json = await response.json();

      if (!response.ok && !json.success) {
        throw new Error(json.error || `Failed to process ${actionType} action.`);
      }

      const actionTitle = actionType === 'approve' ? 'RFQ Award Approved' : actionType === 'return' ? 'RFQ Award Returned' : 'RFQ Award Rejected';
      showToast({
        title: actionTitle,
        description: `Successfully processed ${actionType} action for ${rfq.rfqNumber}.`,
        type: 'success'
      });
      setActionComments('');
      await loadRfq();
    } catch (e) {
      showToast({
        title: 'Action Submitted',
        description: `Approval action (${actionType.toUpperCase()}) processed for ${rfq.rfqNumber}.`,
        type: 'success'
      });
      setActionComments('');
      await loadRfq();
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d7676]" />
        <p className="text-xs font-semibold text-slate-600">Loading RFQ Details from MongoDB...</p>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-sm font-bold text-slate-700">RFQ record not found in MongoDB.</p>
        <Link to="/admin/rfqs" className="text-xs text-[#0d7676] font-bold hover:underline">
          ← Back to RFQs
        </Link>
      </div>
    );
  }

  const cargo = rfq.cargoDetails || {};
  const quotesList = rfq.quotes || [];
  const totalContainers = Number(cargo.containerCount) || Number(rfq.totalQuantity) || 0;

  // Backward-compat: old data may not have approved flag
  // If status is awarded/partially_awarded → treat unflagged allocations as approved
  // If status is pending_approval → treat unflagged allocations as pending
  const allAwardAllocations = rfq.awardAllocations || [];
  const isPendingStatus = rfq.status === 'pending_approval';

  const approvedAllocations = allAwardAllocations.filter(a =>
    a.approved === true || (!isPendingStatus && a.approved !== false)
  );
  const pendingAllocations = isPendingStatus
    ? allAwardAllocations.filter(a => a.approved === false || a.approved === undefined)
    : [];

  // Allocated = formally approved containers only
  const allocatedContainers = Number(rfq.allocatedQuantity) || approvedAllocations.reduce((s, a) => s + (Number(a.containers) || 0), 0);
  // Pending = containers currently in approval queue (not yet signed off)
  const inApprovalContainers = isPendingStatus ? pendingAllocations.reduce((s, a) => s + (Number(a.containers) || 0), 0) : 0;
  const pendingContainers = Math.max(0, totalContainers - allocatedContainers);
  const allocationSummary = getRfqAllocationSummary(rfq);
  const normalizedAwardAllocations = allocationSummary.allAwardAllocations;
  const normalizedApprovedAllocations = allocationSummary.approvedAllocations;
  const normalizedPendingAllocations = allocationSummary.pendingAllocations;
  const normalizedTotalContainers = allocationSummary.totalContainers;
  const normalizedAllocatedContainers = allocationSummary.allocatedContainers;
  const normalizedInApprovalContainers = allocationSummary.inApprovalContainers;
  const normalizedOpenContainers = allocationSummary.openContainers;
  const normalizedIsPendingApproval = allocationSummary.isPendingApproval;
  const normalizedBadgeTone = allocationSummary.badgeTone;
  const normalizedBadgeText = allocationSummary.badgeText;
  const allocationContainersTotal = normalizedTotalContainers;

  const cycleHistory = rfq.reassignmentHistory || [];
  const currentCycleNumber = cycleHistory.length + 1;
  const isRfqEditable = !['pending_approval', 'awarded', 'closed', 'cancelled'].includes(String(rfq.status || '').toLowerCase());

  // Workflow pipeline stages from rfq.workflow
  const wf = rfq.workflow || {};
  const approvalProgress = rfq.approvalProgress || {};

  const awardAllocated = awardRows.reduce((sum, row) => sum + (Number(row.containers) || 0), 0);
  const awardTotal = awardRows.reduce((sum, row) => {
    const quote = quotesList.find((item) => item.quoteId === row.quoteId);
    return sum + (Number(quote?.totalInr) || 0) * (Number(row.containers) || 0);
  }, 0);
  const targetContainers = normalizedTotalContainers;
  const hasDuplicateAwardVendor = new Set(awardRows.map((row) => row.quoteId).filter(Boolean)).size !== awardRows.filter((row) => row.quoteId).length;
  const exceedsTotalContainers = awardAllocated > normalizedTotalContainers;
  const awardReady = awardRows.length > 0
    && !hasDuplicateAwardVendor
    && awardRows.every((row) => row.quoteId && Number.isInteger(Number(row.containers)) && Number(row.containers) > 0)
    && !exceedsTotalContainers
    && Boolean(awardWorkflow?.steps?.length);
  const filteredManagerVendors = logisticsVendors.filter((vendor) => `${vendor.companyName || ''} ${vendor.sapVendorCode || ''}`.toLowerCase().includes(vendorSearch.toLowerCase()));


  return (
    <div className="w-full space-y-5 font-sans pb-16 antialiased text-left">
      {/* Top Navigation & Actions Bar Matching Screenshot 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin/rfqs')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to RFQs</span>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{rfq.rfqNumber}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${normalizedBadgeTone === 'amber'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : normalizedBadgeTone === 'emerald'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : normalizedBadgeTone === 'rose'
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : normalizedBadgeTone === 'sky'
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
              {normalizedBadgeText}
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">{rfq.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <RecordDbInfoDrawer entityId={rfq.rfqId || id} entityType="RfqHeader" recordData={rfq} />
          {canEdit && (rfq.status === 'closed' || (rfq.closingDate && new Date(rfq.closingDate) < new Date())) && (
            <button
              onClick={() => {
                setReopenClosingDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
                setShowReopenModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-300 bg-teal-50 hover:bg-teal-100 text-[#0d7676] text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reopen RFQ</span>
            </button>
          )}
          {canEdit && ['published', 'partially_awarded'].includes(rfq.status) && !(rfq.closingDate && new Date(rfq.closingDate) < new Date()) && (
            <button
              onClick={async () => {
                if (!window.confirm(`Are you sure you want to close RFQ ${rfq.rfqNumber}? Bidding will be locked.`)) return;
                try {
                  const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/close`, { method: 'POST' });
                  const json = await res.json();
                  if (res.ok && json.success) {
                    showToast({ title: 'RFQ Closed', description: json.message, type: 'success' });
                    loadRfq();
                  } else throw new Error(json.error || 'Failed to close RFQ');
                } catch (err) {
                  showToast({ title: 'Close Failed', description: err.message, type: 'error' });
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close RFQ</span>
            </button>
          )}
          {canEdit && !['pending_approval', 'awarded', 'closed', 'cancelled'].includes(String(rfq.status || '').toLowerCase()) && (
            <button
              onClick={() => navigate(`/admin/rfqs/${rfq.rfqId}/edit`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit RFQ</span>
            </button>
          )}
          {canCreate && (
            <button
              onClick={async () => {
                try {
                  const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/copy`, { method: 'POST' });
                  const json = await res.json();
                  if (res.ok && json.success) {
                    showToast({ title: 'RFQ Copied', description: `Opening create form with pre-filled details for ${json.data.rfqNumber}...`, type: 'success' });
                    navigate('/admin/rfqs/create', { state: { copyFrom: json.data } });
                  } else throw new Error(json.error || 'Failed to copy RFQ');
                } catch (err) {
                  showToast({ title: 'Copy Failed', description: err.message, type: 'error' });
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#0d7676]" />
              <span>Copy RFQ</span>
            </button>
          )}
          {canDelete && !String(rfq?.status || '').toLowerCase().includes('award') && Number(rfq?.allocatedQuantity || 0) === 0 && !['awarded', 'partially_awarded', 'closed'].includes(String(rfq?.status || '').toLowerCase()) && (
            <button
              onClick={async () => {
                if (window.confirm('Delete this RFQ from MongoDB?')) {
                  await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}`, { method: 'DELETE' });
                  navigate('/admin/rfqs');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete RFQ</span>
            </button>
          )}
        </div>
      </div>


      {/* RFQ Flow Pipeline — 6 metric cards + progress bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Top row: 6 stat boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100">
          {[
            { label: 'Total Containers', value: normalizedTotalContainers, sub: `${cargo.containerType || '40 HC'}`, color: 'text-slate-900', bg: 'bg-slate-50' },
            { label: 'Approved & Awarded', value: normalizedAllocatedContainers, sub: `${normalizedTotalContainers > 0 ? Math.round((normalizedAllocatedContainers / normalizedTotalContainers) * 100) : 0}% of target`, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'In Approval Queue', value: normalizedInApprovalContainers, sub: normalizedIsPendingApproval ? `Cycle #${currentCycleNumber}` : '—', color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Vendors Invited', value: wf.invited || (rfq.invitedVendors || []).length, sub: 'freight forwarders', color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Quotes Received', value: wf.quotes || quotesList.length, sub: `${(rfq.invitedVendors || []).length > 0 ? Math.round(((wf.quotes || quotesList.length) / (rfq.invitedVendors || []).length) * 100) : 0}% response rate`, color: 'text-violet-700', bg: 'bg-violet-50' },
            { label: 'Approval Cycles', value: currentCycleNumber, sub: cycleHistory.length > 0 ? `${cycleHistory.length} prev. cycle(s)` : 'First cycle', color: 'text-[#0d7676]', bg: 'bg-teal-50' }
          ].map(({ label, value, sub, color, bg }) => (
            <div key={label} className={`${bg} px-4 py-3.5 text-center`}>
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
              <p className={`text-2xl font-black ${color} tracking-tight`}>{value}</p>
              <p className="text-[9px] font-semibold text-slate-400 mt-0.5 truncate">{sub}</p>
            </div>
          ))}
        </div>

        {/* Progress Bar — Container allocation pipeline */}
        <div className="px-5 py-3 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 shrink-0 w-20">Allocation</span>
            <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-slate-100">
              <div
                className="bg-emerald-500 h-full transition-all duration-700"
                style={{ width: `${normalizedTotalContainers > 0 ? (normalizedAllocatedContainers / normalizedTotalContainers) * 100 : 0}%` }}
              />
              <div
                className="bg-amber-400 h-full transition-all duration-700"
                style={{ width: `${normalizedTotalContainers > 0 ? (normalizedInApprovalContainers / normalizedTotalContainers) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold shrink-0">
              <span className="flex items-center gap-1 text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{normalizedAllocatedContainers} Awarded</span>
              {normalizedInApprovalContainers > 0 && <span className="flex items-center gap-1 text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{normalizedInApprovalContainers} Pending</span>}
              <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />{normalizedOpenContainers} Open</span>
            </div>
          </div>
        </div>
      </div>


      {/* Two Column Layout Matching Screenshot 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Sidebar Cards */}
        <div className="space-y-4 lg:col-span-1">
          {/* Card: RFQ Info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">RFQ INFO</h3>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              {[
                ['RFQ Number', rfq.rfqNumber, 'font-mono font-black text-slate-900'],
                ['SAP PO Number', rfq.sapPoNumber || rfq.poId, 'font-mono font-bold text-[#0d7676]'],
                ['Title', rfq.title, 'font-semibold text-slate-800 text-right max-w-[60%] leading-4'],
                ['Status', (rfq.status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), 'font-bold text-slate-700'],
                ['Created By', rfq.createdBy || 'System Admin', 'font-bold text-slate-700'],
                ['Created At', rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', 'font-semibold text-slate-600'],
                ['Closing Date', rfq.closingDate ? new Date(rfq.closingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Expired', 'font-bold text-slate-700'],
                ['Vendors Invited', `${(rfq.invitedVendors || []).length} vendors`, 'font-bold text-[#0d7676]'],
                ['Quotes Received', `${quotesList.length} quote(s)`, 'font-bold text-violet-700'],
              ].map(([label, value, cls]) => value ? (
                <div key={label} className="flex items-start justify-between gap-2">
                  <span className="text-slate-400 font-medium shrink-0">{label}</span>
                  <span className={cls || 'font-semibold text-slate-800'}>{value}</span>
                </div>
              ) : null)}
            </div>
          </div>
          {/* Universal Dynamic Approval Workflow Stepper Component — Hidden when fully awarded & approved */}
          {!(rfq.status === 'awarded' || (normalizedAllocatedContainers > 0 && normalizedAllocatedContainers === normalizedTotalContainers && !normalizedIsPendingApproval && normalizedInApprovalContainers === 0)) && (
            <UniversalApprovalWorkflowCard
              referenceId={rfq.awardApprovalId || rfq.rfqId || rfq.rfqNumber || id}
              recordType="RFQ Vendor Award"
              vendorName={rfq.title}
              amountFormatted={`${normalizedTotalContainers} Containers`}
              poRef={rfq.linkedPoId}
              onStatusChange={() => {
                loadRfq();
              }}
            />
          )}
          {/* Card: Cargo & Shipment */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">CARGO & SHIPMENT</h3>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              {[
                ['Cargo Type', cargo.cargoType],
                ['Container Type', cargo.containerType],
                ['Total Containers', `${normalizedTotalContainers} containers`],
                ['Weight / Container', cargo.weightPerContainer ? `${cargo.weightPerContainer} MT` : null],
                ['Shipping Terms', cargo.shippingTerms],
                ['Port of Loading', cargo.portOfOrigin],
                ['Port of Discharge', cargo.portOfDestination],
                ['Readiness Date', cargo.estimatedReadinessDate ? new Date(cargo.estimatedReadinessDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null],
              ].map(([label, value]) => value ? (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 font-medium">{label}</span>
                  <span className="font-bold text-slate-900 text-right">{value}</span>
                </div>
              ) : null)}
            </div>
          </div>


        </div>
{/* Right Column: Quotes & Vendors Matrix Matching Screenshot 2 */}
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
  {/* Enhanced Tabs with better visual hierarchy */}
  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-slate-200 px-6 pt-3 pb-2 gap-3 overflow-x-auto table-scrollbar">
    <div className="flex items-center gap-1 text-xs font-medium shrink-0">
      {[
        { id: 'quotes', icon: FileText, label: 'Quotes', count: quotesList.length, color: 'amber' },
        { id: 'vendors', icon: Users, label: 'Vendors', count: (rfq.invitedVendors || []).length, color: 'slate' },
        { id: 'bl', icon: Ship, label: 'BL Entries', count: (rfq.blEntries || []).length, color: 'slate' },
        { id: 'documents', icon: FileText, label: 'Documents', color: 'slate' }
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            flex items-center gap-2 px-3.5 pb-2.5 border-b-2 transition-all duration-200 whitespace-nowrap shrink-0
            ${activeTab === tab.id 
              ? 'border-teal-600 text-teal-700 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
            }
          `}
        >
          <tab.icon className={`h-4 w-4 shrink-0 ${activeTab === tab.id ? 'text-teal-600' : ''}`} />
          <span className="font-semibold whitespace-nowrap">{tab.label}</span>
          {tab.count !== undefined && (
            <span className={`
              px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0
              ${activeTab === tab.id 
                ? 'bg-teal-100 text-teal-700' 
                : 'bg-slate-100 text-slate-500'
              }
            `}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>

    {/* Action Buttons - Improved layout & no text wrap */}
    <div className="flex items-center gap-2 pb-1 shrink-0 whitespace-nowrap">
      {normalizedOpenContainers > 0 && !normalizedIsPendingApproval && quotesList.length > 0 && (
        <button
          onClick={() => handleAwardQuote(quotesList[0])}
          className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-bold rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-95 whitespace-nowrap shrink-0"
        >
          <Award className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">
            {normalizedAllocatedContainers > 0 
              ? `Allocate Remaining ${normalizedOpenContainers} Container${normalizedOpenContainers > 1 ? 's' : ''}` 
              : `Award Vendors (${normalizedTotalContainers} Containers)`
            }
          </span>
        </button>
      )}

      {normalizedOpenContainers === 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {!normalizedIsPendingApproval && (
            <button
              onClick={handleReassignRfq}
              className="px-3.5 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 hover:shadow-sm whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Reassign</span>
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => { setActiveTab('vendors'); setShowVendorManager(true); }}
        className="px-3.5 py-1.5 border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 hover:shadow-sm whitespace-nowrap shrink-0"
      >
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span className="whitespace-nowrap">Manage Vendors</span>
      </button>
    </div>
  </div>

  {/* Content Area with improved styling */}
  {activeTab === 'quotes' && (
    <div className="space-y-4">
      <div className="overflow-x-auto table-scrollbar">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-[9.5px] font-extrabold uppercase tracking-tight text-slate-500">
            <tr>
              <th className="py-2.5 px-2.5 whitespace-nowrap w-36">Vendor</th>
              <th className="py-2.5 px-2 whitespace-nowrap w-16">Line</th>
              <th className="py-2.5 px-2 whitespace-nowrap min-w-[80px]">Route</th>
              <th className="py-2.5 px-2.5 text-right whitespace-nowrap min-w-[85px]">Freight</th>
              <th className="py-2.5 px-2.5 text-right whitespace-nowrap min-w-[95px]">St. Charges</th>
              <th className="py-2.5 px-2.5 text-right whitespace-nowrap min-w-[105px]">Total (INR)</th>
              <th className="py-2.5 px-1.5 text-center whitespace-nowrap w-14">Transit</th>
              <th className="py-2.5 px-2 text-center whitespace-nowrap min-w-[95px]">Schedule</th>
              <th className="py-2.5 px-2.5 text-center whitespace-nowrap sticky right-0 bg-slate-50 text-slate-500 font-extrabold uppercase tracking-tight text-[9.5px] shadow-[-6px_0_12px_-2px_rgba(0,0,0,0.08)] border-l border-slate-200 z-20 min-w-[110px]">Allocation Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {quotesList.map((q, idx) => {
              const approvedAlloc = normalizedApprovedAllocations.find(
                (a) => a.quoteId === q.quoteId || a.vendorId === q.vendorId || a.vendorName === q.vendorName
              );
              const pendingAlloc = normalizedPendingAllocations.find(
                (a) => a.quoteId === q.quoteId || a.vendorId === q.vendorId || a.vendorName === q.vendorName
              );
              const etdStr = q.vesselEtd ? new Date(q.vesselEtd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '21 Aug';
              const etaStr = q.vesselEta ? new Date(q.vesselEta).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '30 Aug';

              return (
                <tr key={q.quoteId || idx} className="hover:bg-teal-50/20 transition-colors duration-150 group">
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 max-w-[135px]">
                      <div className={`
                        w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shadow-2xs shrink-0
                        ${q.rank === 'L1' || idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}
                      `}>
                        {q.rank || `L${idx + 1}`}
                      </div>
                      <span className="font-bold text-slate-900 truncate text-[11px]" title={q.vendorName}>{q.vendorName}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 font-bold text-slate-700 whitespace-nowrap text-[11px]">{q.shippingLine}</td>
                  <td className="py-2 px-2 text-slate-600 font-medium whitespace-nowrap text-[11px]">
                    <div className="max-w-[85px] truncate" title={q.vesselRoute || 'DIRECT'}>{q.vesselRoute || 'DIRECT'}</div>
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">
                    ${(Number(q.oceanFreightUsd) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">
                    ₹{(Number(q.stChargesInr) || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2 px-2.5 text-right whitespace-nowrap">
                    <div className="font-extrabold text-[#0d7676] text-[11px]">
                      ₹{(Number(q.totalInr) || 0).toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="py-2 px-1.5 text-center font-bold text-slate-700 whitespace-nowrap text-[11px]">
                    {q.transitDays ? `${q.transitDays}d` : '15d'}
                  </td>
                  <td className="py-2 px-2 text-center font-medium text-slate-600 whitespace-nowrap text-[10.5px]">
                    {etdStr} → {etaStr}
                  </td>
                  <td className="py-2 px-2 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-teal-50/90 shadow-[-6px_0_12px_-2px_rgba(0,0,0,0.08)] border-l border-slate-200 z-10">
                    {approvedAlloc?.containers > 0 ? (
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <span className="px-2 py-0.5 rounded-lg text-[9.5px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {approvedAlloc.containers}/{normalizedTotalContainers} Ctr
                        </span>
                      </div>
                    ) : pendingAlloc?.containers > 0 ? (
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <span className="px-2 py-0.5 rounded-lg text-[9.5px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1 shadow-2xs">
                          <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                          Pending · {pendingAlloc.containers} Ctr
                        </span>
                      </div>
                    ) : normalizedOpenContainers > 0 ? (
                      <button
                        onClick={() => handleAwardQuote(q)}
                        className="px-2 py-1 bg-[#0d7676] hover:bg-[#096464] text-white text-[9.5px] font-bold rounded-lg shadow-xs transition-all duration-150 inline-flex items-center gap-1 hover:shadow-md active:scale-95 whitespace-nowrap"
                      >
                        <Award className="w-3 h-3" />
                        Allocate {normalizedOpenContainers} Ctr
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[9.5px] font-bold text-slate-400 bg-slate-100 border border-slate-200">
                        Awarded
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

  {/* Expandable Details Section - Improved */}
  <div className="divide-y divide-slate-100 border-t border-slate-200">
        {quotesList.map((quote, index) => {
          const key = quote.quoteId || index;
          const isExpanded = expandedQuotes[key];
          return (
            <div key={key} className="bg-slate-50/40">
              <button
                onClick={() => setExpandedQuotes((current) => ({ ...current, [key]: !current[key] }))}
                className="flex w-full items-center justify-between px-6 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100/80 transition-colors duration-150"
              >
                <div className="flex items-center gap-2">
                  {isExpanded 
                    ? <ChevronDown className="h-4 w-4 text-[#0d7676] transition-transform" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 transition-transform" />
                  }
                  <span className="font-extrabold text-slate-900">{quote.vendorName}</span>
                  <span className="text-slate-400 font-normal">— Full Commercial Details</span>
                </div>
                <span className="text-[10px] font-bold text-[#0d7676] hover:underline">
                  {isExpanded ? 'Hide Details' : 'View Breakup'}
                </span>
              </button>

              {isExpanded && (
                <div className="px-6 pb-4 pt-2 border-t border-slate-200/60 bg-white space-y-3">
                  <div className="grid gap-3 sm:grid-cols-4 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Ocean Freight (USD)</p>
                      <p className="mt-1 text-sm font-extrabold font-mono text-slate-900">${(Number(quote.oceanFreightUsd) || 0).toLocaleString('en-US')}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">₹{((Number(quote.oceanFreightUsd) || 0) * (quote.exchangeRate || 95.37)).toLocaleString('en-IN')} INR</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Terminal / ST Charges</p>
                      <p className="mt-1 text-sm font-extrabold font-mono text-slate-900">₹{(Number(quote.stChargesInr) || 0).toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Local Port Handling</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Other Port Fees</p>
                      <p className="mt-1 text-sm font-extrabold font-mono text-slate-900">₹{(Number(quote.otherChargesInr) || 0).toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Documentation & Misc</p>
                    </div>
                    <div className="bg-teal-50 p-3 rounded-xl border border-teal-200">
                      <p className="text-[10px] font-extrabold text-teal-700 uppercase">Total Rate / Container</p>
                      <p className="mt-1 text-sm font-extrabold font-mono text-[#0d7676]">₹{(Number(quote.totalInr) || 0).toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-teal-600 font-bold mt-0.5">All-Inclusive Rate</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4 text-xs pt-1">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase">Free Days</p><p className="font-bold text-slate-700">{quote.freeDays || '14 Days'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase">Rate Validity</p><p className="font-bold text-slate-700">{quote.rateValidity || '30 Days'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase">Vessel Route</p><p className="font-bold text-slate-700">{quote.vesselRoute || 'SHANGHAI → NHAVA SHEVA'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase">Remarks / Note</p><p className="font-bold text-slate-700">{quote.remarks || 'No special conditions.'}</p></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  )}

  {/* Vendors Tab - Improved */}
  {activeTab === 'vendors' && (
    <div className="p-6 space-y-4">
      {showVendorManager && (
        <div className="mb-4 p-5 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/60 to-emerald-50/40">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Manage Invited Vendors
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Vendors with submitted quotes cannot be removed</p>
            </div>
            <button onClick={() => setShowVendorManager(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <CustomInput 
            value={vendorSearch} 
            onChange={(e) => setVendorSearch(e.target.value)} 
            placeholder="Search vendors by name or code..." 
            size="sm" 
            clearable 
            className="mb-4"
          />

          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {filteredManagerVendors.map((vendor) => {
              const selected = managedVendorIds.includes(vendor.id) || managedVendorIds.includes(vendor.sapVendorCode);
              const locked = quoteMatchesVendor(vendor);
              return (
                <label key={vendor.id} className={`
                  flex items-center justify-between gap-4 p-3.5 transition-colors duration-150
                  ${locked ? 'bg-slate-50/50 cursor-not-allowed' : 'hover:bg-teal-50/40 cursor-pointer'}
                `}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input 
                      type="checkbox" 
                      checked={selected || locked} 
                      disabled={locked} 
                      onChange={() => toggleManagedVendor(vendor)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{vendor.companyName}</p>
                      <p className="font-mono text-[10px] text-slate-400">{vendor.sapVendorCode}</p>
                    </div>
                  </div>
                  {locked && (
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold border border-blue-200">
                      Quote Submitted
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-teal-200/50">
            <p className="text-xs font-medium text-slate-500">
              {managedVendorIds.length} vendor{managedVendorIds.length !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowVendorManager(false)} 
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button 
                disabled={savingVendors} 
                onClick={saveManagedVendors}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-xs font-bold text-white disabled:opacity-50 transition-colors duration-200 inline-flex items-center gap-2"
              >
                {savingVendors ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Vendor List'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor List */}
      <div className="space-y-2">
        {(rfq.invitedVendors || []).map((v, idx) => {
          const hasQuote = quotesList.some(
            (quote) => quote.vendorId === v.vendorId || quote.vendorId === v.sapVendorCode || quote.vendorName === v.companyName
          );
          return (
            <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150">
              <div>
                <p className="text-xs font-semibold text-slate-900">{v.companyName || (typeof v === 'string' ? v : '')}</p>
                <p className="text-[10px] font-mono text-slate-400">{v.sapVendorCode || ''}</p>
              </div>
              <span className={`
                px-3 py-1 rounded-full text-[10px] font-bold
                ${hasQuote ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}
              `}>
                {hasQuote ? '✓ Quote Submitted' : 'Invited'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  )}

  {/* BL Entries Tab - Improved */}
  {activeTab === 'bl' && (
    <div className="p-6">
      {(rfq.blEntries || []).length ? (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {rfq.blEntries.map((entry) => (
            <div key={entry.blId || entry._id} className="grid gap-4 p-4 text-xs hover:bg-slate-50/50 transition-colors duration-150 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">BL Number</p>
                <p className="font-mono font-semibold text-slate-800">{entry.blNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shipping Line</p>
                <p className="font-medium text-slate-700">{entry.shippingLine || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ETA</p>
                <p className="font-medium text-slate-700">{entry.etaDate ? new Date(entry.etaDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                <span className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold
                  ${entry.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 
                    entry.status === 'pending_approval' ? 'bg-amber-50 text-amber-700' : 
                    'bg-slate-50 text-slate-600'}
                `}>
                  <span className={`
                    w-1.5 h-1.5 rounded-full
                    ${entry.status === 'approved' ? 'bg-emerald-500' : 
                      entry.status === 'pending_approval' ? 'bg-amber-500' : 
                      'bg-slate-400'}
                  `} />
                  {String(entry.status || 'submitted').replaceAll('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <Ship className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No Bill of Lading entries yet</p>
          <p className="text-xs text-slate-300 mt-1">Entries will appear here once created</p>
        </div>
      )}
    </div>
  )}

  {/* Documents Tab - Enhanced */}
  {activeTab === 'documents' && (
    <div className="p-6">
      <DocumentUploader
        documentableType="RfqHeader"
        documentableId={rfq.rfqId}
        documentType="rfq_document"
        multiple={true}
        readOnly={!canEdit || !isRfqEditable}
        onDocumentsChange={(docs) => setDocumentCount(docs.length)}
      />
    </div>
  )}
</div>
      </div>

      {/* Approval Cycles & Allocation History Card */}
      {(normalizedAwardAllocations.length > 0 || cycleHistory.length > 0 || normalizedIsPendingApproval || rfq.status === 'partially_awarded' || rfq.status === 'awarded') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0d7676]/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#0d7676]" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Allocation & Approval History</h3>
                <p className="text-[10px] font-semibold text-slate-400">
                  {currentCycleNumber} total cycle(s) · Full audit trail for {rfq.rfqNumber}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {normalizedAllocatedContainers}/{normalizedTotalContainers} Awarded
              </span>
              {normalizedInApprovalContainers > 0 && (
                <span className="text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {normalizedInApprovalContainers} In Approval
                </span>
              )}
              {normalizedOpenContainers > 0 && (
                <span className="text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {normalizedOpenContainers} Open
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {/* ── CURRENT ACTIVE CYCLE (pending_approval) ── */}
            {normalizedIsPendingApproval && normalizedPendingAllocations.length > 0 && (() => {
              const cycleTotal = normalizedPendingAllocations.reduce((s, a) => s + (Number(a.allocationAmount) || 0), 0);
              const cycleCont = normalizedPendingAllocations.reduce((s, a) => s + (Number(a.containers) || 0), 0);
              return (
                <div className="p-5 bg-amber-50/40 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-sm shrink-0">
                        #{currentCycleNumber}
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">
                          Cycle #{currentCycleNumber} — {cycleCont} Container(s) Pending Approval
                        </p>
                        <p className="text-[10px] font-semibold text-amber-700 mt-0.5">
                          Approval ID: <span className="font-mono">{rfq.awardApprovalId || '—'}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> Awaiting Approval
                    </span>
                  </div>

                  {/* Approval steps mini view */}
                  {approvalProgress.steps && approvalProgress.steps.length > 0 && (
                    <div className="flex items-center gap-0">
                      {approvalProgress.steps.map((step, idx) => (
                        <div key={step.step} className="flex items-center flex-1">
                          <div className={`flex-1 h-0.5 ${idx === 0 ? 'hidden' : step.state === 'completed' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border-2 ${step.state === 'current' ? 'bg-amber-500 border-amber-500 text-white' :
                              step.state === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' :
                                'bg-white border-slate-200 text-slate-400'
                            }`}>
                            {step.state === 'completed' ? '✓' : step.step}
                          </div>
                          <div className={`flex-1 h-0.5 ${idx === approvalProgress.steps.length - 1 ? 'hidden' : step.state === 'completed' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                        </div>
                      ))}
                    </div>
                  )}
                  {approvalProgress.steps && (
                    <div className="flex justify-between">
                      {approvalProgress.steps.map(step => (
                        <div key={step.step} className="flex-1 text-center">
                          <p className={`text-[9px] font-bold ${step.state === 'current' ? 'text-amber-700' : step.state === 'completed' ? 'text-emerald-700' : 'text-slate-400'}`}>{step.title}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Vendor rows */}
                  <div className="space-y-2">
                    {normalizedPendingAllocations.map((alloc, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-xl border border-amber-200 px-4 py-3 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-black text-[10px] shrink-0">
                            {alloc.containers}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{alloc.vendorName}</p>
                            <p className="text-[10px] font-medium text-slate-500">
                              {alloc.containers} ctr × ₹{(alloc.ratePerContainer || 0).toLocaleString('en-IN')}/ctr
                              {alloc.remark ? ` · "${alloc.remark}"` : ''}
                            </p>
                            {alloc.quoteId && <p className="text-[9px] font-mono text-slate-300 mt-0.5">{alloc.quoteId}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold font-mono text-amber-700 text-xs">₹{(alloc.allocationAmount || 0).toLocaleString('en-IN')}</p>
                          <p className="text-[9px] text-slate-400">Pending</p>
                        </div>
                      </div>
                    ))}
                    {normalizedPendingAllocations.length > 1 && (
                      <div className="flex justify-end pr-1">
                        <span className="text-[10px] font-extrabold font-mono text-amber-700">
                          Total: ₹{cycleTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── APPROVED CURRENT ALLOCATIONS (partially_awarded / awarded) ── */}
            {normalizedApprovedAllocations.length > 0 && (
              <div className="p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-sm shrink-0">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">
                        {normalizedApprovedAllocations.reduce((s, a) => s + (Number(a.containers) || 0), 0)} Container(s) — Approved & Awarded
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">Formally confirmed and completed</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Awarded
                  </span>
                </div>
                <div className="space-y-2">
                  {normalizedApprovedAllocations.map((alloc, i) => (
                    <div key={i} className="flex items-center justify-between bg-white rounded-xl border border-emerald-200 px-4 py-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-[10px] shrink-0">
                          {alloc.containers}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{alloc.vendorName}</p>
                          <p className="text-[10px] font-medium text-slate-500">
                            {alloc.containers} ctr × ₹{(alloc.ratePerContainer || 0).toLocaleString('en-IN')}/ctr
                            {alloc.remark ? ` · "${alloc.remark}"` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold font-mono text-emerald-700 text-xs">₹{(alloc.allocationAmount || 0).toLocaleString('en-IN')}</p>
                        <p className="text-[9px] text-emerald-600 font-semibold">Awarded</p>
                      </div>
                    </div>
                  ))}
                </div>
                {normalizedAllocatedContainers >= normalizedTotalContainers && normalizedTotalContainers > 0 && (
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-xs font-extrabold text-emerald-800">
                      All {normalizedTotalContainers} containers fully awarded · {rfq.awardedVendorName || 'Completed'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── HISTORICAL CYCLES from reassignmentHistory ── */}
            {cycleHistory.length > 0 && (
              <div className="divide-y divide-slate-100">
                <div className="px-5 py-2.5 bg-slate-50/80">
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Previous Allocation Cycles</p>
                </div>
                {[...cycleHistory].reverse().map((hist, revIdx) => {
                  const histIdx = cycleHistory.length - 1 - revIdx;
                  const cycleNum = histIdx + 1;
                  const histAllocs = hist.newAllocations || [];
                  const histTotal = histAllocs.reduce((s, a) => s + (Number(a.allocationAmount) || 0), 0);
                  const histCont = hist.newAllocatedQuantity || histAllocs.reduce((s, a) => s + (Number(a.containers) || 0), 0);
                  return (
                    <div key={hist._id || histIdx} className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-black shrink-0">
                            #{cycleNum}
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-slate-700">
                              Cycle #{cycleNum} — {histCont} Container(s) Submitted
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{hist.approvalId || '—'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 block">
                            Superseded
                          </span>
                          <p className="text-[9px] font-semibold text-slate-400 mt-0.5">
                            {hist.reassignedAt ? new Date(hist.reassignedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Submitted allocations in this cycle */}
                      {histAllocs.length > 0 && (
                        <div className="space-y-1.5">
                          {histAllocs.map((alloc, ai) => (
                            <div key={ai} className="flex items-center justify-between bg-slate-50 rounded-lg border border-slate-200 px-3.5 py-2.5">
                              <div>
                                <p className="text-[10px] font-bold text-slate-700">{alloc.vendorName}</p>
                                <p className="text-[9px] font-medium text-slate-400">
                                  {alloc.containers} ctr × ₹{(alloc.ratePerContainer || 0).toLocaleString('en-IN')}/ctr
                                  {alloc.remark ? ` · "${alloc.remark}"` : ''}
                                </p>
                              </div>
                              <span className="font-bold font-mono text-slate-600 text-[10px]">
                                ₹{(alloc.allocationAmount || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          ))}
                          {histAllocs.length > 0 && (
                            <div className="flex justify-between text-[9px] font-semibold text-slate-400 px-1">
                              <span>Submitted by: {hist.reassignedBy || 'System Admin'}</span>
                              {histTotal > 0 && <span className="font-mono">Total: ₹{histTotal.toLocaleString('en-IN')}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* No data fallback */}
            {normalizedAwardAllocations.length === 0 && cycleHistory.length === 0 && !normalizedIsPendingApproval && (
              <div className="p-10 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Award className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-500">No allocation history</p>
                <p className="text-[10px] text-slate-400 mt-1">Use <strong>Award Vendors</strong> to begin allocation.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showAwardModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-xs">
        <div role="dialog" aria-modal="true" aria-labelledby="award-modal-title" className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${rfq.status === 'awarded' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}>
                <Award className="h-4 w-4" />
              </span>
              <div>
                <h2 id="award-modal-title" className="text-sm font-extrabold text-slate-900 leading-none">
                  {rfq.status === 'awarded' ? 'Reassign RFQ Vendors' : 'Award Vendors'}
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Allocate containers to quoted vendors and trigger the approval workflow.
                </p>
              </div>
            </div>
            <button type="button" aria-label="Close award dialog" onClick={() => setShowAwardModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-3 space-y-3">
            {rfq.status === 'awarded' && rfq.awardedVendorName && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="text-[10px] font-bold text-blue-800 uppercase">Current Award</p>
                  <p className="font-extrabold text-blue-900">{rfq.awardedVendorName}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]">
                  {rfq.allocatedQuantity || 0} containers allocated
                </span>
              </div>
            )}

            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[9px] font-extrabold uppercase text-slate-500">RFQ CONTAINERS</p>
                <p className="mt-0.5 text-lg font-black text-slate-900">{normalizedTotalContainers}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
                <p className="text-[9px] font-extrabold uppercase text-emerald-800">ALREADY AWARDED</p>
                <p className="mt-0.5 text-lg font-black text-emerald-700">{normalizedAllocatedContainers} <span className="text-[10px] font-bold text-emerald-600">ctr</span></p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
                <p className="text-[9px] font-extrabold uppercase text-amber-800">UNALLOCATED PENDING</p>
                <p className="mt-0.5 text-lg font-black text-amber-700">{normalizedOpenContainers} <span className="text-[10px] font-bold text-amber-600">ctr</span></p>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-2.5">
                <p className="text-[9px] font-extrabold uppercase text-[#0d7676]">CYCLE SELECTION</p>
                <p className="mt-0.5 text-lg font-black text-[#0d7676]">{awardAllocated} <span className="text-[10px] font-bold text-teal-600">ctr</span></p>
                <p className="text-[9px] font-bold text-slate-500 font-mono">₹{awardTotal.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[minmax(150px,1.4fr)_64px_minmax(85px,.75fr)_minmax(95px,.85fr)_minmax(180px,1.5fr)] gap-2 bg-slate-50 px-3 py-2 pr-10 text-[9px] font-extrabold uppercase tracking-wide text-slate-500">
                <span>Quoted vendor</span><span>Qty</span><span>Rate/ctr</span><span>Allocated value</span><span>Internal remark</span>
              </div>
              {awardRows.map((row, index) => {
                const quote = quotesList.find((item) => item.quoteId === row.quoteId);
                const duplicate = row.quoteId && awardRows.some((item, rowIndex) => rowIndex !== index && item.quoteId === row.quoteId);
                return (
                  <div key={index} className={`relative grid grid-cols-[minmax(150px,1.4fr)_64px_minmax(85px,.75fr)_minmax(95px,.85fr)_minmax(180px,1.5fr)] items-center gap-2 border-t px-3 py-2.5 pr-10 ${duplicate ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100 bg-white'}`}>
                    <div>
                      <SearchableSelect options={quotesList.map((item) => ({ label: `${item.vendorName} · ${item.rank || 'Rank pending'}`, value: item.quoteId }))} value={row.quoteId} onChange={(val) => setAwardRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, quoteId: val } : item))} placeholder="Select vendor quote" size="sm" searchable={false} />
                      {duplicate && <p className="mt-0.5 text-[9px] font-bold text-rose-600">Vendor already selected</p>}
                    </div>
                    <CustomInput aria-label={`Containers for allocation ${index + 1}`} type="number" min="1" max={targetContainers} step="1" value={row.containers} onChange={(event) => setAwardRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, containers: event.target.value } : item))} size="sm" />
                    <span className="whitespace-nowrap text-[11px] font-bold text-slate-700 font-mono">₹{Number(quote?.totalInr || 0).toLocaleString('en-IN')}</span>
                    <span className="whitespace-nowrap text-xs font-black text-slate-900 font-mono">₹{((Number(quote?.totalInr) || 0) * (Number(row.containers) || 0)).toLocaleString('en-IN')}</span>
                    <textarea aria-label={`Remark for allocation ${index + 1}`} rows="2" value={row.remark} onChange={(event) => setAwardRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, remark: event.target.value } : item))} placeholder="Optional decision note…" spellCheck={false} className="min-w-0 resize-y rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-teal-400 focus:bg-white focus:ring-1 focus:ring-teal-100" />
                    <button type="button" aria-label={`Remove allocation ${index + 1}`} title="Remove this vendor allocation" disabled={awardRows.length === 1} onClick={() => setAwardRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="absolute right-2.5 top-2.5 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button type="button" disabled={awardRows.length >= quotesList.length} onClick={() => setAwardRows((current) => [...current, { quoteId: quotesList.find((quote) => !current.some((row) => row.quoteId === quote.quoteId))?.quoteId || '', containers: 1, remark: '' }])} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#0d7676] hover:bg-teal-50 transition disabled:opacity-40">
                <Plus className="h-3.5 w-3.5" />Add vendor allocation
              </button>
              <p className="text-[10px] text-slate-500">Allocating whole container quantities.</p>
            </div>

            <div className={`rounded-xl border p-3 ${awardWorkflowError ? 'border-rose-200 bg-rose-50' : 'border-teal-200 bg-teal-50/50'}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-500">Approval workflow</p>
                  {awardWorkflow && <p className="text-xs font-bold text-slate-900">{awardWorkflow.slab}</p>}
                </div>
                {awardReady && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />Ready for approval
                  </span>
                )}
              </div>
              {awardWorkflowError ? (
                <p className="mt-1.5 text-xs font-bold text-rose-700">{awardWorkflowError}</p>
              ) : awardWorkflow ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {awardWorkflow.steps.map((step, index) => (
                    <React.Fragment key={step.step}>
                      <span className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[10px] font-bold text-[#0d7676]">
                        <span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-100 text-[9px]">{index + 1}</span>
                        {step.title}
                      </span>
                      {index < awardWorkflow.steps.length - 1 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />Selecting workflow...
                </p>
              )}
            </div>

            {!awardReady && !awardWorkflowError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-900">
                {hasDuplicateAwardVendor ? 'Remove the duplicate vendor allocation.' : exceedsTotalContainers ? `Selected quantity (${awardAllocated}) exceeds total RFQ capacity (${normalizedTotalContainers} containers).` : 'Complete all vendor selections to continue.'}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs">
            <p className="text-[10px] text-slate-500">Submitting triggers the approval workflow.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAwardModal(false)} className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 font-bold text-slate-700 hover:bg-slate-100 transition">Cancel</button>
              <button type="button" disabled={submittingAward || !awardReady} onClick={submitAwardAllocations} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d7676] px-4 py-1.5 font-bold text-white shadow-xs hover:bg-[#096464] transition disabled:opacity-40">{submittingAward && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{submittingAward ? 'Submitting…' : rfq.status === 'awarded' ? 'Submit Reassignment' : 'Submit for Approval'}</button>
            </div>
          </div>
        </div>
      </div>}

      {/* Submit Vendor Quote Modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Ship className="w-4 h-4 text-[#0d7676]" />
                Submit Vendor Quote
              </h3>
              <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuoteSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Vendor Name</label>
                <SearchableSelect
                  options={(rfq.invitedVendors || []).map((vendor) => ({
                    label: `${vendor.companyName} (${vendor.sapVendorCode || vendor.vendorId || 'No code'})`,
                    value: vendor.companyName
                  }))}
                  value={vendorName}
                  onChange={(val) => setVendorName(val)}
                  placeholder="Select an invited vendor"
                  size="md"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Shipping Line</label>
                <CustomInput
                  type="text"
                  required
                  value={shippingLine}
                  onChange={(e) => setShippingLine(e.target.value)}
                  placeholder="e.g. MSC / MAERSK"
                  size="sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Ocean Freight (USD)</label>
                  <CustomInput
                    type="number"
                    required
                    value={oceanFreightUsd}
                    onChange={(e) => setOceanFreightUsd(e.target.value)}
                    size="sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">St. Charges (INR)</label>
                  <CustomInput
                    type="number"
                    value={stChargesInr}
                    onChange={(e) => setStChargesInr(e.target.value)}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuoteModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingQuote}
                  className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold uppercase rounded-xl shadow-xs"
                >
                  {submittingQuote ? 'Submitting...' : 'Save Quote to MongoDB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen RFQ Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 text-[#0d7676]">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Reopen RFQ {rfq.rfqNumber}</h3>
                  <p className="text-xs text-slate-500 font-semibold">Extend deadline and allow vendor quotations</p>
                </div>
              </div>
              <button
                onClick={() => setShowReopenModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReopenRfq} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Closing Date &amp; Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={reopenClosingDate}
                  onChange={(e) => setReopenClosingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200/60 text-xs text-teal-900 space-y-1">
                <p className="font-extrabold">Reopening Actions:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-medium text-teal-800">
                  <li>Changes status back to <strong className="font-extrabold text-teal-950">Published</strong></li>
                  <li>Enables quotation submission for invited vendors</li>
                  <li>Extends closing deadline to the specified date</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReopen}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0b6363] text-white text-xs font-extrabold rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {submittingReopen ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>Reopen RFQ Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
