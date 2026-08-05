import React, { useState, useEffect } from 'react';
import { useConfirm } from '../ui/confirm-dialog';
import { 
  GitFork, 
  DollarSign, 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle, 
  ArrowRight,
  Receipt,
  FileCheck,
  ShieldCheck,
  Truck,
  FileText,
  Search,
  Filter
} from 'lucide-react';
import AddWorkflowModal from './AddWorkflowModal';

export default function WorkflowSlabsView({ onNavigateToRates }) {
  const confirm = useConfirm();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workflows');
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.slabs || []);
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleDeleteSlab = async (id) => {
    if (!(await confirm({ title: 'Delete workflow rule?', description: 'This workflow slab will be permanently removed.', confirmLabel: 'Delete workflow' }))) return;
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchWorkflows();
      }
    } catch (err) {
      console.error('Error deleting slab:', err);
    }
  };

  const categories = ['Advance Payment', 'Invoice Payment', 'BL Freight Invoice', 'Custom Duty', 'Logistics Payments', 'Purchase Orders'];

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Advance Payment': return <Receipt className="w-4 h-4 text-[#0d7676]" />;
      case 'Invoice Payment': return <FileCheck className="w-4 h-4 text-[#0d7676]" />;
      case 'BL Freight Invoice': return <Truck className="w-4 h-4 text-[#0d7676]" />;
      case 'Custom Duty': return <ShieldCheck className="w-4 h-4 text-[#0d7676]" />;
      case 'Logistics Payments': return <Truck className="w-4 h-4 text-[#0d7676]" />;
      default: return <FileText className="w-4 h-4 text-[#0d7676]" />;
    }
  };

  const filteredWorkflows = workflows.filter(w => {
    const matchesCategory = selectedCategory === 'All' || w.category === selectedCategory;
    const matchesSearch = !search.trim() || 
      w.name.toLowerCase().includes(search.toLowerCase()) || 
      (w.formattedRange && w.formattedRange.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full space-y-5 pb-12 font-sans">
      
      {/* SINGLE UNIFIED COMPACT CONTROLS BAR (No duplicate top title banner) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Left Side: Category Pills & Search Box */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              selectedCategory === 'All'
                ? 'bg-[#0d7676] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedCategory === cat
                  ? 'bg-[#0d7676] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}

          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search slab by name or range..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-[#0d7676] focus:outline-none"
            />
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={onNavigateToRates}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            Exchange Rates
          </button>

          <button
            onClick={() => { setEditingSlab(null); setIsAddModalOpen(true); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#0d7676] rounded-lg hover:bg-[#0a5c5c] transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Workflow Slab
          </button>
        </div>

      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-[#0d7676] border-t-transparent mb-2"></div>
          <p>Loading workflow slabs...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryWorkflows = filteredWorkflows.filter(w => w.category === category);
            if (categoryWorkflows.length === 0) return null;

            return (
              <div key={category} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                {/* Category Header */}
                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {getCategoryIcon(category)}
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{category}</h3>
                    <span className="text-[10px] font-bold text-[#0d7676] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {categoryWorkflows.length} {categoryWorkflows.length === 1 ? 'slab' : 'slabs'}
                    </span>
                  </div>
                </div>

                {/* List of Slabs under this Category */}
                <div className="divide-y divide-slate-100">
                  {categoryWorkflows.map((slab) => (
                    <div key={slab.id} className="p-4 space-y-3 hover:bg-teal-50/20 transition">
                      {/* Top Row: Title, Range, Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="text-xs font-extrabold text-slate-900">{slab.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-mono font-bold text-[#0d7676] bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">{slab.formattedRange}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500 font-medium">{slab.description}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
                            Active
                          </span>
                          <button
                            onClick={() => { setEditingSlab(slab); setIsAddModalOpen(true); }}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-500" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSlab(slab.id)}
                            className="p-1 text-rose-500 bg-rose-50 border border-rose-100 rounded hover:bg-rose-100 transition"
                            title="Delete Slab"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Step Flow Visualization */}
                      <div className="pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {slab.steps.map((step, idx) => (
                            <React.Fragment key={idx}>
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800">
                                <span className="w-4.5 h-4.5 rounded-full bg-[#0d7676] text-white font-bold flex items-center justify-center text-[9px]">
                                  {step.step}
                                </span>
                                <div>
                                  <span className="font-bold text-slate-900">{step.title}</span>
                                  <span className="text-[9px] text-[#0d7676] block font-mono font-semibold">{step.roleKey}</span>
                                </div>
                              </div>

                              <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                            </React.Fragment>
                          ))}

                          {/* Final Approval Badge */}
                          <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approved</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Add / Edit Workflow Slab */}
      {isAddModalOpen && (
        <AddWorkflowModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          editingSlab={editingSlab}
          onSuccess={fetchWorkflows}
        />
      )}
    </div>
  );
}
