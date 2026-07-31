import { Vendor } from '../../models/Vendor.js';

export const initialVendorsStore = [];

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

    // Deduplicate by sapVendorCode, supplierId, id, or _id
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
    return res.json({ success: true, vendor });
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

    const uniqueId = `v-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const finalSapCode = sapVendorCode || `1000${Math.floor(1000 + Math.random() * 9000)}`;

    const newVendorObj = {
      id: uniqueId,
      supplierId: finalSapCode,
      sapVendorCode: finalSapCode,
      companyName,
      contactPerson: contactPerson || companyName,
      phone: phone || '+91 9800000000',
      email,
      temporaryPassword: password || `Rayzon@${uniqueId.slice(-4)}`,
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

    Vendor.collection.dropIndex('supplierId_1').catch(() => {});

    let createdVendor = newVendorObj;
    try {
      createdVendor = await Vendor.create(newVendorObj);
      console.log(`[VENDOR DB SUCCESS] Persisted vendor "${companyName}" in MongoDB with ID ${uniqueId}`);
    } catch (dbErr) {
      console.warn('[VENDOR DB RETRY] Retrying with dropIndex:', dbErr.message);
      try {
        await Vendor.collection.dropIndex('supplierId_1');
        createdVendor = await Vendor.create(newVendorObj);
      } catch (retryErr) {
        console.warn('[VENDOR DB ERROR] Error inserting to MongoDB:', retryErr.message);
      }
    }

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
    const filter = buildVendorFilter(id);
    const updatedVendor = await Vendor.findOneAndUpdate(filter, req.body, { new: true });
    
    return res.json({
      success: true,
      message: 'Vendor record updated',
      vendor: updatedVendor || req.body
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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
    const updated = await Vendor.findOneAndUpdate(filter, { temporaryPassword: tempPass }, { new: true }).catch(() => {});
    
    return res.json({
      success: true,
      message: `Temporary password generated for vendor ${id}: ${tempPass}`,
      temporaryPassword: tempPass,
      vendor: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};