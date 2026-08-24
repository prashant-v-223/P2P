import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Workflow } from '../../models/Workflow.js';
import { Approval } from '../../models/Approval.js';
import { WorkflowAudit } from '../../models/WorkflowAudit.js';
import { ensureRfqAwardWorkflows } from './workflowDefaults.js';

const DUMMY_WORKFLOWS = [
  {
    id: 'wf-001',
    category: 'Advance Payment',
    name: 'Standard Advance Approval Workflow',
    minAmount: 0,
    maxAmount: 1000000,
    formattedRange: '₹0 - ₹10,00,000',
    description: 'Standard 2-step approval workflow for advance payments.',
    steps: [
      { step: 1, title: 'Procurement Head Approval', roleKey: 'procurement_head', roleName: 'Procurement Head' },
      { step: 2, title: 'Finance Approval', roleKey: 'finance', roleName: 'Finance Lead' }
    ],
    status: 'Active'
  }
];

const formatRange = (minAmount, maxAmount) => {
  const min = Number(minAmount || 0);
  const max = maxAmount === null || maxAmount === '' || maxAmount === undefined ? null : Number(maxAmount);
  return max === null
    ? `₹${min.toLocaleString('en-IN')} - ∞`
    : `₹${min.toLocaleString('en-IN')} - ₹${max.toLocaleString('en-IN')}`;
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeKey = (value = '') => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function validateSlab(input) {
  const min = Number(input.minAmount ?? 0);
  const max = input.maxAmount === null || input.maxAmount === '' || input.maxAmount === undefined ? null : Number(input.maxAmount);
  if (!Number.isFinite(min) || min < 0) return 'Minimum amount must be zero or greater.';
  if (max !== null && (!Number.isFinite(max) || max < min)) return 'Maximum amount must be greater than or equal to minimum amount.';
  if (!Array.isArray(input.steps) || !input.steps.length) return 'At least one approval step is required.';
  const stepNumbers = input.steps.map((step, index) => Number(step.step ?? index + 1));
  if (stepNumbers.some((step) => !Number.isInteger(step) || step <= 0) || new Set(stepNumbers).size !== stepNumbers.length) return 'Workflow step numbers must be unique positive whole numbers.';
  if (input.steps.some((step) => !String(step.title || '').trim() || (!String(step.roleKey || '').trim() && !String(step.approverUserId || '').trim()))) return 'Every step requires a title and an approver role or user.';
  return '';
}

async function findOverlap({ category, minAmount, maxAmount, priority = 100, excludeId }) {
  const min = Number(minAmount || 0);
  const max = maxAmount === null || maxAmount === '' || maxAmount === undefined ? Infinity : Number(maxAmount);
  const candidates = await Workflow.find({ category, status: { $in: ['Active', 'active'] }, ...(excludeId ? { id: { $ne: excludeId } } : {}) }).lean();
  return candidates.find((item) => {
    const itemMin = Number(item.minAmount || 0);
    const itemMax = item.maxAmount === null || item.maxAmount === undefined ? Infinity : Number(item.maxAmount);
    return min <= itemMax && itemMin <= max && Number(item.priority || 100) === Number(priority || 100);
  });
}

async function auditConfiguration(req, slab, eventType, previousState = null) {
  await WorkflowAudit.create({ eventId: `wa-${crypto.randomUUID()}`, eventType, actorId: req.user?.id || req.user?.email || 'system', actorName: req.user?.name, actorRole: req.user?.role, entityType: 'Workflow', entityId: slab.definitionKey || slab.id, workflowId: slab.id, workflowVersion: slab.version, previousState, newState: slab.toObject ? slab.toObject() : slab, requestId: req.headers['x-request-id'] });
}

export const getWorkflows = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size, 10) || 10));
  const query = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();

  if (mongoose.connection.readyState !== 1) {
    return res.json({
      success: true,
      count: DUMMY_WORKFLOWS.length,
      total: DUMMY_WORKFLOWS.length,
      page: 1,
      size,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
      slabs: DUMMY_WORKFLOWS
    });
  }
  const filter = { status: { $in: ['Active', 'active'] } };

  if (category && category !== 'All') {
    const escaped = escapeRegex(category);
    const catPattern = new RegExp(`^${escaped.replace(/s$/i, '')}s?$`, 'i');
    filter.$or = [{ category: catPattern }, { category: category }];
  }
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
  const validationError = validateSlab(req.body);
  if (validationError) return res.status(400).json({ success: false, error: validationError });
  const definitionKey = normalizeKey(req.body.definitionKey || `${category}_${name}`);
  const latest = await Workflow.findOne({ definitionKey }).sort({ version: -1 }).lean();
  const overlap = await findOverlap({ category: category.trim(), minAmount, maxAmount, priority: req.body.priority });
  if (overlap) return res.status(409).json({ success: false, error: `This amount range overlaps active workflow "${overlap.name}" at the same priority.` });
  const slab = await Workflow.create({
    id: `wf-${crypto.randomUUID()}`,
    category: category.trim(),
    definitionKey,
    version: Number(latest?.version || 0) + 1,
    name: name.trim(),
    minAmount: Number(minAmount),
    maxAmount: maxAmount === '' || maxAmount === null ? null : Number(maxAmount),
    formattedRange: formatRange(minAmount, maxAmount),
    description,
    steps,
    priority: Number(req.body.priority || 100),
    conditions: req.body.conditions || {},
    effectiveFrom: req.body.effectiveFrom || new Date(),
    createdBy: req.user?.id || req.user?.email,
    activatedBy: req.user?.id || req.user?.email,
    activatedAt: new Date()
  });
  await auditConfiguration(req, slab, 'WORKFLOW_VERSION_CREATED');
  return res.status(201).json({ success: true, message: 'Workflow created.', slab });
};

