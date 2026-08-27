import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import FileUploadZone from '../../components/shared/FileUploadZone';
import { 
  ArrowLeft, 
  Ship, 
  Check, 
  Search, 
  Loader2, 
  AlertCircle,
  Calendar,
  Layers,
  Building2,
  FileCheck,
  FileText,
  ChevronDown
} from 'lucide-react';


function PoSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [poList, setPoList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputVal, setInputVal] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setInputVal(value || ''); }, [value]);

  useEffect(() => {
    async function loadPos() {
      try {
        setLoading(true);
        const res = await apiFetch('/api/p2p/purchase-orders?size=100');
        const json = await res.json();
        if (res.ok && json.data) {
          setPoList(json.data.filter((po) => {
            const status = String(po.status || '').trim().toLowerCase();
            return Number(po.totalAmount) > 0 && !['closed', 'cancelled', 'canceled', 'blocked'].includes(status);
          }));
        }
      } catch (e) {
        console.error('Fetch PO error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadPos();
  }, []);

  useEffect(() => {
    const clickHandler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', clickHandler);
    return () => document.removeEventListener('mousedown', clickHandler);
  }, []);

  const filtered = poList.filter(po => {
    const q = inputVal.toLowerCase().trim();
    if (!q) return true;
    const num = (po.poNumber || po.sapPoNumber || po.poId || '').toLowerCase();
    const vendor = (po.supplierName || po.vendorName || '').toLowerCase();
    const desc = (po.description || '').toLowerCase();
    return num.includes(q) || vendor.includes(q) || desc.includes(q);
  });

  const selectedPoObj = poList.find(p => String(p.poNumber || p.sapPoNumber || p.poId) === String(value));

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
        <span>Linked SAP Purchase Order <span className="text-rose-500">*</span></span>
        {selectedPoObj && (
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            ✓ Open (₹{Number(selectedPoObj.totalAmount || 0).toLocaleString('en-IN')})
          </span>
        )}
      </label>

      <div
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus-within:ring-2 focus-within:ring-[#0d7676] focus-within:bg-white transition flex items-center gap-2 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          type="text"
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search or type PO number (e.g. 4100005638)"
          className="flex-1 bg-transparent outline-none font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
        />
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100">
          {filtered.length > 0 ? (
            filtered.map((po) => {
              const num = po.poNumber || po.sapPoNumber || po.poId;
              const isSelected = String(value) === String(num);
              return (
                <div
                  key={po._id || num}
                  onClick={() => {
                    onChange(num);
                    setInputVal(num);
                    setOpen(false);
                  }}
                  className={`p-3 text-xs cursor-pointer hover:bg-teal-50 transition flex items-center justify-between ${isSelected ? 'bg-teal-50/80 border-l-4 border-l-[#0d7676]' : ''}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900">{num}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">
                        {po.status || 'open'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                      {po.supplierName || 'SAP Vendor'} {po.currency ? `· ${po.currency}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-700 text-xs">
                      ₹{Number(po.totalAmount || 0).toLocaleString('en-IN')}
                    </span>
                    {isSelected && <p className="text-[9px] text-[#0d7676] font-bold">Selected</p>}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center space-y-2">
              <p className="text-xs text-slate-500 font-medium">No existing PO found matching "{inputVal}"</p>
              <p className="text-[10px] font-semibold text-slate-400">Create or sync the purchase order from Purchase Order Management first.</p>
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] text-slate-400 font-medium">
        Select an existing open SAP purchase order.
      </p>
    </div>
  );
}

export default function RfqFormView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { showToast } = useToast();

  const isEdit = Boolean(id);
  const copyFrom = location.state?.copyFrom;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rfqStatus, setRfqStatus] = useState('');

  // Form State
  const [title, setTitle] = useState(copyFrom?.title || '');
  const [linkedPoId, setLinkedPoId] = useState(copyFrom?.poId || '');
  const [closingDate, setClosingDate] = useState('');
  const [description, setDescription] = useState('');

  // Shipment Requirements
  const [shippingTerms, setShippingTerms] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [containerType, setContainerType] = useState('');
  const [containerCount, setContainerCount] = useState('1');
  const [weightPerContainer, setWeightPerContainer] = useState('');
  const [estimatedReadinessDate, setEstimatedReadinessDate] = useState('');

  // Logistics / Freight Forwarder Vendors (Rule: RFQ only show Freight Forwarder user)
  const [logisticsVendors, setLogisticsVendors] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');

  // Documents
  const [documents, setDocuments] = useState([]);

  // Fetch logistics vendors (filtered to Freight Forwarders only) & load existing RFQ for edit
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const resV = await apiFetch('/api/p2p/rfqs/logistics-vendors');
        const jsonV = await resV.json();
        if (resV.ok && jsonV.data) {
          setLogisticsVendors(jsonV.data);
        }

        if (isEdit && id) {
          const resR = await apiFetch(`/api/p2p/rfqs/${id}`);
          const jsonR = await resR.json();
          if (resR.ok && jsonR.data) {
            const data = jsonR.data;
            setRfqStatus(data.status || '');
            setTitle(data.title || '');
            setLinkedPoId(data.poId || data.sapPoNumber || '');
            setDescription(data.description || '');
            if (data.closingDate) {
              setClosingDate(new Date(data.closingDate).toISOString().slice(0, 16));
            }
            const cargo = data.cargoDetails || {};
            setShippingTerms(cargo.shippingTerms || '');
            setCargoType(cargo.cargoType || '');
            setPortOfLoading(cargo.portOfOrigin || '');
            setPortOfDischarge(cargo.portOfDestination || '');
            setContainerType(cargo.containerType || '');
            setContainerCount(String(cargo.containerCount || 1));
            setWeightPerContainer(cargo.weightPerContainer || '');
            setEstimatedReadinessDate(cargo.estimatedReadinessDate ? new Date(cargo.estimatedReadinessDate).toISOString().slice(0, 10) : '');
            setSelectedVendors((data.invitedVendors || []).map((vendor) => vendor.vendorId || vendor.sapVendorCode).filter(Boolean));
          }
        } else if (copyFrom) {
          const data = copyFrom;
          const cleanTitle = data.title ? (data.title.startsWith('COPY -') ? data.title : `COPY - ${data.title}`) : '';
          setTitle(cleanTitle);
          setLinkedPoId(data.poId || data.sapPoNumber || '');
          setDescription(data.description || '');
          if (data.closingDate) {
            setClosingDate(new Date(data.closingDate).toISOString().slice(0, 16));
          } else {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            setClosingDate(d.toISOString().slice(0, 16));
          }
          const cargo = data.cargoDetails || {};
          setShippingTerms(cargo.shippingTerms || '');
          setCargoType(cargo.cargoType || '');
          setPortOfLoading(cargo.portOfOrigin || '');
          setPortOfDischarge(cargo.portOfDestination || '');
          setContainerType(cargo.containerType || '');
          setContainerCount(String(cargo.containerCount || 1));
          setWeightPerContainer(cargo.weightPerContainer || '');
          setEstimatedReadinessDate(cargo.estimatedReadinessDate ? new Date(cargo.estimatedReadinessDate).toISOString().slice(0, 10) : '');
          setSelectedVendors((data.invitedVendors || []).map((vendor) => vendor.vendorId || vendor.sapVendorCode || vendor.id).filter(Boolean));
        }
      } catch (e) {
        console.error('Fetch data error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, isEdit, copyFrom]);

  const toggleVendor = (vId) => {
    setSelectedVendors((prev) =>
      prev.includes(vId) ? prev.filter((i) => i !== vId) : [...prev, vId]
    );
  };

  const filteredLogisticsVendors = logisticsVendors.filter((v) =>
    v.companyName?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.sapVendorCode?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const normalizedLoadingPort = portOfLoading.trim().toLowerCase();
  const normalizedDischargePort = portOfDischarge.trim().toLowerCase();
  const portsAreSame = Boolean(normalizedLoadingPort && normalizedDischargePort && normalizedLoadingPort === normalizedDischargePort);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast({ title: 'Validation Error', description: 'RFQ Title is required.', type: 'error' });
      return;
    }
    if (!linkedPoId.trim()) return showToast({ title: 'Validation Error', description: 'A valid linked purchase order is required.', type: 'error' });
    if (!closingDate || new Date(closingDate) <= new Date()) return showToast({ title: 'Validation Error', description: 'Closing date and time must be in the future.', type: 'error' });
    if (!shippingTerms.trim()) return showToast({ title: 'Validation Error', description: 'Shipping Terms are required.', type: 'error' });
    if (!cargoType.trim()) return showToast({ title: 'Validation Error', description: 'Cargo Type is required.', type: 'error' });
    if (selectedVendors.length === 0) {
      showToast({ title: 'Validation Error', description: 'Select at least one Freight Forwarder.', type: 'error' });
      return;
    }
    if (!portOfLoading.trim()) {
      showToast({ title: 'Validation Error', description: 'Port of Loading is required.', type: 'error' });
      return;
    }
    if (!portOfDischarge.trim()) {
      showToast({ title: 'Validation Error', description: 'Port of Discharge is required.', type: 'error' });
      return;
    }
    if (portsAreSame) return showToast({ title: 'Select Different Ports', description: 'Change either Port of Loading or Port of Discharge. A shipment cannot start and end at the same port.', type: 'error' });
    if (!containerType.trim()) return showToast({ title: 'Validation Error', description: 'Container Type is required.', type: 'error' });
    if (!Number.isInteger(Number(containerCount)) || Number(containerCount) <= 0) return showToast({ title: 'Validation Error', description: 'Number of containers must be a positive whole number.', type: 'error' });
    if (weightPerContainer !== '' && !(Number(weightPerContainer) > 0)) return showToast({ title: 'Validation Error', description: 'Weight per container must be greater than zero.', type: 'error' });

    setSaving(true);
    try {
      const payload = {
        title,
        linkedPoId,
        closingDate,
        description,
        shippingTerms,
        cargoType,
        portOfLoading,
        portOfDischarge,
        containerType,
        containerCount,
        weightPerContainer,
        estimatedReadinessDate,
        invitedVendors: selectedVendors.map((vendorId) => {
          const vendor = logisticsVendors.find((item) => item.id === vendorId || item.sapVendorCode === vendorId);
          return {
            vendorId: vendor?.id || vendorId,
            sapVendorCode: vendor?.sapVendorCode || vendorId,
            companyName: vendor?.companyName || 'Freight Forwarder'
          };
        })
      };

      const endpoint = isEdit ? `/api/p2p/rfqs/${id}` : '/api/p2p/rfqs';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save RFQ');
      }

      const rfqId = json.data?.rfqId || json.data?.rfqNumber || id;

      // Step 2: Upload newly attached documents for both create and edit flows.
      if (documents.length > 0 && rfqId) {
        const formData = new FormData();
        documents.forEach(doc => {
          formData.append('files', doc.file);
        });
        formData.append('documentType', 'rfq_document');
        formData.append('documentableType', 'RfqHeader');
        formData.append('documentableId', rfqId);

        try {
          const docRes = await apiFetch('/api/documents/upload-multiple', {
            method: 'POST',
            body: formData
          });
          const docJson = await docRes.json();
          
          if (!docRes.ok) {
            console.error('Document upload failed:', docJson.error);
            showToast({
              title: isEdit ? 'RFQ Updated' : 'RFQ Created',
              description: `RFQ ${rfqId} saved but documents failed to upload. You can add them later from the detail view.`,
              type: 'warning',
              duration: 5000
            });
          } else {
            showToast({
              title: isEdit ? 'RFQ Updated' : 'RFQ Created & Published',
              description: `RFQ ${rfqId} with ${docJson.data?.uploaded?.length || documents.length} document(s) saved successfully.`,
              type: 'success'
            });
          }
        } catch (docError) {
          console.error('Document upload error:', docError);
          showToast({
            title: isEdit ? 'RFQ Updated' : 'RFQ Created',
            description: `RFQ ${rfqId} saved but documents failed to upload. You can add them later from the detail view.`,
            type: 'warning',
            duration: 5000
          });
        }
      } else {
        showToast({
          title: isEdit ? 'RFQ Updated' : 'RFQ Created & Published',
          description: `RFQ ${rfqId} saved successfully.`,
          type: 'success'
        });
      }

      navigate('/admin/rfqs');
    } catch (err) {
      showToast({ title: 'Error', description: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleFilesSelected = (newFiles) => {
    setDocuments(prev => [...prev, ...newFiles]);
  };

  const handleFileRemove = (index) => {
    setDocuments(docs => docs.filter((_, i) => i !== index));
  };

  const isNonEditableStatus = isEdit && ['pending_approval', 'awarded', 'closed', 'cancelled'].includes(String(rfqStatus || '').toLowerCase());

  return (
    <div className="w-full space-y-6 font-sans pb-24 antialiased text-left">
      {isNonEditableStatus && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-extrabold text-xs text-amber-900">RFQ Cannot Be Edited</p>
              <p className="text-xs font-semibold text-amber-700 mt-0.5">
                This RFQ is currently in <span className="font-black uppercase">{rfqStatus?.replace('_', ' ')}</span> status and its specifications cannot be modified.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/admin/rfqs/${id}`)}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer"
          >
            View RFQ Details
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/rfqs')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d7676] hover:underline transition mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to RFQs</span>
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {isEdit ? 'Edit RFQ Details' : 'Create New RFQ'}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Set up logistics requirements and invite freight forwarders for competitive bidding.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/rfqs')}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || isNonEditableStatus}
            className="px-5 py-2 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-black text-xs shadow-2xs transition cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{saving ? 'Saving...' : isEdit ? 'Update RFQ' : 'Create & Publish RFQ'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: RFQ Details */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-5">
          <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
            <Ship className="w-4 h-4 text-[#0d7676]" />
            1. RFQ Header Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                RFQ Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ocean Freight Sourcing — Container Logistics"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] focus:bg-white outline-none transition"
              />
            </div>

            <PoSelector value={linkedPoId} onChange={setLinkedPoId} />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Quotation Deadline (Date & Time) <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0d7676] outline-none transition"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">Internal Description & Scope of Bidding</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter detailed scope, bidding rules, or special instructions for freight forwarders..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676] outline-none transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Shipment Requirements */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0d7676]" />
              2. Shipment Requirements
            </h2>
            <span className="text-[10px] font-extrabold text-[#0d7676] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              Required Specs
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Shipping Terms <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={shippingTerms}
                onChange={(e) => setShippingTerms(e.target.value)}
                placeholder="e.g. FOB / CIF / EXW"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Cargo Type <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                placeholder="e.g. SOLAR CELL / SOLAR GLASS"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Port of Loading <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="major-loading-ports"
                value={portOfLoading}
                onChange={(e) => setPortOfLoading(e.target.value)}
                aria-invalid={portsAreSame}
                placeholder="e.g. SHANGHAI (CNSHA)"
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition ${portsAreSame ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'}`}
              />
              <datalist id="major-loading-ports">
                <option value="SHANGHAI (CNSHA)" />
                <option value="NINGBO (CNNGB)" />
                <option value="QINGDAO (CNTAO)" />
                <option value="SHENZHEN (CNSZX)" />
                <option value="SINGAPORE (SGSIN)" />
                <option value="PORT KLANG (MYPKG)" />
                <option value="BUSAN (KRPUS)" />
                <option value="HAMBURG (DEHAM)" />
              </datalist>
              {portsAreSame && <p className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 mt-1"><AlertCircle className="h-3 w-3" />Choose a different loading port.</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Port of Discharge <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="major-discharge-ports"
                value={portOfDischarge}
                onChange={(e) => setPortOfDischarge(e.target.value)}
                aria-invalid={portsAreSame}
                placeholder="e.g. NHAVA SHEVA (INNSA)"
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition ${portsAreSame ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'}`}
              />
              <datalist id="major-discharge-ports">
                <option value="NHAVA SHEVA (INNSA)" />
                <option value="MUNDRA (INMUN)" />
                <option value="HAZIRA (INHZA)" />
                <option value="CHENNAI (INMAA)" />
                <option value="KOLKATA (INKOL)" />
                <option value="PIPAVAV (INPAV)" />
              </datalist>
              {portsAreSame && <p className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 mt-1"><AlertCircle className="h-3 w-3" />Destination must differ from loading port.</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Container Type <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={containerType}
                onChange={(e) => setContainerType(e.target.value)}
                placeholder="e.g. 40 FT / 40 HC"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">No. of Containers <span className="text-rose-500">*</span></label>
              <input
                type="number"
                min="1"
                step="1"
                value={containerCount}
                onChange={(e) => setContainerCount(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Weight per Container (MT)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={weightPerContainer}
                onChange={(e) => setWeightPerContainer(e.target.value)}
                placeholder="e.g. 25.00"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Est. Readiness Date</label>
              <input
                type="date"
                value={estimatedReadinessDate}
                onChange={(e) => setEstimatedReadinessDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0d7676] outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Invite Vendors (Shipping Lines / Freight Forwarders) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0d7676]" />
                3. Invite Freight Forwarders & Shipping Lines
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Only invited vendors will be notified and permitted to submit bids.
              </p>
            </div>
            <span className="text-xs font-extrabold text-[#0d7676] bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              {selectedVendors.length} Invited
            </span>
          </div>

          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              placeholder="Search freight forwarders or shipping lines by name or SAP code..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white transition"
            />
          </div>

          {/* Vendors Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
            {filteredLogisticsVendors.length === 0 && (
              <div className="col-span-4 py-8 text-center text-xs text-slate-400 font-medium">
                No logistics vendors found matching your search.
              </div>
            )}
            {filteredLogisticsVendors.map((vendor) => {
              const isSelected = selectedVendors.includes(vendor.id);
              const initial = (vendor.companyName || 'F')[0].toUpperCase();
              const isShippingLine = (vendor.vendorType || '').toLowerCase().includes('shipping');

              return (
                <div
                  key={vendor.id}
                  onClick={() => toggleVendor(vendor.id)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'bg-amber-50/60 border-amber-400 ring-2 ring-amber-400/40 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{vendor.companyName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] font-mono text-slate-400">{vendor.sapVendorCode}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        isShippingLine 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'bg-teal-50 text-teal-600'
                      }`}>
                        {isShippingLine ? 'Shipping Line' : 'Freight Forwarder'}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 4: RFQ Documents (Optional) */}
        {!isEdit && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0d7676]" />
                  4. Attach Specifications & Requirements (Optional)
                </h2>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Attach technical specification sheets, drawings, or special transport instructions for vendors.
                </p>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                Optional
              </span>
            </div>

            <FileUploadZone
              multiple={true}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls,.csv,.zip"
              maxSize={25}
              onFilesSelected={handleFilesSelected}
              selectedFiles={documents}
              onFileRemove={handleFileRemove}
            />
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="sticky bottom-4 border border-slate-200 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg flex items-center justify-between z-40">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-xs font-bold text-slate-900">
                {selectedVendors.length > 0 ? `${selectedVendors.length} Freight Forwarders Invited` : 'No vendors selected yet'}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                {title.trim() ? title : 'Draft RFQ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/rfqs')}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-black text-xs shadow-xs transition cursor-pointer flex items-center gap-2 rounded-xl disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{saving ? 'Publishing RFQ...' : isEdit ? 'Update RFQ' : 'Publish RFQ & Invite Vendors'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
