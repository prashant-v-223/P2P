import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
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
  FileCheck
} from 'lucide-react';

export default function RfqFormView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { showToast } = useToast();

  const isEdit = Boolean(id);
  const copyFrom = location.state?.copyFrom;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        }
      } catch (e) {
        console.error('Fetch data error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, isEdit]);

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

      setSaving(false);
      if (res.ok && json.success) {
        showToast({
          title: isEdit ? 'RFQ Updated' : 'RFQ Created & Published',
          description: `RFQ ${json.data?.rfqNumber || id} saved to MongoDB.`,
          type: 'success'
        });
        navigate('/admin/rfqs');
      } else {
        throw new Error(json.error || 'Failed to save RFQ');
      }
    } catch (err) {
      setSaving(false);
      showToast({ title: 'Error', description: err.message, type: 'error' });
    }
  };

  return (
    <div className="w-full space-y-6 font-sans max-w-5xl mx-auto pb-16 antialiased text-left">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={() => navigate('/admin/rfqs')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to RFQs</span>
        </button>
        <h1 className="text-lg font-bold text-slate-900">
          {isEdit ? 'Edit RFQ' : 'Create New RFQ'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: RFQ Details */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Ship className="w-4 h-4 text-[#0d7676]" />
            RFQ Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. DUMMY ENTRY FROM IT TEAM"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Linked Purchase Order <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={linkedPoId}
                onChange={(e) => setLinkedPoId(e.target.value)}
                placeholder="Enter PO Number (e.g. 4700000251)"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Enter the SAP PO number to link with this RFQ
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Closing Date & Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#0d7676]"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">Internal Description / Scope</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter scope of freight forwarder bidding..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676]"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Shipment Requirements Matching Screenshot 3 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0d7676]" />
              Shipment Requirements
            </h2>
            <span className="text-[10px] font-extrabold text-[#0d7676] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Filled by team
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Shipping Terms <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={shippingTerms}
                onChange={(e) => setShippingTerms(e.target.value)}
                placeholder="e.g. FOB / CIF"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
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
                placeholder="e.g. SOLAR CELL / SOLAR GLASS / ALUMINUM FRAME"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0d7676]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Port of Loading <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={portOfLoading}
                onChange={(e) => setPortOfLoading(e.target.value)}
                aria-invalid={portsAreSame}
                placeholder="e.g. SHANGHAI / NINGBO"
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0d7676] ${portsAreSame ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'}`}
              />
              {portsAreSame && <p className="flex items-center gap-1 text-[10px] font-semibold text-rose-600"><AlertCircle className="h-3 w-3" />Choose a different loading port.</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Port of Discharge <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={portOfDischarge}
                onChange={(e) => setPortOfDischarge(e.target.value)}
                aria-invalid={portsAreSame}
                placeholder="e.g. NHAVA SHEVA / MUNDRA"
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0d7676] ${portsAreSame ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'}`}
              />
              {portsAreSame && <p className="flex items-center gap-1 text-[10px] font-semibold text-rose-600"><AlertCircle className="h-3 w-3" />Choose a destination different from the loading port.</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Type of Container <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={containerType}
                onChange={(e) => setContainerType(e.target.value)}
                placeholder="e.g. 40 FT / 40 HC"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
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
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
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
                placeholder="e.g. 24"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
              />
              <p className="text-[10px] text-slate-400">Enter numbers only; the unit is metric tonnes.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Estimated Readiness Date</label>
              <input
                type="date"
                value={estimatedReadinessDate}
                onChange={(e) => setEstimatedReadinessDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Invite Vendors (Shipping Lines / Freight Forwarders) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0d7676]" />
                Invite Vendors (Shipping Lines / Freight Forwarders)
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Filtered strictly to Freight Forwarders and Shipping Lines only.
              </p>
            </div>
            <span className="text-xs font-bold text-[#0d7676]">
              {selectedVendors.length} selected
            </span>
          </div>

          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              placeholder="Search freight forwarders..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          {/* Vendors Selection Grid matching Screenshot 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredLogisticsVendors.length === 0 && (
            <div className="col-span-3 py-8 text-center text-xs text-slate-400 font-medium">
              No freight forwarders found. Try a different search.
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
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'bg-amber-50/40 border-amber-400 ring-1 ring-amber-400/50'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
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

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/admin/rfqs')}
            className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{saving ? 'Saving RFQ...' : 'Update RFQ'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
