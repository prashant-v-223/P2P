import React, { useState, useEffect } from 'react';
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
  FileText
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

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save RFQ');
      }

      const rfqId = json.data?.rfqId || json.data?.rfqNumber || id;

      // Step 2: Upload documents if any are attached (only for new RFQs)
      if (!isEdit && documents.length > 0 && rfqId) {
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

  return (
    <div className="w-full space-y-6 font-sans pb-24 antialiased text-left">
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
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-black text-xs shadow-2xs transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
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
                placeholder="e.g. DUMMY ENTRY FROM IT TEAM — FREIGHT SOURCING"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] focus:bg-white outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Linked SAP Purchase Order <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={linkedPoId}
                onChange={(e) => setLinkedPoId(e.target.value)}
                placeholder="Enter PO Number (e.g. 4700000251)"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] focus:bg-white outline-none transition"
              />
              <p className="text-[10px] text-slate-400 font-medium">
                Enter the SAP PO number to link with this RFQ.
              </p>
            </div>

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
                value={portOfLoading}
                onChange={(e) => setPortOfLoading(e.target.value)}
                aria-invalid={portsAreSame}
                placeholder="e.g. SHANGHAI (CHINA)"
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition ${portsAreSame ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'}`}
              />
              {portsAreSame && <p className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 mt-1"><AlertCircle className="h-3 w-3" />Choose a different loading port.</p>}
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
                placeholder="e.g. NHAVA SHEVA (INDIA)"
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676] outline-none transition ${portsAreSame ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'}`}
              />
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
