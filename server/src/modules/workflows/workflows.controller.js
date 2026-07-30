import crypto from 'node:crypto';
import { Workflow } from '../../models/Workflow.js';

const formatRange = (minAmount, maxAmount) => {
  const min = Number(minAmount || 0);
  const max = maxAmount === null || maxAmount === '' || maxAmount === undefined ? null : Number(maxAmount);
  return max === null
    ? `₹${min.toLocaleString('en-IN')} - ∞`
    : `₹${min.toLocaleString('en-IN')} - ₹${max.toLocaleString('en-IN')}`;
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getWorkflows = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size, 10) || 10));
  const query = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();
  const filter = {};

  if (category && category !== 'All') filter.category = category;
  if (query) {
    const matcher = new RegExp(escapeRegex(query), 'i');
    filter.$or = [
      { name: matcher },
      { category: matcher },
      { description: matcher },
      { formattedRange: matcher },
      { 'steps.title': matcher },
      { 'steps.roleName': matcher }
    ];
  }

  const sortOptions = {
    name: { name: 1 },
    threshold: { minAmount: 1, maxAmount: 1 },
    category: { category: 1, minAmount: 1 }
  };
  const sort = sortOptions[req.query.sort] || sortOptions.category;
  const total = await Workflow.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const slabs = await Workflow.find(filter).sort(sort).skip((safePage - 1) * size).limit(size).lean();
  return res.json({
    success: true,
    count: slabs.length,
    total,
    page: safePage,
    size,
    totalPages,
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages,
    slabs
  });
};

export const createWorkflowSlab = async (req, res) => {
  const { category, name, minAmount = 0, maxAmount = null, description = '', steps = [] } = req.body;
  if (!category?.trim() || !name?.trim()) {
    return res.status(400).json({ success: false, error: 'Category and name are required.' });
  }
  const slab = await Workflow.create({
    id: `wf-${crypto.randomUUID()}`,
    category: category.trim(),
    name: name.trim(),
    minAmount: Number(minAmount),
    maxAmount: maxAmount === '' || maxAmount === null ? null : Number(maxAmount),
    formattedRange: formatRange(minAmount, maxAmount),
    description,
    steps
  });
  return res.status(201).json({ success: true, message: 'Workflow created.', slab });
};

export const updateWorkflowSlab = async (req, res) => {
  const updates = { ...req.body };
  delete updates.id;
  delete updates._id;
  if ('minAmount' in updates || 'maxAmount' in updates) {
    const existing = await Workflow.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ success: false, error: 'Workflow not found.' });
    updates.formattedRange = formatRange(
      updates.minAmount ?? existing.minAmount,
      'maxAmount' in updates ? updates.maxAmount : existing.maxAmount
    );
  }
  const slab = await Workflow.findOneAndUpdate({ id: req.params.id }, updates, {
    new: true,
    runValidators: true
  });
  if (!slab) return res.status(404).json({ success: false, error: 'Workflow not found.' });
  return res.json({ success: true, message: 'Workflow updated.', slab });
};

export const deleteWorkflowSlab = async (req, res) => {
  const slab = await Workflow.findOneAndDelete({ id: req.params.id });
  if (!slab) return res.status(404).json({ success: false, error: 'Workflow not found.' });
  return res.json({ success: true, message: 'Workflow deleted.', id: req.params.id });
};
