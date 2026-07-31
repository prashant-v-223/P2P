import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { 
  GitFork, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Clock, 
  Layers, 
  ShieldCheck, 
  User, 
  FileText,
  DollarSign
} from 'lucide-react';

export default function ApprovalEngineView() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [instances, setInstances] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentInput, setCommentInput] = useState('');

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/p2p/approval-engine/instances');
      if (res.ok) {
        const json = await res.json();
        if (json.instances) setInstances(json.instances);
      }
    } catch (e) {
      console.error('Error fetching approval instances from MongoDB:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (instanceId, action) => {
    try {
      const res = await apiFetch('/api/p2p/approval-engine/action', {
        method: 'POST',
        body: JSON.stringify({
          instanceId,
          action,
          performedBy: 'USER-101',
          performedByName: 'Finance Manager',
          comments: commentInput || `${action.toUpperCase()} action authorized`
        })
      });
      if (res.ok) {
        await fetchInstances();
      }
    } catch (e) {
      console.error('Error executing approval action:', e);
    } finally {
      setCommentInput('');
    }
  };

  return (
    <div className="w-full space-y-4 font-sans text-slate-800">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-semibold">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Polymorphic Approval Workflow Engine</h2>
            <p className="text-xs text-slate-500">Shared multi-step approval engine matching amount bands (`minAmount`/`maxAmount`), SLA role enforcement in MongoDB</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all ${
              activeTab === 'inbox' ? 'bg-[#0d7676] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending Approvals ({instances.filter(i => i.status === 'pending').length})
          </button>
        </div>
      </div>

      {/* PENDING APPROVALS INBOX */}
      {activeTab === 'inbox' && (
        <div className="space-y-3 w-full">
          {instances.filter(i => i.status === 'pending').length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No pending approvals in queue.
            </div>
          ) : (
            instances.filter(i => i.status === 'pending').map((inst) => (
              <div key={inst.instanceId} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {inst.instanceId}
                    </span>
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {inst.approvableType}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Step {inst.currentStep} of {inst.totalSteps}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{inst.reference || inst.approvableId}</h3>
                  <p className="text-xs text-slate-500">
                    Assigned Approver Role: <span className="font-semibold text-slate-800 uppercase">{inst.assignedApproverRole}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(inst.instanceId, 'approve')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-2xs transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleAction(inst.instanceId, 'return')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-xs shadow-2xs transition-all"
                  >
                    <RotateCcw className="w-4 h-4" /> Return to Edit
                  </button>
                  <button
                    onClick={() => handleAction(inst.instanceId, 'reject')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-2xs transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