export const updateWorkflowSlab = async (req, res) => {
  const existing = await Workflow.findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ success: false, error: 'Workflow not found.' });
  const merged = { ...existing.toObject(), ...req.body, steps: req.body.steps || existing.steps };
  const validationError = validateSlab(merged);
  if (validationError) return res.status(400).json({ success: false, error: validationError });
  const overlap = await findOverlap({ category: merged.category, minAmount: merged.minAmount, maxAmount: merged.maxAmount, priority: merged.priority, excludeId: existing.id });
  if (overlap) return res.status(409).json({ success: false, error: `This amount range overlaps active workflow "${overlap.name}" at the same priority.` });
  existing.definitionKey ||= normalizeKey(`${existing.category}_${existing.name}`);
  existing.status = 'Retired';
  existing.effectiveTo = new Date();
  await existing.save();
  const slab = await Workflow.create({ ...merged, _id: undefined, id: `wf-${crypto.randomUUID()}`, definitionKey: existing.definitionKey || normalizeKey(`${merged.category}_${merged.name}`), version: Number(existing.version || 1) + 1, status: req.body.status || 'Active', formattedRange: formatRange(merged.minAmount, merged.maxAmount), effectiveFrom: new Date(), effectiveTo: undefined, createdBy: req.user?.id || req.user?.email, activatedBy: req.user?.id || req.user?.email, activatedAt: new Date(), createdAt: undefined, updatedAt: undefined });
  await auditConfiguration(req, slab, 'WORKFLOW_VERSION_ACTIVATED', existing.toObject());
  return res.json({ success: true, message: 'New workflow version activated; existing approvals keep their original snapshot.', slab });
};

export const deleteWorkflowSlab = async (req, res) => {
  const slab = await Workflow.findOne({ id: req.params.id });
  if (!slab) return res.status(404).json({ success: false, error: 'Workflow not found.' });
  const inUse = await Approval.exists({ workflowId: { $in: [slab.id, String(slab._id)] } });
  slab.definitionKey ||= normalizeKey(`${slab.category}_${slab.name}`);
  slab.status = 'Retired';
  slab.effectiveTo = new Date();
  await slab.save();
  await auditConfiguration(req, slab, 'WORKFLOW_RETIRED');
  return res.json({ success: true, message: inUse ? 'Workflow retired because approval history references it.' : 'Workflow retired safely.', id: req.params.id });
};
