import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, FileText, Loader2, LogOut, Search, ShieldCheck, Ship, Upload } from 'lucide-react';
import { useCustomAgent } from '../customAgentPortal/customAgentContext';
import { useToast } from '../../components/ui/toast';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100';
const statusText = (value) => ({ assigned_to_agent: 'With Customs Agent', material_received: 'Material Received', custom_cleared: 'Customs Cleared' }[value] || String(value || '').replaceAll('_', ' '));
const dateText = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function PortalShell({ children }) {
  const navigate = useNavigate(); const location = useLocation(); const { agentUser, logoutAgent } = useCustomAgent();
  const base = '/customs-agent';
  const logout = () => { logoutAgent(); navigate(`${base}/login`); };
  const links = [{ label: 'Dashboard', to: `${base}/dashboard` }, { label: 'BL Assignments', to: `${base}/bl-entries` }, { label: 'Profile', to: `${base}/profile` }];
  return <div className="min-h-screen bg-slate-50 pb-14 text-slate-800"><header className="sticky top-0 z-40 border-b bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"><div className="flex items-center gap-8"><button onClick={() => navigate(`${base}/dashboard`)} className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0d7676] font-extrabold text-white">R</span><strong>RAYZON <span className="font-medium text-[#0d7676]">SOLAR</span></strong></button><nav className="hidden gap-1 rounded-xl bg-slate-100 p-1 md:flex">{links.map((item) => <Link key={item.to} to={item.to} className={`rounded-lg px-3 py-2 text-xs font-bold ${location.pathname === item.to || (item.label === 'BL Assignments' && location.pathname.includes('/bl-entries')) ? 'bg-white text-[#0d7676] shadow-sm' : 'text-slate-600'}`}>{item.label}</Link>)}</nav></div><div className="flex items-center gap-3"><span className="hidden text-xs font-bold sm:block">{agentUser?.contactPerson || agentUser?.email}</span><button onClick={logout} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold text-rose-600"><LogOut className="h-4 w-4" />Sign Out</button></div></div></header><main className="mx-auto max-w-6xl px-4 pt-6">{children}</main></div>;
}

