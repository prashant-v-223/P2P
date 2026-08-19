import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useVendor } from './vendorContext';
import FreightForwarderDashboard from './FreightForwarderDashboard';
import {
  FileSpreadsheet,
  HandCoins,
  Building2,
  FileUp,
  Info,
  ArrowUpRight,
  PackageCheck,
  Sparkles,
  UserCheck,
  Mail,
  PhoneCall,
  Receipt,
  FileText
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

export default function VendorDashboardPage() {
  const { vendorProfile, purchaseOrders, invoices, advances } = useVendor();
  const navigate = useNavigate();

  const handleSelectPO = (poId) => {
    navigate('/vendor/invoices/upload', { state: { selectedPO: poId } });
  };

  const approvedInvoicesCount = invoices.filter((i) => i.status === 'Approved').length;
  const paidInvoicesCount = invoices.filter((i) => i.status === 'Paid').length;
  const isFreightForwarder = /(freight|forwarder|logistics|shipping)/i.test(`${vendorProfile.vendorType || ''} ${vendorProfile.category || ''}`);
  const isImportVendor = String(vendorProfile.vendorType || '').toLowerCase().includes('import');

  if (isFreightForwarder) return <FreightForwarderDashboard />;

  return (
    <div className="space-y-4 pb-7 font-sans antialiased">
      {/* Top Banner (Corporate Deep Teal Banner) */}
      <section className="relative overflow-hidden rounded-2xl bg-[#0d7676] px-5 py-5 text-white shadow-lg shadow-teal-900/10 sm:px-6 sm:py-6">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-teal-100 backdrop-blur-xs">
                <Sparkles className="h-3.5 w-3.5" /> {vendorProfile.vendorType}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-teal-100 backdrop-blur-xs">
                Code: {vendorProfile.sapVendorCode}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-100 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {vendorProfile.status}
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {vendorProfile.companyName}
            </h2>
            <div className="text-xs leading-5 text-teal-50/90 font-medium flex flex-wrap items-center gap-4 pt-0.5">
              <span className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-teal-200" /> {vendorProfile.contactPerson}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-teal-200" /> {vendorProfile.email}
              </span>
              <span className="flex items-center gap-1.5">
                <PhoneCall className="h-3.5 w-3.5 text-teal-200" /> {vendorProfile.phone}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/vendor/invoices/upload')}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#0d7676] transition hover:bg-teal-50 shadow-xs active:scale-[0.99]"
          >
            Submit Invoice <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3 text-xs text-teal-50 font-medium flex items-center gap-2 backdrop-blur-xs">
          <Info className="h-4 w-4 shrink-0 text-teal-200" />
          <span>As {isImportVendor ? 'an import' : 'a domestic'} vendor, you can submit invoices against open purchase orders and track advance payments.</span>
        </div>
      </section>

      {/* 3 Metric Summary Cards with Enhanced Meaningful Icons */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* OPEN POS */}
        <div className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-teal-300 hover:shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-blue-50 text-blue-600 ring-1 ring-blue-100/80 shadow-2xs">
                <PackageCheck className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-[#0d7676]" />
            </div>
            <p className="mt-3.5 text-xs font-bold text-slate-500">OPEN POS</p>
            <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">{purchaseOrders.length}</p>
            <p className="mt-1 text-xs text-slate-400 font-medium">Ready to Invoice</p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-100">
            <Link to="/vendor/invoices/upload" className="text-xs font-bold text-[#0d7676] hover:underline flex items-center gap-1">
              Submit Invoice <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* INVOICES */}
        <div className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-teal-300 hover:shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/80 shadow-2xs">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-[#0d7676]" />
            </div>
            <p className="mt-3.5 text-xs font-bold text-slate-500">INVOICES</p>
            <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">{invoices.length}</p>
            <p className="mt-1 text-xs text-slate-400 font-medium">{approvedInvoicesCount} approved · {paidInvoicesCount} paid</p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-100">
            <Link to="/vendor/invoices" className="text-xs font-bold text-[#0d7676] hover:underline flex items-center gap-1">
              View Invoices <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* ADVANCES PENDING */}
        <div className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-teal-300 hover:shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="rounded-xl p-2.5 bg-amber-50 text-amber-700 ring-1 ring-amber-100/80 shadow-2xs">
                <HandCoins className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-[#0d7676]" />
            </div>
            <p className="mt-3.5 text-xs font-bold text-slate-500">ADVANCES PENDING</p>
            <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">{advances.length}</p>
            <p className="mt-1 text-xs text-slate-400 font-medium">{advances.filter((a) => a.status === 'In Progress').length} awaiting payment</p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-100">
            <Link to="/vendor/advances" className="text-xs font-bold text-[#0d7676] hover:underline flex items-center gap-1">
              View Advances <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS SECTION */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          QUICK ACTIONS
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/vendor/invoices/upload"
            className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-teal-300 hover:shadow-md flex items-center gap-3.5"
          >
            <div className="rounded-xl p-2.5 bg-blue-50 text-blue-600 ring-1 ring-blue-100/80 group-hover:scale-105 transition-transform shadow-2xs">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#0d7676] transition-colors">
                Upload Invoice
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">Submit new invoice</p>
            </div>
          </Link>

          <Link
            to="/vendor/advances"
            className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-teal-300 hover:shadow-md flex items-center gap-3.5"
          >
            <div className="rounded-xl p-2.5 bg-purple-50 text-purple-600 ring-1 ring-purple-100/80 group-hover:scale-105 transition-transform shadow-2xs">
              <HandCoins className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#0d7676] transition-colors">
                Advance Payments
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">View issued advances</p>
            </div>
          </Link>

          <Link
            to="/vendor/profile"
            className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-teal-300 hover:shadow-md flex items-center gap-3.5"
          >
            <div className="rounded-xl p-2.5 bg-teal-50 text-[#0d7676] ring-1 ring-teal-100/80 group-hover:scale-105 transition-transform shadow-2xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#0d7676] transition-colors">
                My Profile
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">View bank & tax details</p>
            </div>
          </Link>
        </div>
      </section>

      {/* BOTTOM TWO COLUMNS SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Recent Purchase Orders */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-[#0d7676]" />
              Recent Purchase Orders
            </h3>
            <Link to="/vendor/invoices/upload" className="text-xs font-bold text-[#0d7676] hover:underline flex items-center gap-1">
              Submit Invoice <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {purchaseOrders.length === 0 ? (
              <p className="py-8 text-center text-xs font-medium text-slate-400">No open purchase orders available.</p>
            ) : purchaseOrders.slice(0, 4).map((po) => (
              <div
                key={po.id}
                onClick={() => handleSelectPO(po.id)}
                className="p-3 rounded-xl border border-slate-150 hover:border-teal-300 bg-slate-50/50 hover:bg-teal-50/20 transition flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 group-hover:text-[#0d7676] transition-colors">
                      {po.id}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200/60">
                      {po.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium block mt-0.5 whitespace-nowrap">
                    PO: {po.date} · Due: {po.dueDate || '—'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs font-extrabold text-slate-900 block whitespace-nowrap font-mono">
                    {formatCurrency(po.numericAmount, po.currency)}
                  </span>
                  <span className="text-[10px] font-bold text-[#0d7676] group-hover:underline">
                    Submit Invoice →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Recent Invoices */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-600" />
                Recent Invoices
              </h3>
              <Link to="/vendor/invoices" className="text-xs font-bold text-slate-500 hover:text-slate-700">
                View All →
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-1">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-600">No invoices submitted yet.</p>
                <Link to="/vendor/invoices/upload" className="text-xs font-bold text-[#0d7676] hover:underline">
                  Submit your first invoice →
                </Link>
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {invoices.slice(0, 4).map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/vendor/invoices/view/${encodeURIComponent(inv.id || inv.invoiceNumber)}`}
                    className="p-3 rounded-xl border border-slate-150 hover:border-teal-300 bg-slate-50/50 hover:bg-teal-50/20 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-[#0d7676]">{inv.invoiceNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                          {inv.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">PO: {inv.poNumber} · {inv.invoiceDate}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 whitespace-nowrap font-mono">{formatCurrency(inv.invoiceAmount, inv.currency)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
