import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  CheckCircle2, Clock, XCircle, RotateCcw, AlertTriangle, Lock, Loader2, MessageSquare, AlertCircle 
} from 'lucide-react';
import { apiFetch } from '../../services/api';

// Helper: Format role title for display
function formatRoleTitle(roleKey = '') {
  const r = String(roleKey).trim().toLowerCase();
  if (r.includes('procurement')) return 'Procurement Head';
  if (r.includes('finance head') || r.includes('finance lead') || r.includes('finance')) return 'Finance Lead';
  if (r.includes('md') || r.includes('director')) return 'MD & Director';
  if (r.includes('system admin') || r.includes('admin')) return 'System Admin';
  return roleKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Helper: Check if user can act on a step
function canRoleActOnStep(userRoleInput, stepRoleInput) {
  if (!userRoleInput || !stepRoleInput) return false;
  
  const u = String(userRoleInput).toLowerCase().replace(/[\s_-]+/g, '_').trim();
  const s = String(stepRoleInput).toLowerCase().replace(/[\s_-]+/g, '_').trim();

  // Admins can act on any step
  if (['admin', 'systemadmin', 'system_admin', 'superadmin', 'md'].some(r => u.includes(r))) return true;

  if (u === s) return true;

  // Procurement Head
  if ((s.includes('procurement_head') || s.includes('purchase_head') || s.includes('procurement_lead') || s.includes('purchase_hod')) &&
      (u.includes('procurement_head') || u.includes('purchase_head') || u.includes('procurement_lead') || u.includes('purchase_hod'))) return true;

  // Procurement Manager
  if ((s.includes('procurement_manager') || s.includes('purchase_manager') || s === 'manager') &&
      (u.includes('procurement_manager') || u.includes('purchase_manager') || u.includes('manager'))) return true;

  // Finance / CFO
  if ((s.includes('finance') || s.includes('cfo') || s.includes('account')) &&
      (u.includes('finance') || u.includes('cfo') || u.includes('account'))) return true;

  // MD / Director
  if ((s.includes('md') || s.includes('director')) && (u.includes('md') || u.includes('director'))) return true;

  // EXIM
  if (s.includes('exim') && u.includes('exim')) return true;

  // Logistics
  if (s.includes('logistics') && u.includes('logistics')) return true;

  return false;
}

export default function UniversalApprovalWorkflowCard({ 
  referenceId, 
  recordType = 'Approval Workflow', 
  vendorName = '', 
  amountFormatted = '', 
  poRef = '',
  requireExplicitSubmission = true,
  onStatusChange 
}) {
  const currentUser = useSelector((state) => state.auth.user);
  const [approval, setApproval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, action: '' });
  const [userPermissions, setUserPermissions] = useState({
    canView: false,
    canAct: false,
    isRequester: false,
    isApprover: false
  });

  useEffect(() => {
    if (referenceId) {
      fetchApproval();
    }
  }, [referenceId]);

  const fetchApproval = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/approvals/${referenceId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.approval || json.data) {
          const approvalData = json.approval || json.data;
          setApproval(approvalData);
          // Check user permissions
          checkUserPermissions(approvalData);
          return;
        }
      }

      // If no approval found and explicit submission is required
      if (requireExplicitSubmission) {
        setApproval(null);
        setUserPermissions({ canView: false, canAct: false, isRequester: false, isApprover: false });
        return;
      }

      // Fallback synthesis only if explicit submission is not required
      const defaultSteps = [
        { step: 1, title: 'Purchase Manager Review', roleKey: 'purchase-manager', roleName: 'Purchase Manager', statusKey: 'Pending Purchase Manager Review' },
        { step: 2, title: 'Purchase Head Approval', roleKey: 'purchase-head', roleName: 'Purchase Head', statusKey: 'Pending Purchase Head Approval' },
        { step: 3, title: 'CFO Approval', roleKey: 'cfo', roleName: 'CFO', statusKey: 'Pending CFO Approval' }
      ];

      const fallbackApproval = {
        id: referenceId,
        type: recordType,
        vendorName: vendorName || 'Vendor',
        amountOriginal: amountFormatted || '₹0.00',
        amountINR: amountFormatted || '₹0.00',
        poReference: poRef,
        currentSlab: `${recordType} Slab`,
        currentStep: 1,
        totalSteps: 3,
        workflowSteps: JSON.stringify(defaultSteps),
        status: 'Pending Purchase Manager Review',
        submittedAt: new Date(),
        actionHistory: [],
        requestedById: null,
        assignedApprover: null,
        assignedApproverName: null
      };
      
      setApproval(fallbackApproval);
      checkUserPermissions(fallbackApproval);
    } catch (e) {
      console.error('[Approval Card] Error loading approval workflow:', e);
      setApproval(null);
      setUserPermissions({ canView: false, canAct: false, isRequester: false, isApprover: false });
    } finally {
      setLoading(false);
    }
  };

  // Check user permissions for this approval
  const checkUserPermissions = (approvalData) => {
    if (!currentUser || !approvalData) {
      setUserPermissions({ canView: false, canAct: false, isRequester: false, isApprover: false });
      return;
    }

    const userId = currentUser.id || currentUser.userId;
    const userEmail = currentUser.email;
    const userRole = currentUser.role;

    // Check if user is the requester
    const isRequester = 
      approvalData.requestedById === userId ||
      approvalData.requestedById === userEmail ||
      approvalData.requestedBy === userEmail ||
      approvalData.requestedBy === currentUser.name;

    // Check if user is the assigned approver
    const isApprover = 
      approvalData.assignedApprover === userId ||
      approvalData.assignedApproverId === userId ||
      approvalData.assignedApproverEmail === userEmail ||
      approvalData.assignedApproverName === currentUser.name;

    // Check if user is admin (can view and act on everything)
    const isAdmin = ['admin', 'system_admin', 'systemadmin', 'super_admin']
      .some(role => userRole?.toLowerCase().includes(role));

    // Check if user can view this approval
    const canView = isAdmin || isRequester || isApprover;

    // Check if user can act on current step
    let canAct = false;
    if (canView && !isRequester) {
      // Don't allow requester to act on their own request unless admin
      const currentStepNum = approvalData.currentStep || 1;
      let steps = [];
      try {
        steps = typeof approvalData.workflowSteps === 'string' 
          ? JSON.parse(approvalData.workflowSteps) 
          : (approvalData.workflowSteps || []);
      } catch (_) {
        steps = [];
      }
      
      const activeStepObj = steps.find(s => s.step === currentStepNum);
      const activeRoleKey = activeStepObj?.roleKey || activeStepObj?.roleName || '';
      
      const isTerminal = ['Approved & Dispatched', 'Rejected', 'Returned for changes'].includes(approvalData.status);
      
      if (!isTerminal && activeRoleKey) {
        canAct = isAdmin || canRoleActOnStep(userRole, activeRoleKey);
      }
    }

    setUserPermissions({
      canView,
      canAct,
      isRequester,
      isApprover
    });
  };

  const initiateAction = (actionType) => {
    setErrorMsg('');
    
    // Check permission again before action
    if (!userPermissions.canAct) {
      setErrorMsg('You do not have permission to perform this action.');
      return;
    }

    if (userPermissions.isRequester && !currentUser?.role?.toLowerCase().includes('admin')) {
      setErrorMsg('You cannot approve your own request.');
      return;
    }

    if (['reject', 'return'].includes(actionType) && !remarks.trim()) {
      setErrorMsg(`A note or reason is required to ${actionType} this request.`);
      return;
    }
    setConfirmModal({ open: true, action: actionType });
  };

  const executeAction = async () => {
    const actionType = confirmModal.action;
    try {
      setSubmittingAction(actionType);
      setErrorMsg('');
      
      const res = await apiFetch(`/api/approvals/${referenceId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          remarks: remarks.trim()
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Action failed');
      }

      setRemarks('');
      setConfirmModal({ open: false, action: '' });
      await fetchApproval();
      if (onStatusChange) onStatusChange(json.status || actionType);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingAction('');
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs animate-pulse space-y-4">
        <div className="h-6 w-48 bg-slate-200 rounded-lg" />
        <div className="h-20 w-full bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (!approval) {
    return null;
  }

  // Check if user can view this approval
  if (!userPermissions.canView) {
    return (
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500">
          <Lock className="w-5 h-5" />
          <div>
            <h4 className="font-semibold text-sm">Access Restricted</h4>
            <p className="text-xs">You don't have permission to view this approval workflow.</p>
          </div>
        </div>
      </div>
    );
  }

  // Parse workflow steps
  let steps = [];
  try {
    steps = typeof approval.workflowSteps === 'string' 
      ? JSON.parse(approval.workflowSteps) 
      : (approval.workflowSteps || []);
  } catch (_) {
    steps = [
      { step: 1, title: 'Procurement Head Approval', roleKey: 'procurement_head' },
      { step: 2, title: 'Finance Approval', roleKey: 'finance_lead' }
    ];
  }

  const currentStepNum = approval.currentStep || 1;
  const isTerminal = ['Approved & Dispatched', 'Rejected', 'Returned for changes'].includes(approval.status);

  // Get active step info
  const activeStepObj = steps.find(s => s.step === currentStepNum);
  const activeRoleKey = activeStepObj?.roleKey || activeStepObj?.roleName || 'procurement_head';
  
  // Final permission check for action
  const canActOnCurrentStep = !isTerminal && userPermissions.canAct && !userPermissions.isRequester;

  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-3 space-y-2 text-left font-sans antialiased">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Approval Timeline</h3>
          <p className="text-xs font-semibold text-[#0d7676] mt-0.5">
            {approval.currentSlab || `${recordType} (${amountFormatted || 'Workflow'})`}
          </p>
        </div>
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
          {steps.length} {steps.length === 1 ? 'STEP' : 'STEPS'}
        </span>
      </div>

      {/* 2. Vertical Timeline */}
      <div className="relative space-y-6 pl-2">
        {/* Connector vertical line */}
        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 z-0" />

        {steps.map((st, idx) => {
          const stepNum = st.step || idx + 1;
          const isCompleted = stepNum < currentStepNum || approval.status === 'Approved & Dispatched';
          const isActive = stepNum === currentStepNum && !isTerminal;
          const isRejected = approval.status === 'Rejected' && stepNum === currentStepNum;
          const isReturned = approval.status === 'Returned for changes' && stepNum === currentStepNum;

          // Find audit record for completed step
          const historyRecord = (approval.actionHistory || []).find(h => 
            h.step === stepNum || (stepNum === 1 && h.action === 'approve')
          );

          // Check if this step is assigned to the current user
          const isAssignedToMe = 
            approval.assignedApprover === currentUser?.id ||
            approval.assignedApproverId === currentUser?.id ||
            approval.assignedApproverEmail === currentUser?.email ||
            approval.assignedApproverName === currentUser?.name;

          return (
            <div key={idx} className="relative z-10 flex items-start gap-4 group">
              {/* Step Circle Node */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs transition-all ${
                isCompleted ? 'bg-[#00895a] text-white ring-4 ring-emerald-50' :
                isRejected ? 'bg-[#e11d48] text-white ring-4 ring-rose-50' :
                isReturned ? 'bg-[#f59e0b] text-white ring-4 ring-amber-50' :
                isActive ? 'bg-[#f59e0b] text-white ring-4 ring-amber-100 animate-pulse' :
                'bg-slate-100 text-slate-400 border border-slate-200'
              }`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> :
                 isRejected ? <XCircle className="w-5 h-5" /> :
                 isReturned ? <RotateCcw className="w-5 h-5" /> :
                 isActive ? <Clock className="w-5 h-5" /> :
                 stepNum}
              </div>

              {/* Step Content Card */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {st.title || `Step ${stepNum} Approval`}
                      {isAssignedToMe && isActive && (
                        <span className="ml-2 text-[10px] font-bold text-[#0d7676] bg-[#0d7676]/10 px-2 py-0.5 rounded-full">
                          YOU
                        </span>
                      )}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500">
                      {formatRoleTitle(st.roleName || st.roleKey)}
                    </p>
                  </div>

                  {/* Status Pill Badge */}
                  <div>
                    {isCompleted ? (
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-300">
                        APPROVED
                      </span>
                    ) : isRejected ? (
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-300">
                        REJECTED
                      </span>
                    ) : isReturned ? (
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-300">
                        RETURNED
                      </span>
                    ) : isActive ? (
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300">
                        PENDING
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-400">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>

                {/* History Audit Note for Completed Steps */}
                {historyRecord && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">
                      Actioned by <strong>{historyRecord.actionedBy || historyRecord.actorName || 'Approver'}</strong>
                      {historyRecord.actionedAt && (
                        <span className="text-slate-400 ml-2">
                          {new Date(historyRecord.actionedAt).toLocaleString('en-IN')}
                        </span>
                      )}
                    </p>
                    {historyRecord.remarks && (
                      <p className="italic text-slate-600">"{historyRecord.remarks}"</p>
                    )}
                  </div>
                )}

                {/* Active Embedded Action Box */}
                {isActive && (
                  <div className="mt-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-2xs space-y-3">
                    {/* Show who is assigned to approve */}
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Assigned to: <strong>{approval.assignedApproverName || formatRoleTitle(activeRoleKey)}</strong>
                        {isAssignedToMe && <span className="ml-1 text-[#0d7676]">(You)</span>}
                      </span>
                    </div>

                    {canActOnCurrentStep ? (
                      <>
                        {errorMsg && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{errorMsg}</span>
                          </div>
                        )}

                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                          ADD NOTE (REQUIRED FOR REJECTION & RETURN)
                        </label>
                        <textarea
                          value={remarks}
                          onChange={(e) => {
                            setRemarks(e.target.value);
                            if (errorMsg) setErrorMsg('');
                          }}
                          placeholder="Enter approval note or rejection reason..."
                          className={`w-full p-3 text-xs bg-white border rounded-xl outline-none h-20 resize-none font-medium text-slate-800 placeholder-slate-400 shadow-2xs transition-colors ${
                            errorMsg ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 focus:border-[#0d7676]'
                          }`}
                        />

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <button
                            onClick={() => initiateAction('approve')}
                            disabled={Boolean(submittingAction)}
                            className="px-5 py-2.5 rounded-xl bg-[#00895a] hover:bg-[#00734b] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
                          >
                            {submittingAction === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button
                            onClick={() => initiateAction('return')}
                            disabled={Boolean(submittingAction)}
                            className="px-5 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
                          >
                            {submittingAction === 'return' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            Return
                          </button>
                          <button
                            onClick={() => initiateAction('reject')}
                            disabled={Boolean(submittingAction)}
                            className="px-5 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
                          >
                            {submittingAction === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          {userPermissions.isRequester ? (
                            'You cannot approve your own request.'
                          ) : (
                            <>Step {currentStepNum} is pending approval by <strong>{formatRoleTitle(activeRoleKey)}</strong>.</>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Action Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmModal.action === 'reject' ? 'bg-rose-100 text-rose-600' :
                confirmModal.action === 'return' ? 'bg-amber-100 text-amber-600' :
                'bg-emerald-100 text-emerald-600'
              }`}>
                {confirmModal.action === 'reject' ? <XCircle className="w-6 h-6" /> :
                 confirmModal.action === 'return' ? <RotateCcw className="w-6 h-6" /> :
                 <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Confirm {confirmModal.action === 'reject' ? 'Rejection' : confirmModal.action === 'return' ? 'Return Request' : 'Approval'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Reference: <strong className="font-mono">{referenceId}</strong></p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">NOTE / REASON CONFIRMATION</span>
              <p className="text-slate-800 font-medium italic">"{remarks.trim() || 'No additional note entered.'}"</p>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              {confirmModal.action === 'reject'
                ? 'Are you sure you want to REJECT this request? Rejection will immediately halt the approval workflow.'
                : confirmModal.action === 'return'
                ? 'Are you sure you want to RETURN this request for changes? The requester will be notified to revise and re-submit.'
                : 'Are you sure you want to APPROVE this step?'}
            </p>

            {errorMsg && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">{errorMsg}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, action: '' })}
                disabled={Boolean(submittingAction)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={Boolean(submittingAction)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm flex items-center gap-1.5 transition ${
                  confirmModal.action === 'reject' ? 'bg-[#e11d48] hover:bg-[#be123c]' :
                  confirmModal.action === 'return' ? 'bg-[#f59e0b] hover:bg-[#d97706]' :
                  'bg-[#00895a] hover:bg-[#00734b]'
                }`}
              >
                {submittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Yes, {confirmModal.action === 'reject' ? 'Reject Request' : confirmModal.action === 'return' ? 'Return Request' : 'Approve Step'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}