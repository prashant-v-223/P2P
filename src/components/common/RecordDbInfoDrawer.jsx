import React, { useState, useEffect } from 'react';
import { Database, Clock, X, Code, History, Copy, Check, Info } from 'lucide-react';
import { apiFetch } from '../../services/api';
function formatRoleName(roleStr) {
  if (!roleStr) return 'System Admin';
  const r = String(roleStr).trim();
  const lower = r.toLowerCase().replace(/[\s_-]+/g, ' ');
  if (lower === 'procurement head' || lower === 'procurementhead' || lower === 'procurement') return 'Procurement Head';
  if (lower === 'finance lead' || lower === 'financelead' || lower === 'finance') return 'Finance Lead';
  if (lower === 'md' || lower === 'managing director') return 'MD & Director';
  if (lower === 'systemadmin' || lower === 'system admin' || lower === 'admin') return 'System Admin';
  if (lower === 'requester') return 'Requester';
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatActorName(log) {
  const name = log.actorName || log.performedBy || log.actionedBy || log.createdBy || log.actorId;
  const remarks = log.remarks || log.reason || '';

  // Extract real name from remarks if available (e.g. "Approve by Harish Solanki" or "Approve by Suresh Kumar")
  const match = remarks.match(/(?:Approved|Approve|Rejected|Returned|Submitted|Created|Actioned)\s+by\s+([A-Za-z0-9\s]+)/i);
  if (match && match[1] && match[1].trim()) {
    return match[1].trim();
  }

  if (!name || name === 'Approver' || name === 'User' || name === 'system' || name === 'undefined') {
    return log.actorRole ? formatRoleName(log.actorRole) : 'Authorized User';
  }
  return name;
}

export default function RecordDbInfoDrawer({ entityId, entityType, recordData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'db'
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jsonFilter, setJsonFilter] = useState('');

  useEffect(() => {
    if (isOpen && entityId) {
      fetchAuditLogs();
    }
  }, [isOpen, entityId]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const queryId = recordData?.invoiceNumber || recordData?.invoicePaymentId || recordData?.advanceId || recordData?.rfqId || recordData?.rfqNumber || recordData?.poNumber || entityId;
      const res = await apiFetch(`/api/p2p/audit/${queryId}`);
      if (res.ok) {
        const json = await res.json();
        const logs = (json.auditLogs || []).filter(log => {
          const act = String(log.action || log.eventType || '').toLowerCase();
          return !act.includes('delete');
        });
        setAuditLogs(logs);
      }
    } catch (e) {
      console.error('Error fetching audit trail:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(recordData || {}, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors shrink-0"
        title="Inspect Database Info & Action Audit History"
      >
        <Database className="w-3.5 h-3.5 text-teal-600" />
        <span>DB Info & Audit</span>
      </button>

      {/* Slide-over Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col font-sans text-left border-l border-slate-200">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Record Inspection & Audit Trail</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {entityType || 'Collection Record'}: <span className="font-bold text-teal-700">{entityId}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-white px-4">
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'audit'
                    ? 'border-teal-600 text-teal-700 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Audit History ({auditLogs.length})
              </button>

              <button
                onClick={() => setActiveTab('db')}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'db'
                    ? 'border-teal-600 text-teal-700 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Raw Database JSON
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'audit' ? (
                <div className="space-y-3">
                  {loading ? (
                    <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <Clock className="w-5 h-5 animate-spin text-teal-600" />
                      Loading audit logs...
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                      <Info className="w-6 h-6 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-700">No explicit audit entries recorded yet</p>
                      <p className="text-slate-400">All future approval, edit, and status actions will log here.</p>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {auditLogs.map((log, idx) => {
                        const actName = (log.action || log.eventType || '').toLowerCase();
                        const actionColors = {
                          approve: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                          submit: 'bg-teal-50 text-teal-800 border-teal-200',
                          award: 'bg-amber-50 text-amber-800 border-amber-200',
                          reject: 'bg-rose-50 text-rose-800 border-rose-200',
                          return: 'bg-orange-50 text-orange-800 border-orange-200',
                          create: 'bg-blue-50 text-blue-800 border-blue-200',
                          update: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                          delete: 'bg-red-50 text-red-800 border-red-200',
                          reassign: 'bg-purple-50 text-purple-800 border-purple-200',
                          delegate: 'bg-sky-50 text-sky-800 border-sky-200'
                        };
                        let colorClass = 'bg-slate-50 text-slate-800 border-slate-200';
                        for (const key of Object.keys(actionColors)) {
                          if (actName.includes(key)) {
                            colorClass = actionColors[key];
                            break;
                          }
                        }

                        const actorNameFormatted = formatActorName(log);
                        const actorRoleFormatted = formatRoleName(log.actorRole || log.role);

                        return (
                          <div key={log._id || idx} className="relative space-y-1 text-xs">
                            <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-teal-600 ring-4 ring-white" />
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${colorClass}`}>
                                {log.action || log.eventType || 'ACTION'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(log.createdAt || log.occurredAt || Date.now()).toLocaleString('en-IN')}
                              </span>
                            </div>

                            <p className="font-bold text-slate-900">
                              {actorNameFormatted}{' '}
                              <span className="text-slate-500 font-normal">({actorRoleFormatted})</span>
                            </p>

                            {log.remarks || log.reason ? (
                              <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                                "{log.remarks || log.reason}"
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">MongoDB Document Snapshot ({Object.keys(recordData || {}).length} fields)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Search JSON field..."
                        value={jsonFilter}
                        onChange={(e) => setJsonFilter(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white outline-none focus:border-teal-500 font-mono w-40"
                      />
                      <button
                        onClick={handleCopyJson}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-teal-700 shadow-2xs transition-colors shrink-0"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied!' : 'Copy JSON'}
                      </button>
                    </div>
                  </div>

                  <pre className="p-3.5 rounded-xl bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto max-h-[60vh] border border-slate-800 leading-relaxed select-all">
                    {jsonFilter.trim()
                      ? JSON.stringify(
                          Object.fromEntries(
                            Object.entries(recordData || {}).filter(([k, v]) =>
                              k.toLowerCase().includes(jsonFilter.toLowerCase()) ||
                              JSON.stringify(v).toLowerCase().includes(jsonFilter.toLowerCase())
                            )
                          ),
                          null,
                          2
                        )
                      : JSON.stringify(recordData || {}, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono">
              Rayzon P2P Enterprise Database Inspector · Collection Record ID: {entityId}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
