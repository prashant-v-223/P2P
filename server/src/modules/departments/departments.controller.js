import { Department } from '../../models/Department.js';
import { User } from '../../models/User.js';

const DEFAULT_DEPARTMENTS = [
  'Procurement',
  'Finance & Accounts',
  'EXIM & Logistics',
  'Supply Chain',
  'IT Operations',
  'Executive Management',
  'Accounts & Finance'
];

export const getDepartments = async (req, res) => {
  let dbDepartments = await Department.find({}).sort({ name: 1 }).lean();

  if (!dbDepartments || dbDepartments.length === 0) {
    // Auto-seed initial default departments into DB if database is fresh
    const seedDocs = DEFAULT_DEPARTMENTS.map(name => ({
      name,
      code: name.substring(0, 4).toUpperCase(),
      status: 'Active'
    }));
    try {
      dbDepartments = await Department.insertMany(seedDocs, { ordered: false });
    } catch (e) {
      dbDepartments = await Department.find({}).sort({ name: 1 }).lean();
    }
  }

  // Also discover any distinct department names present in User records
  const userDepts = await User.distinct('department');
  const allDeptNames = Array.from(
    new Set([
      ...dbDepartments.map(d => d.name),
      ...userDepts.filter(Boolean)
    ])
  ).sort();

  return res.json({
    success: true,
    departments: dbDepartments,
    departmentNames: allDeptNames
  });
};

export const createDepartment = async (req, res) => {
  const { name, code, description, status } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Department name is required.' });
  }

  const existing = await Department.findOne({ name: name.trim() });
  if (existing) {
    return res.status(400).json({ success: false, error: 'Department already exists.' });
  }

  const newDept = await Department.create({
    name: name.trim(),
    code: code ? code.trim() : name.substring(0, 4).toUpperCase(),
    description: description || '',
    status: status || 'Active'
  });

  return res.status(201).json({ success: true, department: newDept });
};

export const deleteDepartment = async (req, res) => {
  const { id } = req.params;
  await Department.findByIdAndDelete(id);
  return res.json({ success: true, message: 'Department deleted.' });
};
