import React, { useState, useEffect } from 'react';
import { useConfirm } from '../ui/confirm-dialog';
import { ArrowLeft, DollarSign, Plus, Trash2, Save, Info, CheckCircle2, Search } from 'lucide-react';
import { ServerPagination } from '../ui/server-pagination';
import { CustomInput } from '../ui/custom-input';

export default function ExchangeRatesView({ onBackToWorkflows }) {
  const confirm = useConfirm();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState('');
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');

  const fetchRates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/exchange-rates');
      if (res.ok) {
        const data = await res.json();
        setRates(data.rates || []);
      }
    } catch (err) {
      console.error('Error fetching exchange rates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleRateChange = (currencyCode, newRateVal) => {
    setRates(prev => prev.map(r => r.currency === currencyCode ? { ...r, rate: newRateVal } : r));
  };

  const filteredRates = rates.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.currency || '').toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q);
  });

  const paginatedRates = filteredRates.slice((page - 1) * pageSize, page * pageSize);

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/exchange-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates, updatedBy: 'Nikunj Bhagat' })
      });
      if (res.ok) {
        setToastMessage('Exchange rates updated successfully!');
        setTimeout(() => setToastMessage(''), 3000);
        fetchRates();
      }
    } catch (err) {
      console.error('Error saving exchange rates:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCurrency = async (currencyCode) => {
    if (!(await confirm({ title: `Remove ${currencyCode}?`, description: 'This currency will no longer be available for workflow conversion.', confirmLabel: 'Remove currency' }))) return;
    try {
      const res = await fetch(`/api/exchange-rates/${currencyCode}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRates();
      }
    } catch (err) {
      console.error('Error deleting currency:', err);
    }
  };

  const handleAddCurrency = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: newCurrency,
          name: newName,
          rate: newRate,
          lastUpdatedBy: 'Nikunj Bhagat'
        })
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewCurrency('');
        setNewName('');
        setNewRate('');
        fetchRates();
      }
    } catch (err) {
      console.error('Error adding currency:', err);
    }
  };

  return (
    <div className="w-full space-y-5 pb-12 font-sans">
      
      {/* Back Link & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBackToWorkflows}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#0d7676] hover:text-[#0a5c5c] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workflows Slabs
        </button>

        <div className="flex items-center gap-2">
          <div className="w-64">
            <CustomInput
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              onClear={() => { setSearch(''); setPage(1); }}
              placeholder="Search currency code or name..."
              leftIcon={Search}
              clearable={true}
              size="sm"
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#0d7676] rounded-lg hover:bg-[#0a5c5c] transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Currency
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">

        {/* Success Toast Banner */}
        {toastMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Currency Table */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading rates...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[11px]">
                <tr>
                  <th className="py-3.5 px-6">CURRENCY</th>
                  <th className="py-3.5 px-6">NAME</th>
                  <th className="py-3.5 px-6">1 UNIT = ? INR</th>
                  <th className="py-3.5 px-6">LAST UPDATED</th>
                  <th className="py-3.5 px-6 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRates.map((item) => (
                  <tr key={item.currency} className="hover:bg-teal-50/20 transition">
                    <td className="py-3.5 px-6 font-bold">
                      <span className="px-2.5 py-1 bg-teal-50 text-[#0d7676] font-mono rounded border border-teal-200">
                        {item.currency}
                      </span>
                    </td>

                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {item.name}
                    </td>

                    <td className="py-3.5 px-6">
                      <div className="relative max-w-[200px]">
                        <span className="absolute left-3 top-2 text-slate-400 font-medium">₹</span>
                        <input
                          type="number"
                          step="0.0001"
                          value={item.rate}
                          onChange={(e) => handleRateChange(item.currency, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0d7676] focus:outline-none transition shadow-2xs"
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-6 text-slate-500 font-medium">
                      {item.lastUpdatedBy}
                    </td>

                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => handleDeleteCurrency(item.currency)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition"
                        title="Delete Currency"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ServerPagination
          page={page}
          totalPages={Math.ceil(filteredRates.length / pageSize) || 1}
          total={filteredRates.length}
          pageSize={pageSize}
          itemLabel="currencies"
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-500 font-medium">
            Changes apply immediately to all new approval workflow submissions.
          </p>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-2 text-xs font-bold text-white bg-[#0d7676] rounded-lg hover:bg-[#0a5c5c] transition shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Rates...' : 'Save All Rates'}
          </button>
        </div>
      </div>

      {/* Explanation Box */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs space-y-1.5">
        <h4 className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
          <Info className="w-4 h-4 text-amber-600" />
          How these exchange rates are used
        </h4>
        <p className="text-amber-800 leading-relaxed text-[11px]">
          When an Advance Payment or Invoice Payment is submitted in a non-INR currency (e.g. USD), the amount is multiplied by the rate here to get the INR equivalent for selecting approval slabs.
        </p>
      </div>

      {/* Modal to Add Currency */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-3.5">
            <h3 className="text-sm font-bold text-slate-900">Add New FX Currency</h3>
            <form noValidate onSubmit={handleAddCurrency} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Code (3-letters) <span className="text-rose-500" aria-hidden="true">*</span></label>
                <input
                  type="text"
                  required
                  maxLength={3}
                  placeholder="e.g. JPY"
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Name <span className="text-rose-500" aria-hidden="true">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Japanese Yen"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">1 Unit in INR (₹) <span className="text-rose-500" aria-hidden="true">*</span></label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="e.g. 0.6200"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0d7676] hover:bg-[#0a5c5c] rounded-lg"
                >
                  Add Currency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
