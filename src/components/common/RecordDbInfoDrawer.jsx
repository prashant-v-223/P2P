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

function formatActionName(value) {
  return String(value || 'Action')
    .replace(/^(approval|invoice|advance|rfq)[_-]/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatAuditNote(log) {
  const raw = String(log.remarks || log.reason || '').trim().replace(/^['"]|['"]$/g, '');
  const action = formatActionName(log.action || log.eventType).toLowerCase();
  if (!raw) return 'No additional note was provided.';
  if (/^(GET|POST|PUT|PATCH|DELETE)\s+\/api\//i.test(raw)) {
    const entity = String(log.entityType || 'record').replace(/[-_]+/g, ' ').toLowerCase();
    if (action.includes('create')) return `${entity.replace(/^\w/, (c) => c.toUpperCase())} created successfully.`;
    if (action.includes('update')) return `${entity.replace(/^\w/, (c) => c.toUpperCase())} updated successfully.`;
    if (action.includes('delete')) return `${entity.replace(/^\w/, (c) => c.toUpperCase())} deleted successfully.`;
    return 'Action completed successfully.';
  }
  if (/^(approve|approved)\s+by\s+/i.test(raw)) return 'Approved this request.';
  if (/^(reject|rejected)\s+by\s+/i.test(raw)) return 'Rejected this request.';
  if (/^(submit|submitted)\s+by\s+/i.test(raw)) return 'Submitted this request.';
  return raw;
}

const logisticsStageNames = {
  1: 'RFQ Published',
  2: 'Vendor Quote',
  3: 'Award Approval',
  4: 'BL Submitted',
  5: 'EXIM Review',
  6: 'Agent Assignment',
  7: 'Customs Clearance',
  8: 'Invoice & Payment'
};

function getStageBadgeInfo(log) {
  const evt = String(log.eventType || '').toUpperCase();
  const act = String(log.action || '').toUpperCase();
  const entityType = String(log.entityType || '').toLowerCase();
  const entityId = String(log.entityId || '');
  const stepNum = Number(log.step) || 0;

  // Award Approval (Stage 3)
  const isAwardApproval =
    entityType.includes('rfq vendor award') ||
    entityType.includes('award') ||
    entityId.startsWith('RFQ-AWARD-') ||
    entityId.startsWith('RFQ-REASSIGN-') ||
    evt.includes('AWARD') ||
    evt.includes('REASSIGN');

  if (isAwardApproval) {
    return `Stage 3 · Award Approval${stepNum > 0 ? ` (Step ${stepNum})` : ''}`;
  }

  // Stage 4: BL Submitted
  if (evt.includes('BL_SUBMIT') || act.includes('SUBMIT BL') || evt === 'BL_SUBMITTED') {
    return 'Stage 4 · BL Submitted';
  }

  // Stage 5: EXIM Review
  if (evt.includes('EXIM') || act.includes('EXIM')) {
    return 'Stage 5 · EXIM Review';
  }

  // Stage 6: Customs Agent Assignment
  if (evt.includes('AGENT_ASSIGN') || act.includes('ASSIGN CUSTOMS') || evt === 'BL_AGENT_ASSIGNED') {
    return 'Stage 6 · Agent Assignment';
  }

  // Stage 7: Customs Clearance / BOE
  if (evt.includes('BOE') || evt.includes('CUSTOMS') || act.includes('BOE') || act.includes('CUSTOMS')) {
    return 'Stage 7 · Customs Clearance';
  }

  // Stage 8: Invoice & Payment
  if (evt.includes('INVOICE') || evt.includes('PAYMENT') || entityType.includes('invoice') || entityType.includes('payment')) {
    return 'Stage 8 · Invoice & Payment';
  }

  // Stage 2: Vendor Quote
  if (evt.includes('QUOTE') || act.includes('QUOTE') || entityType.includes('quote')) {
    return 'Stage 2 · Vendor Quote';
  }

  // Stage 1: RFQ Published / Created
  if (evt.includes('RFQ') && (evt.includes('CREATE') || evt.includes('PUBLISH') || act.includes('CREATE') || act.includes('PUBLISH'))) {
    return 'Stage 1 · RFQ Published';
  }

  if (stepNum >= 1 && stepNum <= 8 && logisticsStageNames[stepNum]) {
    return `Stage ${stepNum} · ${logisticsStageNames[stepNum]}`;
  }

  if (stepNum > 0) {
    return `Step ${stepNum}`;
  }

  return null;
}

export default function RecordDbInfoDrawer({ entityId, entityType, recordData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'db'
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jsonFilter, setJsonFilter] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (isOpen && entityId) {
      fetchAuditLogs();
    }
  }, [isOpen, entityId]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const queryId = recordData?.invoiceNumber || recordData?.invoicePaymentId || recordData?.advanceId || recordData?.rfqId || recordData?.rfqNumber || recordData?.poNumber || entityId;
      const res = await apiFetch(`/api/p2p/audit/${queryId}`);
      if (res.ok) {
        const json = await res.json();
        const rawLogs = json.auditLogs || [];

        const isGenericMiddleware = (log) => {
          const evt = String(log.eventType || '').toUpperCase();
          const act = String(log.action || '').toUpperCase();
          const rsn = String(log.remarks || log.reason || '').trim();
          if (/^(RFQS|VENDOR_RFQS|SYSTEM|DOCUMENTS|UPLOAD_FILE|AUTH)_CREATE$/i.test(evt) || act === 'CREATE') {
            if (
              /created successfully\.?$/i.test(rsn) ||
              /completed successfully\.?$/i.test(rsn) ||
              /^(GET|POST|PUT|PATCH|DELETE)\s+\/api\//i.test(rsn) ||
              (log.newState && log.newState.statusCode === 200 && !log.newState.status)
            ) {
              return true;
            }
          }
          if (/^(GET|POST|PUT|PATCH|DELETE)\s+\/api\//i.test(rsn)) return true;
          return false;
        };

        const cleanLogs = rawLogs.filter((log) => {
          if (isGenericMiddleware(log)) return false;
          if (log.eventType === 'APPROVAL_SUBMITTED' || (log.action || '').toLowerCase() === 'submit') {
            const hasRichAward = rawLogs.some((other) =>
              (other.eventType === 'RFQ_AWARD_APPROVAL_REQUESTED' || other.eventType === 'RFQ_REASSIGNMENT_APPROVAL_REQUESTED') &&
              String(other.entityId) === String(log.entityId)
            );
            if (hasRichAward) return false;
          }
          return true;
        });

        // Preserve all distinct step approvals and deduplicate only exact identical calls (same step, actor, and action within 10s)
        const dedupped = [];
        for (const log of cleanLogs) {
          const logAction = String(log.action || log.eventType || '').toLowerCase().trim();
          const logTime = new Date(log.createdAt || log.occurredAt || log.timestamp || 0).getTime();
          const logStep = Number(log.step || 0);
          const logActor = String(log.actorName || log.actionedBy || log.performedBy || '').toLowerCase().trim();

          const isDuplicate = dedupped.some(item => {
            const itemAction = String(item.action || item.eventType || '').toLowerCase().trim();
            const itemTime = new Date(item.createdAt || item.occurredAt || item.timestamp || 0).getTime();
            const itemStep = Number(item.step || 0);
            const itemActor = String(item.actorName || item.actionedBy || item.performedBy || '').toLowerCase().trim();

            const sameAction = logAction === itemAction;
            const sameStep = logStep > 0 && itemStep > 0 ? logStep === itemStep : true;
            const sameActor = logActor && itemActor ? logActor === itemActor : true;
            const sameEntity = !log.entityId || !item.entityId || String(log.entityId) === String(item.entityId);
            const closeInTime = Math.abs(logTime - itemTime) < 10000;

            return sameAction && sameStep && sameActor && sameEntity && closeInTime;
          });

          if (!isDuplicate) {
            dedupped.push(log);
          }
        }

        setAuditLogs(dedupped);
      }
    } catch (e) {
      console.error('Error fetching audit trail:', e);
      setLoadError(e.message || 'Audit history could not be loaded.');
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
                Audit History <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{auditLogs.length}</span>
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
                  ) : loadError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
                      <p className="font-bold">Unable to load audit history</p>
                      <p className="mt-1">{loadError}</p>
                      <button type="button" onClick={fetchAuditLogs} className="mt-3 rounded-lg bg-rose-700 px-3 py-1.5 font-bold text-white">Try again</button>
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
                                {formatActionName(log.action || log.eventType)}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500">
                                {(() => {
                                  try {
                                    return new Date(log.createdAt || log.occurredAt || Date.now()).toLocaleString('en-IN', {
                                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    });
                                  } catch (_) {
                                    return String(log.createdAt || log.occurredAt || '');
                                  }
                                })()}
                              </span>
                            </div>

                            <p className="font-bold text-slate-900">
                              {actorNameFormatted}{' '}
                              <span className="text-slate-500 font-normal">({actorRoleFormatted})</span>
                            </p>

                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5">{log.entityType || entityType || 'Record'}</span>
                              <span className="max-w-[280px] truncate font-mono" title={log.entityId || entityId}>{log.entityId || entityId}</span>
                              {(() => {
                                const badgeText = getStageBadgeInfo(log);
                                if (!badgeText) return null;
                                return (
                                  <span className="rounded bg-teal-50 px-1.5 py-0.5 font-bold text-teal-700">
                                    {badgeText}
                                  </span>
                                );
                              })()}
                            </div>

                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-600">
                              <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Note</span>
                              <p>{formatAuditNote(log)}</p>
                            </div>
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
