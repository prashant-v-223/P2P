import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { fetchExchangeRates, saveAllRates, addCurrency, deleteCurrency, updateLocalRate, clearRatesToast } from './exchangeRatesSlice';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { DollarSign, Save, Plus, CheckCircle2, AlertCircle, RefreshCw, Trash2, ArrowLeft, Info } from 'lucide-react';
import { ServerPagination } from '../../components/ui/server-pagination';
import { useToast } from '../../components/ui/toast';

export default function ExchangeRatesDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { rates, loading, saving, toastMessage } = useSelector((state) => state.exchangeRates);
  const { user } = useSelector((state) => state.auth);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState('');
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  useEffect(() => {
    dispatch(fetchExchangeRates());
  }, [dispatch]);

  const handleRateChange = (currency, val) => {
    dispatch(updateLocalRate({ currency, rate: Number(val) }));
  };

  const handleSaveAll = async () => {
    try {
      const result = await dispatch(saveAllRates({ rates, updatedBy: user?.name || user?.email || 'Nikunj Bhagat' })).unwrap();
      showToast({
        title: 'FX Rates Saved',
        description: 'Changes apply immediately to all new approval workflow submissions.',
        type: 'success'
      });
      setTimeout(() => {
        dispatch(clearRatesToast());
      }, 4000);
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: typeof err === 'string' ? err : 'Failed to save FX rates.',
        type: 'error'
      });
    }
  };

  const handleAddCurrencySubmit = async (e) => {
    e.preventDefault();
    if (!newCurrency.trim() || !newRate || Number(newRate) <= 0) {
      showToast({
        title: 'Validation Error',
        description: 'Please enter a valid currency code and positive numeric rate.',
        type: 'error'
      });
      return;
    }

    setSubmittingAdd(true);
    try {
      await dispatch(addCurrency({
        currency: newCurrency.trim().toUpperCase(),
        name: newName.trim() || newCurrency.trim().toUpperCase(),
        rate: Number(newRate)
      })).unwrap();

      showToast({
        title: 'Currency Added',
        description: `${newCurrency.trim().toUpperCase()} exchange rate added successfully.`,
        type: 'success'
      });
      setIsAddModalOpen(false);
      setNewCurrency('');
      setNewName('');
      setNewRate('');
    } catch (err) {
      showToast({
        title: 'Error Adding Currency',
        description: typeof err === 'string' ? err : 'Failed to add currency.',
        type: 'error'
      });
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleDeleteCurrency = async (currencyCode) => {
    if (currencyCode === 'INR') {
      showToast({ title: 'Cannot Delete', description: 'INR is the base currency and cannot be deleted.', type: 'warning' });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${currencyCode}?`)) return;

    try {
      await dispatch(deleteCurrency(currencyCode)).unwrap();
      showToast({
        title: 'Currency Deleted',
        description: `${currencyCode} rate removed.`,
        type: 'success'
      });
    } catch (err) {
      showToast({
        title: 'Delete Failed',
        description: typeof err === 'string' ? err : 'Failed to delete currency.',
        type: 'error'
      });
    }
  };

  return (
    <div className="page-stack font-sans space-y-5">
      {/* Navigation & Header */}
      <div>
        <Link
          to="/admin/workflows"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d7676] hover:underline transition mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workflows
        </Link>
      </div>

      {/* Top Banner Card */}
      <Card>
        <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="section-icon bg-emerald-50 text-emerald-700">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Foreign Exchange Rates Management</CardTitle>
                <Badge variant="emerald">Live Rates</Badge>
              </div>
              <CardDescription className="mt-0.5">
                Maintain official currency conversion rates to INR ({rates.length} currencies configured).
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => setIsAddModalOpen(true)} variant="outline">
              <Plus className="w-4 h-4" />
              Add Currency
            </Button>
            <Button onClick={handleSaveAll} loading={saving} variant="default">
              <Save className="w-4 h-4" />
              Save All FX Rates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Success Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Currency Rates Table Card */}
      <Card>
        <CardHeader className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Currency → INR Rates</CardTitle>
              <Badge variant="secondary">({rates.length} currencies)</Badge>
            </div>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              Changes apply immediately to all new approval workflow submissions
            </span>
          </div>
        </CardHeader>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading exchange rates...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="py-3.5 px-6">CURRENCY CODE</th>
                    <th className="py-3.5 px-6">CURRENCY NAME</th>
                    <th className="py-3.5 px-6">1 UNIT = ? INR (₹)</th>
                    <th className="py-3.5 px-6">LAST UPDATED BY</th>
                    <th className="py-3.5 px-6 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rates.slice((page - 1) * pageSize, page * pageSize).map((r) => (
                    <tr key={r.currency} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6">
                        <Badge variant={r.currency === 'INR' ? 'emerald' : 'teal'}>{r.currency}</Badge>
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-800">{r.name}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 max-w-xs">
                          <span className="text-slate-500 font-bold">₹</span>
                          <Input
                            type="number"
                            step="0.0001"
                            value={r.rate}
                            disabled={r.currency === 'INR'}
                            onChange={(e) => handleRateChange(r.currency, e.target.value)}
                            className="font-mono font-bold"
                          />
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {r.lastUpdatedBy || 'Nikunj Bhagat'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {r.currency !== 'INR' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCurrency(r.currency)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete currency"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ServerPagination
              page={page}
              totalPages={Math.ceil(rates.length / pageSize) || 1}
              total={rates.length}
              pageSize={pageSize}
              itemLabel="currencies"
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </Card>

      {/* Explanatory Info Card: How these rates are used */}
      <Card className="bg-teal-50/50 border-teal-200">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-[#0d7676] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-extrabold text-[#0d7676]">How these rates are used</h4>
            <p className="text-slate-600 leading-relaxed font-medium">
              When an Advance Payment or Invoice Payment is submitted in a non-INR currency (e.g. USD or EUR), the amount is multiplied by the exchange rate here to get the INR equivalent. That INR value is used to select the correct approval workflow slab (e.g. whether the MD approval step is required at &gt;₹10L). Keep these rates up to date to ensure the correct approval chain is triggered.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add Currency Modal */}
      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Add Foreign Currency</h3>
            <form noValidate onSubmit={handleAddCurrencySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Code (3 letters) <span className="text-rose-500" aria-hidden="true">*</span></label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. JPY / AED"
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Name</label>
                <Input
                  type="text"
                  placeholder="Japanese Yen"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rate in INR (₹) <span className="text-rose-500" aria-hidden="true">*</span></label>
                <Input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="0.55"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" loading={submittingAdd}>
                  Add Currency
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

