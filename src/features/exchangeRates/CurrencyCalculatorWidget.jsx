import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, Calculator } from 'lucide-react';
import { calculateConversion } from './exchangeRatesSlice';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Input } from '../../components/ui/input';

export default function CurrencyCalculatorWidget() {
  const dispatch = useDispatch();
  const { rates, calculator } = useSelector((state) => state.exchangeRates);
  const update = (values) => dispatch(calculateConversion({
    currency: values.currency ?? calculator.currency,
    amount: values.amount ?? calculator.amount
  }));

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><Calculator className="h-5 w-5" /></span>
        <div><h3 className="text-base font-bold text-slate-950">Live threshold simulator</h3><p className="mt-1 text-sm text-slate-500">Convert foreign amounts to INR and preview approval routing.</p></div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Foreign currency
          <div className="mt-2"><SearchableSelect value={calculator.currency} onChange={(currency) => update({ currency })} options={rates.map((rate) => ({ value: rate.currency, label: `${rate.currency} — ${rate.name} (₹${rate.rate})` }))} searchPlaceholder="Search currencies..." /></div>
        </label>
        <label className="text-sm font-semibold text-slate-700">Payment amount
          <Input className="mt-2 font-mono" type="number" min="0" max="999999999999999" step="0.01" placeholder="Enter amount" value={calculator.amount} onChange={(event) => update({ amount: event.target.value })} />
        </label>
      </div>
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
        <div className="flex items-center justify-between gap-4"><span className="text-sm text-slate-600">INR equivalent</span><strong className="font-mono text-lg text-teal-800">₹{Number(calculator.convertedINR || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-teal-200/70 pt-3"><span className="text-sm text-slate-600">Matched slab</span><span className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-bold text-teal-800">{calculator.matchedSlabName}</span></div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {calculator.requiredApprovalSteps.map((step, index) => (
            <React.Fragment key={`${step}-${index}`}><span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{index + 1}. {step}</span>{index < calculator.requiredApprovalSteps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-400" />}</React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