function Dashboard() {
  const { agentUser, assignedBls, fetchAssignedBls } = useCustomAgent(); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const refresh = async () => { setLoading(true); setError(''); try { await fetchAssignedBls(agentUser.agentId); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  const cleared = assignedBls.filter((item) => item.status === 'custom_cleared').length;
  return <div className="space-y-5"><section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d7676] to-[#0f766e] p-8 text-white shadow-md"><p className="text-xs font-bold uppercase text-teal-100">Customs Broker Portal</p><h1 className="mt-1 text-3xl font-extrabold">{agentUser.contactPerson || 'Customs Agent'}</h1><p className="text-xs text-teal-100">{agentUser.agencyName}</p><ShieldCheck className="absolute -bottom-12 right-4 h-44 w-44 opacity-15" /></section>{error && <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}<div className="grid gap-4 md:grid-cols-3">{[['Total Assigned', assignedBls.length, Ship, 'text-sky-600'], ['Pending Clearance', assignedBls.length - cleared, Clock, 'text-amber-600'], ['Customs Cleared', cleared, CheckCircle2, 'text-emerald-600']].map(([label, count, Icon, color]) => <div key={label} className="flex items-center justify-between rounded-2xl border bg-white p-5 shadow-sm"><div><p className="text-[10px] font-extrabold uppercase text-slate-400">{label}</p><p className={`mt-1 text-2xl font-black ${color}`}>{count}</p></div><Icon className={`h-6 w-6 ${color}`} /></div>)}</div><section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-sm font-extrabold">Recent BL Assignments</h2><p className="text-xs text-slate-500">Your latest customs-clearance work.</p></div><button onClick={refresh} disabled={loading} className="rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-bold text-white">{loading ? 'Refreshing...' : 'Refresh'}</button></div>{assignedBls.slice(0, 5).map((bl) => <Link key={bl.blId} to={`/customs-agent/bl-entries/${bl.blId}`} className="flex items-center justify-between border-b p-5 text-xs last:border-0 hover:bg-slate-50"><div><strong>{bl.blNumber}</strong><p className="mt-1 text-slate-500">{bl.vendorName || 'Vendor'} · {bl.containerCount} containers</p></div><span className={`rounded-full px-2 py-1 font-bold ${bl.status === 'custom_cleared' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{statusText(bl.status)}</span></Link>)}{!assignedBls.length && <div className="p-12 text-center text-xs text-slate-400">No assigned BL entries.</div>}</section></div>;
}

function AssignmentList() {
  const { agentUser, assignedBls, fetchAssignedBls } = useCustomAgent();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchAssignedBls(agentUser.agentId).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [agentUser.agentId, fetchAssignedBls]);

  const filtered = useMemo(() => assignedBls.filter((bl) => (!status || bl.status === status) && [bl.blNumber, bl.rfqNumber, bl.rfqId, bl.vendorName].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase()))), [assignedBls, query, status]);
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">BL Clearance Assignments</h1>
        <p className="text-xs text-slate-500">BL entries assigned to your customs-agent account.</p>
      </div>
      {error && <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex gap-2 border-b p-4">
          <label className="flex w-72 items-center gap-2 rounded-lg border bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search reference, vendor..." className="w-full bg-transparent py-2.5 text-xs outline-none" />
          </label>
          <div className="w-44">
            <SearchableSelect
              options={[
                { label: 'All Status', value: '' },
                { label: 'With Customs Agent', value: 'assigned_to_agent' },
                { label: 'Customs Cleared', value: 'custom_cleared' }
              ]}
              value={status}
              onChange={(val) => { setStatus(val); setPage(1); }}
              size="sm"
              searchable={false}
            />
          </div>
        </div>
        {loading ? (
          <div className="p-12"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th>BL Number</th>
                  <th>RFQ</th>
                  <th>Vendor</th>
                  <th>Containers</th>
                  <th>BOE</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th className="px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((bl, index) => (
                  <tr key={bl.blId} className="border-t">
                    <td className="px-4 py-4 text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                    <td className="font-bold">{bl.blNumber}</td>
                    <td>{bl.rfqNumber || bl.rfqId}</td>
                    <td>{bl.vendorName || '—'}</td>
                    <td>{bl.containerCount}</td>
                    <td>{bl.boeNumber || '—'}</td>
                    <td><span className="rounded-full bg-teal-50 px-2 py-1 font-bold text-[#0d7676]">{statusText(bl.status)}</span></td>
                    <td>{dateText(bl.assignedAt)}</td>
                    <td className="px-4"><Link to={`/customs-agent/bl-entries/${bl.blId}`} className="rounded-lg border px-3 py-2 font-bold">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="p-12 text-center text-xs text-slate-400">No assignments found.</div>}
            <ServerPagination
              page={page}
              totalPages={Math.ceil(filtered.length / pageSize) || 1}
              total={filtered.length}
              pageSize={pageSize}
              itemLabel="assignments"
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function AssignmentDetail({ blId }) {
  const { showToast } = useToast(); const { fetchAssignedBl, fetchAssignedBls, uploadBoe, uploadCustomsDocument, markAsCleared, agentUser } = useCustomAgent();
  const [bl, setBl] = useState(null); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [boe, setBoe] = useState({ boeNumber: '', dutyAmount: '' }); const [boeFile, setBoeFile] = useState(null); const [docType, setDocType] = useState(''); const [docFile, setDocFile] = useState(null); const [notes, setNotes] = useState('');
  const load = async () => { try { const next = await fetchAssignedBl(blId); setBl(next); setBoe({ boeNumber: next.boeNumber || '', dutyAmount: next.dutyAmount || '' }); setError(''); } catch (e) { setError(e.message); } };
  useEffect(() => { load(); }, [blId]);
  const saveBoe = async (event) => { event.preventDefault(); const hasExistingBoeDocument = bl.documents?.some((doc) => doc.docType === 'Customs Bill of Entry'); if (!boe.boeNumber.trim()) return setError('BOE Number is required.'); if (!boeFile && !hasExistingBoeDocument) return setError('BOE document is required.'); setSaving(true); setError(''); try { await uploadBoe(bl.blId, { ...boe, dutyAmount: Number(boe.dutyAmount) || 0, fileName: boeFile?.name || '' }); showToast({ type: 'success', title: 'BOE Saved', description: 'The Bill of Entry number and document are now linked to this BL.' }); setBoeFile(null); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  const saveDocument = async () => { if (!docType || !docFile) return setError('Select a customs document type and file.'); setSaving(true); setError(''); try { await uploadCustomsDocument(bl.blId, { docType, fileName: docFile.name }); setDocType(''); setDocFile(null); showToast({ type: 'success', title: 'Document Uploaded' }); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  const clear = async () => { const hasBoe = bl.documents?.some((doc) => doc.docType === 'Customs Bill of Entry'); if (!hasBoe) return setError('Upload the BOE document before customs clearance.'); if (!window.confirm(`Confirm customs clearance for BL ${bl.blNumber}? This locks customs documents.`)) return; setSaving(true); setError(''); try { await markAsCleared(bl.blId, notes); await fetchAssignedBls(agentUser.agentId); showToast({ type: 'success', title: 'Customs Cleared', description: 'The vendor can now submit logistics invoices.' }); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  if (!bl) return <div className="p-12 text-center">{error || <Loader2 className="mx-auto h-5 w-5 animate-spin" />}</div>; const cleared = bl.status === 'custom_cleared'; const hasBoeDocument = bl.documents?.some((doc) => doc.docType === 'Customs Bill of Entry'); if (!bl.boeNumber && hasBoeDocument) bl.boeNumber = 'Document on file';
  return <div className="space-y-4"><Link to="/customs-agent/bl-entries" className="inline-flex items-center gap-1 text-xs font-bold text-[#0d7676]"><ArrowLeft className="h-4 w-4" />BL Assignments</Link><div><h1 className="text-xl font-extrabold">BL: {bl.blNumber}</h1><p className="text-xs text-slate-500">{bl.rfqNumber || bl.rfqId} · {bl.vendorName} · {bl.containerCount} containers</p></div>{error && <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}<section className="grid gap-4 rounded-2xl border bg-white p-5 text-xs shadow-sm sm:grid-cols-3"><div><p className="text-slate-400">Assigned At</p><strong>{dateText(bl.assignedAt)}</strong></div><div><p className="text-slate-400">BOE Number</p><strong>{bl.boeNumber || 'Not uploaded'}</strong></div><div><p className="text-slate-400">Customs Cleared</p><strong className={cleared ? 'text-emerald-700' : 'text-amber-700'}>{cleared ? dateText(bl.customsClearedAt) : 'Pending'}</strong></div></section>{!cleared && <form onSubmit={saveBoe} className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-extrabold">Upload Bill of Entry (BOE)</h2><p className="mt-1 text-xs text-slate-500">A saved BOE number and document are mandatory before clearance.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><input value={boe.boeNumber} onChange={(e) => setBoe({ ...boe, boeNumber: e.target.value })} placeholder="BOE number" className={inputClass} /><input type="file" onChange={(e) => setBoeFile(e.target.files?.[0] || null)} className={inputClass} /></div><button disabled={saving} className="mt-3 rounded-lg bg-[#0d7676] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Save BOE</button></form>}<section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><h2 className="border-b px-5 py-4 text-sm font-extrabold">Documents ({bl.documents?.length || 0})</h2>{bl.documents?.map((doc, index) => <div key={`${doc.fileUrl}-${index}`} className="flex items-center justify-between border-b px-5 py-3 text-xs last:border-0"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#0d7676]" />{doc.docType}</span><span className="text-slate-500">{doc.fileUrl}</span><span className="text-slate-400">{dateText(doc.uploadedAt)}</span></div>)}</section>{!cleared && <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-sm font-extrabold">Upload Customs Documents</h2><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><SearchableSelect options={['Duty Calculation', 'Assessment Order', 'Examination Report', 'Out of Charge', 'Other Customs Document']} value={docType} onChange={(val) => setDocType(val)} placeholder="Select type" size="md" searchable={false} /><input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className={inputClass} /><button onClick={saveDocument} type="button" disabled={saving || !docType || !docFile} className="rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Upload</button></div></section>}<section className={`rounded-2xl border p-5 ${cleared ? 'border-emerald-200 bg-emerald-50' : 'border-teal-200 bg-teal-50'}`}><h2 className="text-sm font-extrabold">{cleared ? 'Customs Clearance Completed' : 'Mark as Customs Cleared'}</h2>{cleared ? <p className="mt-2 text-xs text-emerald-700">Clearance completed. Vendor logistics invoicing is enabled.</p> : <><p className="mt-1 text-xs text-slate-600">Review all documents before confirming. This action locks customs uploads.</p><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clearance notes (optional)" className={`${inputClass} mt-3`} /><button onClick={clear} className="mt-3 rounded-lg bg-[#0d7676] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="mr-1 inline h-4 w-4" />Confirm Customs Cleared</button>{!bl.boeNumber && <p className="mt-2 text-xs font-semibold text-amber-700">Upload the BOE before marking this BL as cleared.</p>}</>}</section></div>;
}

function Profile() { const { agentUser } = useCustomAgent(); return <div className="space-y-4"><h1 className="text-xl font-extrabold">My Profile</h1><section className="grid gap-5 rounded-2xl border bg-white p-6 text-xs shadow-sm sm:grid-cols-2">{[['Agency', agentUser.agencyName], ['Contact Person', agentUser.contactPerson], ['Email', agentUser.email], ['Phone', agentUser.phone], ['Port Location', agentUser.portLocation], ['Licence Number', agentUser.licenceNumber], ['Status', agentUser.status]].map(([label, value]) => <div key={label}><p className="text-slate-400">{label}</p><strong>{value || '—'}</strong></div>)}</section></div>; }

export default function CustomsBrokerPortalPage() {
  const navigate = useNavigate(); const location = useLocation(); const { blId } = useParams(); const { agentUser } = useCustomAgent();
  useEffect(() => { if (!agentUser?.isLoggedIn) navigate('/customs-agent/login', { replace: true }); }, [agentUser, navigate]);
  if (!agentUser?.isLoggedIn) return null;
  let content = <Dashboard />;
  if (location.pathname.includes('/bl-entries/')) content = <AssignmentDetail blId={blId} />;
  else if (location.pathname.endsWith('/bl-entries')) content = <AssignmentList />;
  else if (location.pathname.endsWith('/profile')) content = <Profile />;
  return <PortalShell>{content}</PortalShell>;
}
