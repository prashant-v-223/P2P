import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { SearchableSelect } from '../ui/searchable-select';
import { FieldError } from '../ui/field-error';
import { useToast } from '../ui/toast';

export default function AddWorkflowModal({ isOpen, onClose, editingSlab, onSuccess }) {
  const [category, setCategory] = useState('Advance Payment');
  const [name, setName] = useState('');
  const [minAmount, setMinAmount] = useState(0);
  const [maxAmount, setMaxAmount] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([
    { step: 1, title: 'Procurement Head Approval', roleKey: 'procurement_head' },
    { step: 2, title: 'Finance Approval', roleKey: 'finance' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [draggedStep, setDraggedStep] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [errors, setErrors] = useState({});
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef(null);

  // Fetch available roles from API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoadingRoles(true);
        const res = await apiFetch('/api/roles');
        const data = await res.json();
        if (res.ok && data.success) {
          setAvailableRoles(data.roles || []);
        }
      } catch (err) {
        console.error('Failed to fetch roles:', err);
        // Fallback to default roles
        setAvailableRoles([
          { roleName: 'procurement', description: 'Procurement' },
          { roleName: 'procurement_head', description: 'Procurement Head' },
          { roleName: 'finance', description: 'Finance' },
          { roleName: 'finance_lead', description: 'Finance Lead' },
          { roleName: 'cfo', description: 'CFO' },
          { roleName: 'md', description: 'MD' },
          { roleName: 'exim', description: 'EXIM' },
          { roleName: 'exim-manager', description: 'EXIM Manager' },
          { roleName: 'logistics', description: 'Logistics' },
          { roleName: 'accounts', description: 'Accounts' },
          { roleName: 'admin', description: 'Admin' }
        ]);
      } finally {
        setLoadingRoles(false);
      }
    };
    
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingSlab) {
      setCategory(editingSlab.category || 'Advance Payment');
      setName(editingSlab.name || '');
      setMinAmount(editingSlab.minAmount || 0);
      setMaxAmount(editingSlab.maxAmount !== null ? editingSlab.maxAmount : '');
      setDescription(editingSlab.description || '');
      setSteps(editingSlab.steps || []);
    } else {
      setName('');
      setMinAmount(0);
      setMaxAmount('');
      setDescription('');
      setSteps([
        { step: 1, title: 'Procurement Head Approval', roleKey: 'procurement_head' },
        { step: 2, title: 'Finance Approval', roleKey: 'finance' }
      ]);
    }
  }, [editingSlab]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => formRef.current?.querySelector('[data-autofocus]')?.focus(), 0);
    const handleKeyboard = (event) => {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [isOpen, onClose, submitting]);

  const handleAddStep = () => {
    setSteps([
      ...steps,
      { step: steps.length + 1, title: 'MD Approval', roleKey: 'md' }
    ]);
  };

  const handleRemoveStep = (idx) => {
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }));
    setSteps(updated);
  };

  const handleStepChange = (idx, field, value) => {
    const updated = [...steps];
    updated[idx][field] = value;
    setSteps(updated);
  };

  const reorderSteps = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;
    setSteps((current) => {
      const updated = [...current];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((step, index) => ({ ...step, step: index + 1 }));
    });
  };

  const dropStep = (toIndex) => {
    reorderSteps(draggedStep, toIndex);
    setDraggedStep(null);
    setDragTarget(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!category) nextErrors.category = 'Select a workflow category.';
    if (name.trim().length < 3) nextErrors.name = 'Enter at least 3 characters.';
    if (Number(minAmount) < 0) nextErrors.minAmount = 'Minimum amount cannot be negative.';
    if (maxAmount !== '' && Number(maxAmount) <= Number(minAmount)) nextErrors.maxAmount = 'Maximum must be greater than minimum.';
    if (!steps.length || steps.some((step) => !step.title.trim())) nextErrors.steps = 'Add at least one valid approval step.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast({ type: 'error', title: 'Workflow needs attention', description: 'Correct the highlighted fields before saving.' });
      return;
    }
    setSubmitting(true);

    const formattedRange = maxAmount
      ? `\u20B9${Number(minAmount).toLocaleString('en-IN')} - \u20B9${Number(maxAmount).toLocaleString('en-IN')}`
      : `\u20B9${Number(minAmount).toLocaleString('en-IN')} - \u221E`;

    const payload = {
      category,
      name,
      minAmount: Number(minAmount),
      maxAmount: maxAmount ? Number(maxAmount) : null,
      formattedRange,
      description,
      steps
    };

    try {
      const url = editingSlab ? `/api/workflows/${editingSlab.id}` : '/api/workflows';
      const method = editingSlab ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showToast({ title: editingSlab ? 'Workflow updated' : 'Workflow created', description: `${name.trim()} was saved successfully.` });
        onSuccess();
      } else {
        throw new Error(data.error || 'Unable to save workflow.');
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Workflow was not saved', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <div className="modal-panel max-w-2xl animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="modal-header">
          <h3 className="text-sm font-bold text-slate-900">
            {editingSlab ? 'Edit Workflow Slab' : 'Configure New Workflow Slab'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form ref={formRef} noValidate onSubmit={handleSubmit} className="modal-body max-h-[80vh] overflow-y-auto">
          {/* Category & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Workflow Category <span className="text-rose-500" aria-hidden="true">*</span></label>
              <SearchableSelect value={category} onChange={(value) => { setCategory(value); setErrors({ ...errors, category: '' }); }} error={errors.category} options={['Advance Payment', 'Invoice Payment', 'RFQ Vendor Award', 'BL Freight Invoice', 'Custom Duty', 'Logistics Payments', 'Purchase Orders']} searchPlaceholder="Search workflow categories..." />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Slab Name <span className="text-rose-500" aria-hidden="true">*</span></label>
              <input
                type="text"
                data-autofocus
                required
                minLength={3}
                maxLength={120}
                placeholder="e.g. Advance Payment (Above ₹1CR)"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: '' }); }}
                className={`w-full text-sm p-2.5 rounded-lg border focus:ring-2 focus:ring-teal-500 focus:outline-none ${errors.name ? 'border-rose-400' : 'border-slate-300'}`}
              />
              <FieldError>{errors.name}</FieldError>
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Amount (₹ INR) <span className="text-rose-500" aria-hidden="true">*</span></label>
              <input
                type="number"
                min="0"
                max="999999999999999"
                step="0.01"
                placeholder="Enter minimum amount"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <FieldError>{errors.minAmount}</FieldError>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Maximum Amount (₹ INR) <span className="text-slate-400 font-normal">(leave blank for infinity)</span>
              </label>
              <input
                type="number"
                min="0"
                max="999999999999999"
                step="0.01"
                placeholder={'No Upper Limit (\u221E)'}
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <FieldError>{errors.maxAmount}</FieldError>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Rule Applicability</label>
            <input
              type="text"
              maxLength={300}
              placeholder="e.g. Procurement Head -> MD -> Finance. Applies to INR-equivalent amounts above ₹1 Crore."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Approval Steps Chain */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <label className="text-xs font-bold text-slate-800">Approval Steps Pipeline <span className="text-rose-500" aria-hidden="true">*</span></label>
                <p className="mt-0.5 text-[10px] text-slate-400">Drag rows or use arrow buttons to change the approval order.</p>
              </div>
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-1 text-xs text-[#0d7676] font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Approval Step
              </button>
            </div>

            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div
                  key={`${step.roleKey}-${idx}`}
                  onDragEnter={() => setDragTarget(idx)}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(event) => { event.preventDefault(); dropStep(idx); }}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-xs transition ${draggedStep === idx ? 'border-teal-300 bg-teal-50 opacity-60' : dragTarget === idx ? 'border-teal-400 bg-teal-50/70 ring-2 ring-teal-500/10' : 'border-slate-200 bg-slate-50'}`}
                >
                  <button
                    type="button"
                    draggable={!submitting}
                    onDragStart={(event) => {
                      setDraggedStep(idx);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(idx));
                    }}
                    onDragEnd={() => { setDraggedStep(null); setDragTarget(null); }}
                    className="cursor-grab rounded-md p-1 text-slate-400 hover:bg-white hover:text-teal-700 active:cursor-grabbing"
                    title="Drag to reorder"
                    aria-label={`Drag step ${idx + 1}`}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0d7676] text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={step.title}
                    placeholder="Step Title (e.g. MD Approval)"
                    onChange={(e) => handleStepChange(idx, 'title', e.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:border-teal-500 focus:outline-none"
                  />
                  <select
                    required
                    value={step.roleKey}
                    onChange={(e) => handleStepChange(idx, 'roleKey', e.target.value)}
                    disabled={loadingRoles}
                    className="h-8 w-40 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:border-teal-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">{loadingRoles ? 'Loading roles...' : 'Select Role...'}</option>
                    {availableRoles.map((role) => (
                      <option key={role.roleName || role.id} value={role.roleName}>
                        {role.roleName}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center">
                    <button type="button" disabled={idx === 0} onClick={() => reorderSteps(idx, idx - 1)} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-teal-700 disabled:opacity-25" title="Move step up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={idx === steps.length - 1} onClick={() => reorderSteps(idx, idx + 1)} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-teal-700 disabled:opacity-25" title="Move step down"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="rounded-md p-1.5 text-rose-500 hover:bg-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#0d7676] hover:bg-[#0a5c5c] rounded-lg transition shadow-xs disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving Slab...</span>
                </>
              ) : (
                <span>{editingSlab ? 'Update Slab' : 'Save Workflow Slab'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
