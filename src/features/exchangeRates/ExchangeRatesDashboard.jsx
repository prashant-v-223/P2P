import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchExchangeRates, saveAllRates, updateLocalRate, clearRatesToast } from './exchangeRatesSlice';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { DollarSign, Save, Plus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function ExchangeRatesDashboard() {
  const dispatch = useDispatch();
  const { rates, loading, saving, toastMessage } = useSelector((state) => state.exchangeRates);
  const { user } = useSelector((state) => state.auth);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState('');
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');

  useEffect(() => {
    dispatch(fetchExchangeRates());
  }, [dispatch]);

  const handleRateChange = (currency, val) => {
    dispatch(updateLocalRate({ currency, rate: Number(val) }));
  };

  const handleSaveAll = () => {
    dispatch(saveAllRates({ rates, updatedBy: user?.name || 'Admin' }));
    setTimeout(() => {
      dispatch(clearRatesToast());
    }, 4000);
  };

  const handleAddCurrencySubmit = async (e) => {
    e.preventDefault();
    if (!newCurrency || !newRate) return;

    try {
      await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency, name: newName, rate: Number(newRate) })
      });
      dispatch(fetchExchangeRates());
      setIsAddModalOpen(false);
      setNewCurrency('');
      setNewName('');
      setNewRate('');
    } catch (err) {
      console.error('Error adding currency:', err);
    }
  };

  return (
    <div className="page-stack font-sans">
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
                Maintain official currency conversion rates to INR for threshold slab routing predictions.
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
            <CardTitle className="text-sm">Currency Rates Table</CardTitle>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              Last updated by Finance Lead
            </span>
          </div>
        </CardHeader>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading exchange rates...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="py-3.5 px-6">CURRENCY CODE</th>
                  <th className="py-3.5 px-6">CURRENCY NAME</th>
                  <th className="py-3.5 px-6">EXCHANGE RATE (1 UNIT IN ₹ INR)</th>
                  <th className="py-3.5 px-6">LAST UPDATED BY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rates.map((r) => (
                  <tr key={r.currency} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6">
                      <Badge variant="teal">{r.currency}</Badge>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800">{r.name}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 max-w-xs">
                        <span className="text-slate-500 font-bold">₹</span>
                        <Input
                          type="number"
                          step="0.0001"
                          value={r.rate}
                          onChange={(e) => handleRateChange(r.currency, e.target.value)}
                          className="font-mono font-bold"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-medium">
                      {r.lastUpdatedBy || 'Nikunj Bhagat'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Currency Modal */}
      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md p-4">
            <h3 className="text-sm font-bold text-slate-900">Add Foreign Currency</h3>
            <form noValidate onSubmit={handleAddCurrencySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Code (3 letters) <span className="text-rose-500" aria-hidden="true">*</span></label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. JPY"
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
                <Button type="submit" variant="default">
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
