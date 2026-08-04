import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import DocumentUploader from '../../components/shared/DocumentUploader';
import { 
  ChevronLeft, 
  Building2, 
  Wallet, 
  CreditCard,
  FileText,
  Loader2,
  Plus,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpRight
} from 'lucide-react';

// ── Per-status display config ─────────────────────────────────────────────────
const STATUS_STYLE = {
  draft:    { label: 'Draft',    pill: 'bg-slate-100 text-slate-600 border-slate-200',       icon: Clock,         iconBox: 'bg-slate-100 text-slate-500 border-slate-200',   ref: 'text-slate-700' },
  pending:  { label: 'Pending',  pill: 'bg-amber-50 text-amber-700 border-amber-200',         icon: Clock,         iconBox: 'bg-amber-50 text-amber-600 border-amber-200',    ref: 'text-amber-700' },
  approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',   icon: CheckCircle2,  iconBox: 'bg-emerald-50 text-emerald-600 border-emerald-200', ref: 'text-emerald-700' },
  rejected: { label: 'Rejected', pill: 'bg-rose-50 text-rose-700 border-rose-200',            icon: XCircle,       iconBox: 'bg-rose-50 text-rose-500 border-rose-200',       ref: 'text-rose-600' },
  returned: { label: 'Returned', pill: 'bg-orange-50 text-orange-700 border-orange-200',      icon: RotateCcw,     iconBox: 'bg-orange-50 text-orange-600 border-orange-200', ref: 'text-orange-700' },
  paid:     { label: 'Paid',     pill: 'bg-sky-50 text-sky-700 border-sky-200',               icon: CheckCircle2,  iconBox: 'bg-sky-50 text-sky-600 border-sky-200',          ref: 'text-sky-700' }
};

