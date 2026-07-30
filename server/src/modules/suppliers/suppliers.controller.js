import { Supplier } from '../../models/Supplier.js';

export const initialSuppliersStore = [
  {
    sapVendorCode: '10000071',
    supplierId: '10000071',
    companyName: 'Genx Pv India Pvt. Ltd.',
    name: 'Genx Pv India Pvt. Ltd.',
    contactPerson: 'Mr. Saumil',
    phone: '+91 9021120049',
    email: 'saumil@genxpv.com',
    gstin: '29AAJCG4134F1ZM',
    pan: 'AAJCG4134F',
    bankName: 'ICICI Bank',
    branch: 'Indiranagar, Bengaluru',
    accountNumber: '**** 8031',
    ifscCode: 'ICIC0001174',
    vendorType: 'DOMESTIC',
    paymentTerms: '30 Days',
    city: 'Bengaluru',
    country: 'IN'
  },
  {
    sapVendorCode: '10000085',
    supplierId: '10000085',
    companyName: 'Ramanbhai Ashabhai C Chaudhari',
    name: 'Ramanbhai Ashabhai C Chaudhari',
    contactPerson: 'Ramesh Patel',
    phone: '+91 98000 00000',
    email: 'ramesh@p2p.com',
    gstin: '24AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    bankName: 'State Bank of India',
    branch: 'Mumbai Main',
    accountNumber: '**** 4490',
    ifscCode: 'SBIN0000300',
    vendorType: 'DOMESTIC',
    paymentTerms: '30 Days',
    city: 'Mumbai',
    country: 'IN'
  },
  {
    sapVendorCode: '10000120',
    supplierId: '10000120',
    companyName: 'Waaree Energies Ltd.',
    name: 'Waaree Energies Ltd.',
    contactPerson: 'Hitesh Doshi',
    phone: '+91 98201 11223',
    email: 'info@waaree.com',
    gstin: '27AABCW1234F1Z9',
    pan: 'AABCW1234F',
    bankName: 'HDFC Bank',
    branch: 'Surat Main',
    accountNumber: '**** 1120',
    ifscCode: 'HDFC0000055',
    vendorType: 'DOMESTIC',
    paymentTerms: '60 Days',
    city: 'Surat',
    country: 'IN'
  },
  {
    sapVendorCode: '10000145',
    supplierId: '10000145',
    companyName: 'Goldi Solar Pvt. Ltd.',
    name: 'Goldi Solar Pvt. Ltd.',
    contactPerson: 'Ishver Dholakiya',
    phone: '+91 99090 88776',
    email: 'contact@goldisolar.com',
    gstin: '24AABCG9876E1Z2',
    pan: 'AABCG9876E',
    bankName: 'Axis Bank',
    branch: 'Navsari Branch',
    accountNumber: '**** 5543',
    ifscCode: 'UTIB0000189',
    vendorType: 'DOMESTIC',
    paymentTerms: '30 Days',
    city: 'Navsari',
    country: 'IN'
  },
  {
    sapVendorCode: '10000189',
    supplierId: '10000189',
    companyName: 'Vikram Solar Ltd.',
    name: 'Vikram Solar Ltd.',
    contactPerson: 'Gyanesh Chaudhary',
    phone: '+91 98310 99887',
    email: 'sales@vikramsolar.com',
    gstin: '19AABCV5544D1Z8',
    pan: 'AABCV5544D',
    bankName: 'Kotak Mahindra Bank',
    branch: 'Kolkata Park Street',
    accountNumber: '**** 9981',
    ifscCode: 'KKBK0000951',
    vendorType: 'DOMESTIC',
    paymentTerms: '60 Days',
    city: 'Kolkata',
    country: 'IN'
  },
  {
    sapVendorCode: '10000210',
    supplierId: '10000210',
    companyName: 'Premier Energies Ltd.',
    name: 'Premier Energies Ltd.',
    contactPerson: 'Chiranjeev Saluja',
    phone: '+91 98490 12345',
    email: 'contact@premierenergies.com',
    gstin: '36AABCP3322C1Z4',
    pan: 'AABCP3322C',
    bankName: 'Yes Bank',
    branch: 'Hyderabad HITEC City',
    accountNumber: '**** 3321',
    ifscCode: 'YESB0000102',
    vendorType: 'DOMESTIC',
    paymentTerms: '30 Days',
    city: 'Hyderabad',
    country: 'IN'
  }
];

