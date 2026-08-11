import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { Vendor } from '../../models/Vendor.js';
import { PurchaseOrder } from '../../models/PurchaseOrder.js';
import { InvoicePayment } from '../../models/InvoicePayment.js';
import { AdvancePayment } from '../../models/AdvancePayment.js';
import { WorkflowAudit } from '../../models/WorkflowAudit.js';

export const initialVendorsStore = [];

function escapeRegex(text = '') {
  return String(text).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function buildVendorFilter(id) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const filter = {
    $or: [
      { id },
      { sapVendorCode: id },
      { supplierId: id }
    ]
  };
  if (isObjectId) {
    filter.$or.push({ _id: id });
  }
  return filter;
}

export const getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 }).lean().catch(() => []);

    const seenKeys = new Set();
    const uniqueVendors = [];
    for (const v of vendors) {
      const key = v.sapVendorCode || v.supplierId || v.id || v._id?.toString();
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueVendors.push(v);
      }
    }

    return res.json({ success: true, count: uniqueVendors.length, vendors: uniqueVendors });
  } catch (err) {
    return res.json({ success: true, count: 0, vendors: [] });
  }
};

export const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = buildVendorFilter(id);
    const vendor = await Vendor.findOne(filter).lean();
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor account not found.' });
    }

    // Dynamically fetch actual Purchase Orders from MongoDB for this vendor
    const vendorCode = vendor.sapVendorCode || vendor.supplierId || vendor.id;
    const rxCode = new RegExp(escapeRegex(vendorCode), 'i');
    const rxName = new RegExp(escapeRegex(vendor.companyName || ''), 'i');

    const realPos = await PurchaseOrder.find({
      $or: [
        { supplierId: rxCode },
        { supplierName: rxCode },
        { supplierName: rxName }
      ]
    }).sort({ createdAt: -1 }).lean().catch(() => []);

    const dynamicRecentPOs = realPos.map(p => ({
      poNumber: p.sapPoNumber || p.poNumber,
      date: p.documentDate ? new Date(p.documentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '27 Jul 2026',
      type: (p.currency === 'USD' || p.currency === 'EUR') ? 'IMPORT PO' : 'DOMESTIC PO',
      amount: `${p.currency === 'USD' ? 'USD ' : p.currency === 'EUR' ? 'EUR ' : '₹'}${Number(p.totalAmount || 0).toLocaleString('en-IN')}`,
      status: p.status ? (p.status.charAt(0).toUpperCase() + p.status.slice(1).replace('_', ' ')) : 'Open'
    }));

    const finalVendor = {
      ...vendor,
      recentPOs: dynamicRecentPOs.length ? dynamicRecentPOs : (vendor.recentPOs || []),
      purchaseOrdersCount: dynamicRecentPOs.length || vendor.purchaseOrdersCount || 0
    };

    return res.json({ success: true, vendor: finalVendor });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const vendorLogin = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = String(email || username || '').trim().toLowerCase();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, error: 'Email/Vendor Code and password are required.' });
    }


    const rx = new RegExp(`^${escapeRegex(loginIdentifier)}$`, 'i');
    let vendor = await Vendor.findOne({
      $or: [
        { email: rx },
        { sapVendorCode: rx },
        { supplierId: rx },
        { id: rx }
      ]
    }).sort({ updatedAt: -1 }).select('+passwordHash +legacyPasswordHash');

    if (!vendor) {
      vendor = await Vendor.findOne({
        email: new RegExp(escapeRegex(loginIdentifier), 'i')
      }).sort({ updatedAt: -1 }).select('+passwordHash +legacyPasswordHash');
    }

    if (!vendor) {
      return res.status(401).json({ success: false, error: 'Vendor account not found. Please check your email or contact support.' });
    }

    if (vendor.portalAccessEnabled === false || vendor.status === 'Inactive') {
      return res.status(403).json({ success: false, error: 'Portal access has been disabled for this vendor account.' });
    }

    // Verify password using scrypt hash
    const { User } = await import('../../models/User.js');
    const currentPasswordValid = vendor.passwordHash
      ? await User.prototype.verifyPassword.call({ passwordHash: vendor.passwordHash }, password)
      : false;
    const legacyPasswordValid = !currentPasswordValid && vendor.legacyPasswordHash
      ? await bcrypt.compare(password, vendor.legacyPasswordHash)
      : false;
    const isPasswordValid = currentPasswordValid || legacyPasswordValid;

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Invalid password. Please try again.' });
    }

    const payload = {
      id: vendor.id || vendor._id,
      sapVendorCode: vendor.sapVendorCode || vendor.supplierId,
      companyName: vendor.companyName,
      email: vendor.email,
      role: 'Vendor'
    };

    const token = jwt.sign(payload, config.jwtAccessSecret, { expiresIn: '7d' });

    const vendorProfile = {
      sapVendorCode: vendor.sapVendorCode || vendor.supplierId || '20000201',
      companyName: vendor.companyName,
      contactPerson: vendor.contactPerson || vendor.companyName,
      email: vendor.email,
      phone: vendor.phone || '+91 9800000000',
      vendorType: vendor.vendorType || 'Domestic Vendor',
      category: vendor.category || '',
      status: vendor.status || 'Active',
      gstin: vendor.gstin || '-',
      pan: vendor.pan || '-',
      bankName: vendor.bankName || 'HDFC Bank',
      branch: vendor.branch || 'Main Branch',
      accountNumber: vendor.accountNumber || '**** 8888',
      ifscCode: vendor.ifscCode || 'HDFC0000101',
      isLoggedIn: true
    };

    return res.json({
      success: true,
      message: 'Vendor login successful',
      token,
      vendor: vendorProfile
    });
  } catch (err) {
    console.error('[VENDOR LOGIN ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getVendorPortalData = async (req, res) => {
  try {
    const isVendorSession = req.user?.role === 'Vendor';
    const vendorCode = String(
      isVendorSession
        ? (req.user?.sapVendorCode || '')
        : (req.query.vendorCode || req.query.sapVendorCode || req.user?.sapVendorCode || '')
    ).trim();
    const email = String(
      isVendorSession ? (req.user?.email || '') : (req.query.email || req.user?.email || '')
    ).trim();

    if (!vendorCode && !email) {
      return res.json({ success: true, purchaseOrders: [], invoices: [], advances: [] });
    }

    const rxCode = vendorCode ? new RegExp(`^${escapeRegex(vendorCode)}$`, 'i') : null;
    const rxEmail = email ? new RegExp(`^${escapeRegex(email)}$`, 'i') : null;

    // Resolve vendor profile to collect all associated IDs, codes, names, and emails
    const vendorDoc = await Vendor.findOne({
      $or: [
        ...(rxCode ? [{ sapVendorCode: rxCode }, { supplierId: rxCode }, { id: rxCode }] : []),
        ...(rxEmail ? [{ email: rxEmail }] : [])
      ]
    }).lean();

    const keysToMatch = new Set();
    if (vendorCode) keysToMatch.add(vendorCode);
    if (email) keysToMatch.add(email);

    if (vendorDoc) {
      if (vendorDoc.sapVendorCode) keysToMatch.add(vendorDoc.sapVendorCode);
      if (vendorDoc.supplierId) keysToMatch.add(vendorDoc.supplierId);
      if (vendorDoc.companyName) keysToMatch.add(vendorDoc.companyName);
      if (vendorDoc.email) keysToMatch.add(vendorDoc.email);
      if (vendorDoc.id) keysToMatch.add(vendorDoc.id);
    }

    const matchRegexes = Array.from(keysToMatch).map(k => new RegExp(`^${escapeRegex(k)}$`, 'i'));

    // Strictly fetch Purchase Orders for this logged-in vendor
    const pos = await PurchaseOrder.find({
      $or: [
        { supplierId: { $in: matchRegexes } },
        { supplierName: { $in: matchRegexes } }
      ]
    }).sort({ createdAt: -1 }).lean().catch(() => []);

    // Strictly fetch Invoices submitted by or assigned to this logged-in vendor
    const invs = await InvoicePayment.find({
      $or: [
        { vendorId: { $in: matchRegexes } },
        { vendorName: { $in: matchRegexes } },
        { createdBy: { $in: matchRegexes } },
        { requestedBy: { $in: matchRegexes } },
        { requestedById: { $in: matchRegexes } },
        { userId: { $in: matchRegexes } }
      ]
    }).sort({ createdAt: -1 }).lean().catch(() => []);

    // Strictly fetch Advance Payments for this logged-in vendor
    const advs = await AdvancePayment.find({
      $or: [
        { vendorId: { $in: matchRegexes } },
        { vendorName: { $in: matchRegexes } },
        { createdBy: { $in: matchRegexes } },
        { requestedBy: { $in: matchRegexes } },
        { requestedById: { $in: matchRegexes } },
        { userId: { $in: matchRegexes } }
      ]
    }).sort({ createdAt: -1 }).lean().catch(() => []);

    const activeStatuses = new Set(['pending', 'approved', 'paid']);
    const purchaseOrders = pos.map((po) => {
      const refs = new Set([po.poNumber, po.sapPoNumber].filter(Boolean).map(String));
      const poInvoices = invs.filter((invoice) =>
        activeStatuses.has(String(invoice.status).toLowerCase()) &&
        (refs.has(String(invoice.poId)) || refs.has(String(invoice.sapPoNumber)))
      );
      const poAdvances = advs.filter((advance) =>
        activeStatuses.has(String(advance.status).toLowerCase()) &&
        (refs.has(String(advance.poId)) || refs.has(String(advance.sapPoNumber)))
      );
      const invoicedAmount = poInvoices.reduce((sum, invoice) => sum + (Number(invoice.grossAmount) || 0), 0);
      const invoicedQuantity = poInvoices.reduce((sum, invoice) => sum + (Number(invoice.threeWayMatch?.invoiceQuantity) || 0), 0);
      const advanceCommitted = poAdvances.reduce((sum, advance) => sum + (Number(advance.amount) || 0), 0);
      const totalQuantity = (po.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return {
        ...po,
        invoicedAmount,
        remainingInvoiceAmount: Math.max(0, Number(po.totalAmount) - invoicedAmount),
        advanceCommitted,
        remainingAdvanceAmount: Math.max(0, Number(po.totalAmount) - advanceCommitted),
        totalQuantity,
        remainingQuantity: Math.max(0, totalQuantity - invoicedQuantity)
      };
    });

    return res.json({
      success: true,
      purchaseOrders,
      invoices: invs,
      advances: advs
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const createVendor = async (req, res) => {
  try {
    const { sapVendorCode, companyName, contactPerson, phone, email, password, vendorType, paymentTerms, gstin, pan, bankName, branch, accountNumber, ifscCode } = req.body;
    if (!companyName || !email) {
      return res.status(400).json({ success: false, error: 'Company name and official email are required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const uniqueId = `v-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const finalSapCode = sapVendorCode || `1000${Math.floor(1000 + Math.random() * 9000)}`;

    // Hash password properly
    const { User } = await import('../../models/User.js');
    const passwordHash = await User.hashPassword(password);

    const newVendorObj = {
      id: uniqueId,
      supplierId: finalSapCode,
      sapVendorCode: finalSapCode,
      companyName,
      contactPerson: contactPerson || companyName,
      phone: phone || '+91 9800000000',
      email,
      passwordHash,
      vendorType: vendorType || 'DOMESTIC',
      paymentTerms: paymentTerms || '30 Days',
      status: 'Active',
      category: 'Manufacturing',
      gstin: gstin || '29AAAAA0000A1Z1',
      pan: pan || 'AAAAA0000A',
      bankName: bankName || 'HDFC Bank',
      branch: branch || 'Main Branch',
      accountNumber: accountNumber || '**** 9021',
      ifscCode: ifscCode || 'HDFC0000101',
      portalAccessEnabled: true,
      loginUrl: '/vendor/login',
      purchaseOrdersCount: 0,
      advancePaymentsCount: 0,
      totalInvoicesCount: 0,
      invoicesPaidCount: 0,
      recentPOs: [],
      recentPayments: []
    };

    Vendor.collection.dropIndex('supplierId_1').catch(() => { });

    let createdVendor = newVendorObj;
    try {
      createdVendor = await Vendor.create(newVendorObj);
      console.log(`[VENDOR DB SUCCESS] Persisted vendor "${companyName}" in MongoDB with ID ${uniqueId}`);
    } catch (dbErr) {
      try {
        await Vendor.collection.dropIndex('supplierId_1');
        createdVendor = await Vendor.create(newVendorObj);
      } catch (retryErr) {
        console.warn('[VENDOR DB ERROR] Error inserting to MongoDB:', retryErr.message);
      }
    }

    try {
      await WorkflowAudit.create({
        eventId: `wa-${crypto.randomUUID()}`,
        eventType: 'VENDOR_CREATED',
        entityType: 'Vendor',
        entityId: createdVendor?.id || uniqueId,
        referenceNumber: finalSapCode,
        action: 'create',
        actorId: req.user?.id || 'system',
        actorName: req.user?.name || req.user?.email || 'System Admin',
        actorRole: req.user?.role || 'Admin',
        remarks: `Vendor account "${companyName}" (${finalSapCode}) provisioned.`
      });
    } catch (_) { }

    return res.status(201).json({
      success: true,
      message: 'Vendor provisioned successfully',
      vendor: createdVendor || newVendorObj
    });
  } catch (err) {
    console.error('Error creating vendor:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUserId = req.user?.id;

    if (!loggedInUserId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required.',
      });
    }

    const filter = buildVendorFilter(id);

    const existingVendor = await Vendor.findOne(filter);

    if (!existingVendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor account not found.',
      });
    }

    let updates = { ...req.body };

    // Never allow password fields through this API
    delete updates.passwordHash;
    delete updates.password;

    // IMPORTANT:
    // Vendor user can ONLY update their own vendor record
    if (req.user?.role === 'Vendor') {
      const ownsAccount =
        String(existingVendor.userId) === String(loggedInUserId);

      if (!ownsAccount) {
        return res.status(403).json({
          success: false,
          error: 'You cannot update another vendor account.',
        });
      }

      // Fields Vendor user is allowed to edit
      const editableFields = [
        'contactPerson',
        'phone',
        'email',
        'bankName',
        'branch',
        'accountNumber',
        'ifscCode',
      ];

      updates = Object.fromEntries(
        Object.entries(updates).filter(([key]) =>
          editableFields.includes(key)
        )
      );
    }

    // Never allow userId to be changed from request body
    delete updates.userId;

    // Audit information
    updates.updatedBy = loggedInUserId;

    const updatedVendor = await Vendor.findOneAndUpdate(
      filter,
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.json({
      success: true,
      message: 'Vendor record updated',
      vendor: updatedVendor,
    });
  } catch (err) {
    console.error('[UPDATE VENDOR ERROR]', err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = buildVendorFilter(id);
    await Vendor.findOneAndDelete(filter);
    return res.json({
      success: true,
      message: 'Vendor deleted',
      id
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const generateVendorPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = buildVendorFilter(id);
    const tempPass = `RyznP2P@${Math.floor(1000 + Math.random() * 9000)}`;

    // Hash the new temporary password
    const { User } = await import('../../models/User.js');
    const passwordHash = await User.hashPassword(tempPass);

    const updated = await Vendor.findOneAndUpdate(
      filter,
      { $set: { passwordHash, passwordResetRequired: true, portalAccessEnabled: true }, $unset: { legacyPasswordHash: 1 } },
      { new: true }
    ).select('+passwordHash');

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Vendor account not found. Password was not changed.' });
    }

    // Do not expose a password unless the stored hash verifies successfully.
    const passwordWasSaved = await User.prototype.verifyPassword.call(
      { passwordHash: updated.passwordHash },
      tempPass
    );
    if (!passwordWasSaved) {
      return res.status(500).json({ success: false, error: 'Password could not be saved. Please try again.' });
    }

    return res.json({
      success: true,
      message: `Temporary password generated for vendor ${id}`,
      temporaryPassword: tempPass, // Only show once for communication to vendor
      vendor: {
        id: updated.id,
        sapVendorCode: updated.sapVendorCode,
        email: updated.email
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const vendorChangePassword = async (req, res) => {
  try {
    const { vendorId, sapVendorCode, email, currentPassword, newPassword } = req.body;
    const identifier = vendorId || sapVendorCode || email || req.user?.sapVendorCode;

    if (!identifier || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
    }

    const filter = buildVendorFilter(identifier);
    let vendor = await Vendor.findOne(filter).select('+passwordHash +legacyPasswordHash');
    if (!vendor && email) {
      vendor = await Vendor.findOne({ email: new RegExp(escapeRegex(email), 'i') }).select('+passwordHash +legacyPasswordHash');
    }

    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor account not found.' });
    }

    // Verify current password
    const { User } = await import('../../models/User.js');
    const currentPasswordValid = vendor.passwordHash
      ? await User.prototype.verifyPassword.call({ passwordHash: vendor.passwordHash }, currentPassword)
      : false;
    const isPasswordValid = currentPasswordValid || Boolean(vendor.legacyPasswordHash && await bcrypt.compare(currentPassword, vendor.legacyPasswordHash));

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    // Hash and save new password
    vendor.passwordHash = await User.hashPassword(newPassword);
    vendor.legacyPasswordHash = undefined;
    vendor.passwordResetRequired = false;
    await vendor.save();

    return res.json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