export default function PurchaseOrderDetailView() {
  const { poId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState({
    poNumber: poId || '4100005459',
    vendorName: 'SWASTIK OIL AGENCIES',
    vendorCode: '10000955',
    gstNumber: '24ABDFG4575G1ZU',
    companyCode: '1000',
    plant: '1300 Kosamba-Rayzon Solar Limited',
    poDate: '16 Jul 2026',
    delivery: '—',
    paymentTerms: 'Net Due in 30 Days',
    type: 'Domestic',
    poValue: 43164.40,
    currency: 'INR',
    paidAmount: 0.00,
    inProgressAmount: 12949.32,
    availableAmount: 30215.08,
    status: 'Open'
  });

  const [activeTab, setActiveTab] = useState('advances');
  const [advances, setAdvances] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchPoAndRelatedData();
  }, [poId]);

  const fetchPoAndRelatedData = async () => {
    try {
      setLoading(true);
      // 1. Fetch PO from backend
      const poRes = await apiFetch('/api/p2p/purchase-orders');
      if (poRes.ok) {
        const poJson = await poRes.json();
        if (poJson.data) {
          const found = poJson.data.find(p => (p.sapPoNumber === poId || p.poNumber === poId || p.poNumber === `PO-${poId}`));
          if (found) {
            const val = found.totalAmount || 43164.40;
            const paid = found.advancePaid || 0.00;
            const inProg = 12949.32;
            setPo({
              poNumber: found.sapPoNumber || found.poNumber,
              vendorName: found.supplierName || 'SWASTIK OIL AGENCIES',
              vendorCode: found.supplierId || '10000955',
              gstNumber: '24ABDFG4575G1ZU',
              companyCode: found.companyCode || '1000',
              plant: '1300 Kosamba-Rayzon Solar Limited',
              poDate: '16 Jul 2026',
              delivery: '—',
              paymentTerms: 'Net Due in 30 Days',
              type: (found.poNumber || '').startsWith('PO-43') || (found.poNumber || '').startsWith('60') ? 'Import' : 'Domestic',
              poValue: val,
              currency: found.currency || 'INR',
              paidAmount: paid,
              inProgressAmount: inProg,
              availableAmount: val - (paid + inProg),
              status: 'Open'
            });
          }
        }
      }

      // 2. Fetch Advances from MongoDB backend
      const advRes = await apiFetch('/api/p2p/advances');
      if (advRes.ok) {
        const advJson = await advRes.json();
        if (advJson.data) {
          const matched = advJson.data.filter(a => 
            a.sapPoNumber === poId || a.poId === poId || a.poNumber === poId
          );
          
          if (matched.length > 0) {
            setAdvances(matched.map(item => ({
              id: item.advanceId || 'ADV-20260717-0002',
              reference: item.advanceId || 'ADV-20260717-0002',
              status: item.status || 'draft',
              mode: item.paymentMode || 'NEFT',
              date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '17 Jul 2026',
              requestedBy: item.createdBy || 'Vaibhav Parekh',
              amount: item.amount || 12949.32,
              currency: 'INR',
              pctOfPo: `${item.percentageOfPo || 30}.00%`
            })));
          } else {
            setAdvances([
              {
                id: 'ADV-20260717-0002',
                reference: 'ADV-20260717-0002',
                status: 'draft',
                mode: 'NEFT',
                date: '17 Jul 2026',
                requestedBy: 'Vaibhav Parekh',
                amount: 12949.32,
                currency: 'INR',
                pctOfPo: '30.00%'
              }
            ]);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching PO details:', e);
    } finally {
      setLoading(false);
    }
  };

  const percentUtilized = (((po.paidAmount + po.inProgressAmount) / (po.poValue || 1)) * 100);

  return (
    <div className="w-full space-y-4 font-sans text-slate-800 pb-10">
      
      {/* 1. Header Toolbar with Quick Action Buttons */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <Link to="/p2p/purchase-orders" className="hover:text-slate-900 transition-colors flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Purchase Orders
            </Link>
            <span>/</span>
            <span className="font-bold text-slate-800 font-mono">{po.poNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">{po.poNumber}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              po.type === 'Import' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {po.type}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
              {po.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => navigate('/p2p/advance-payments/create')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" /> New Advance Payment
          </button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-start">
        
        {/* LEFT COLUMN (4 Cols / ~35% width) */}
        <div className="lg:col-span-4 space-y-4 w-full text-left">
          
          {/* Card 1: PO & Vendor Specs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PURCHASE ORDER DETAILS</p>
              <span className="text-xs font-mono font-bold text-slate-500">SAP #{po.poNumber}</span>
            </div>

            {/* Vendor Card Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> VENDOR
              </p>
              <p className="font-extrabold text-slate-900 text-xs leading-snug">{po.vendorName}</p>
              <p className="text-[11px] text-slate-500 font-mono">{po.vendorCode}</p>
              
              <div className="pt-2 border-t border-slate-200/80 mt-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">GST</span>
                <span className="text-xs font-mono font-bold text-slate-700">{po.gstNumber}</span>
              </div>
            </div>

            {/* Grid Attributes */}
            <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">COMPANY CODE</p>
                <p className="font-bold text-slate-900 mt-0.5">{po.companyCode}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PLANT</p>
                <p className="font-bold text-slate-900 mt-0.5">{po.plant}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PO DATE</p>
                <p className="font-bold text-slate-900 mt-0.5">{po.poDate}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DELIVERY</p>
                <p className="font-bold text-slate-900 mt-0.5">{po.delivery}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PAYMENT TERMS</span>
              <span className="font-extrabold text-slate-900 text-xs">{po.paymentTerms}</span>
            </div>
          </div>

          {/* Card 2: Financial Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">FINANCIAL SUMMARY</p>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            
            <div className="space-y-2 text-xs">
              {/* Row 1: PO Value */}
              <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between border border-slate-100">
                <span className="font-bold text-slate-600 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> PO Value
                </span>
                <span className="font-extrabold text-slate-900 font-mono text-xs">{po.currency} {po.poValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Row 2: Paid */}
              <div className="bg-emerald-50/60 p-3 rounded-xl flex items-center justify-between border border-emerald-100">
                <span className="font-bold text-emerald-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Paid
                </span>
                <span className="font-extrabold text-emerald-800 font-mono text-xs">{po.currency} {po.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Row 3: In Progress */}
              <div className="bg-amber-50/60 p-3 rounded-xl flex items-center justify-between border border-amber-100">
                <span className="font-bold text-amber-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> In Progress
                </span>
                <span className="font-extrabold text-amber-800 font-mono text-xs">{po.currency} {po.inProgressAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Row 4: Available */}
              <div className="bg-sky-50/60 p-3 rounded-xl flex items-center justify-between border border-sky-100">
                <span className="font-bold text-sky-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Available
                </span>
                <span className="font-extrabold text-sky-800 font-mono text-xs">{po.currency} {po.availableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Utilization Bar */}
            <div className="pt-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-semibold mb-1">
                <span>Budget Utilized</span>
                <span className="font-bold text-emerald-700">{percentUtilized.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                <div style={{ width: `${percentUtilized}%` }} className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full"></div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (8 Cols / ~65% width) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col min-h-[500px] w-full text-left">
          
          {/* Tab Navigation Bar */}
          <div className="flex items-center border-b border-slate-200 bg-slate-50/50 px-5 pt-3 gap-6 text-xs font-semibold text-slate-500 overflow-x-auto">
            <button
              onClick={() => setActiveTab('advances')}
              className={`pb-3 transition-colors border-b-2 font-bold flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'advances' ? 'border-[#0d7676] text-[#0d7676]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Advance Payments <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-700">{advances.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`pb-3 transition-colors border-b-2 font-bold flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'invoices' ? 'border-[#0d7676] text-[#0d7676]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Invoice Payments <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-700">{invoices.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('rfqs')}
              className={`pb-3 transition-colors border-b-2 font-bold flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'rfqs' ? 'border-[#0d7676] text-[#0d7676]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              RFQs <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-700">{rfqs.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`pb-3 transition-colors border-b-2 font-bold flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'documents' ? 'border-[#0d7676] text-[#0d7676]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Documents <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-700">{documents.length}</span>
            </button>
          </div>

          {/* TAB 1: ADVANCE PAYMENTS */}
          {activeTab === 'advances' && (
            <div className="p-4 flex-1">
              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 text-[#0d7676] animate-spin" />
                  <p className="font-medium">Loading advance payments...</p>
                </div>
              ) : advances.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Wallet className="w-8 h-8 text-slate-300" />
                  <p className="font-semibold text-slate-700">No advance payments found for this PO</p>
                  <button
                    onClick={() => navigate('/p2p/advance-payments/create')}
                    className="mt-1 px-4 py-1.5 rounded-xl bg-[#0d7676] text-white font-bold text-xs shadow-xs"
                  >
                    + Create Advance Payment
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {advances.map(item => {
                    const s = STATUS_STYLE[item.status] || STATUS_STYLE.draft;
                    const Icon = s.icon;
                    return (
                      <Link
                        key={item.id}
                        to={`/p2p/advance-payments/${item.reference}`}
                        className="p-4 rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-sm bg-white flex items-center justify-between gap-4 transition-all"
                      >
                        {/* Left: Status-colored icon + info */}
                        <div className="flex items-center gap-3.5">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${s.iconBox}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-mono font-bold text-xs ${s.ref}`}>{item.reference}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.pill}`}>
                                {s.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {item.mode} · {item.date} · {item.requestedBy}
                            </p>
                          </div>
                        </div>

                        {/* Right: Amount + % */}
                        <div className="text-right shrink-0">
                          <p className="font-mono font-extrabold text-slate-900 text-xs">
                            {item.currency} {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                            {item.pctOfPo} of PO
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INVOICE PAYMENTS */}
          {activeTab === 'invoices' && (
            <div className="p-12 flex-1 flex flex-col items-center justify-center text-center text-xs text-slate-400">
              <CreditCard className="w-8 h-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No invoice payments registered</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Invoices submitted against this PO will be listed here.</p>
            </div>
          )}

          {/* TAB 3: RFQs */}
          {activeTab === 'rfqs' && (
            <div className="p-12 flex-1 flex flex-col items-center justify-center text-center text-xs text-slate-400">
              <FileSpreadsheet className="w-8 h-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No freight RFQs associated</p>
            </div>
          )}

          {/* TAB 4: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="p-5">
              <DocumentUploader
                documentableType="PurchaseOrder"
                documentableId={po.poNumber}
                documentType="po_copy"
                multiple={true}
              />
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