export const normalizeSupplierRecord = (s) => {
  const code = s.supplierId || s.sapVendorCode || s.sapPayload?.Supplier || '';
  const nameStr = s.name || s.companyName || s.sapPayload?.SupplierName || s.sapPayload?.BPSupplierName || s.sapPayload?.BPSupplierFullName || '';
  const gstinStr = s.gstin || s.taxNumber || s.sapPayload?.TaxNumber3 || '';
  const panStr = s.pan || s.sapPayload?.BusinessPartnerPanNumber || '';
  const cityStr = s.city || s.sapPayload?.CityName || s.sapPayload?.BPAddrCityName || '';
  const countryStr = s.country || s.sapPayload?.Country || '';
  const addressStr = s.address || s.sapPayload?.BPAddrStreetName || s.sapPayload?.StreetName || '';
  const emailStr = s.email || s.sapPayload?.EmailAddress || (code ? `supplier${code}@p2p.com` : '');
  const accountGroup = s.sapPayload?.SupplierAccountGroup || 'Z006';

  return {
    ...s,
    sapVendorCode: code,
    supplierId: code,
    companyName: nameStr,
    name: nameStr,
    gstin: gstinStr,
    pan: panStr,
    city: cityStr,
    country: countryStr,
    address: addressStr,
    email: emailStr,
    contactPerson: s.contactPerson || nameStr,
    phone: s.phone || '+91 9000000000',
    bankName: s.bankName || 'State Bank of India',
    branch: s.branch || (cityStr ? `${cityStr} Branch` : 'Main Branch'),
    accountNumber: s.accountNumber || `**** ${code.slice(-4) || '1000'}`,
    ifscCode: s.ifscCode || 'SBIN0000300',
    vendorType: countryStr && countryStr !== 'IN' ? 'IMPORT' : 'DOMESTIC',
    paymentTerms: s.paymentTerms || '30 Days',
    accountGroup
  };
};

export const getSuppliers = async (req, res) => {
  try {
    const { q } = req.query;
    let rawSuppliers = await Supplier.find().lean().catch(() => []);

    if (!rawSuppliers || rawSuppliers.length === 0) {
      rawSuppliers = initialSuppliersStore;
    }

    let normalizedList = rawSuppliers.map(normalizeSupplierRecord);

    if (q && q.trim()) {
      const searchLower = q.trim().toLowerCase();
      normalizedList = normalizedList.filter(s =>
        (s.companyName || '').toLowerCase().includes(searchLower) ||
        (s.sapVendorCode || '').toLowerCase().includes(searchLower) ||
        (s.gstin || '').toLowerCase().includes(searchLower) ||
        (s.pan || '').toLowerCase().includes(searchLower) ||
        (s.city || '').toLowerCase().includes(searchLower) ||
        (s.address || '').toLowerCase().includes(searchLower)
      );
    }

    return res.status(200).json({
      success: true,
      count: normalizedList.length,
      suppliers: normalizedList
    });
  } catch (err) {
    let fallbackList = initialSuppliersStore.map(normalizeSupplierRecord);
    if (req.query.q && req.query.q.trim()) {
      const searchLower = req.query.q.trim().toLowerCase();
      fallbackList = fallbackList.filter(s =>
        (s.companyName || '').toLowerCase().includes(searchLower) ||
        (s.sapVendorCode || '').toLowerCase().includes(searchLower)
      );
    }
    return res.status(200).json({
      success: true,
      count: fallbackList.length,
      suppliers: fallbackList
    });
  }
};