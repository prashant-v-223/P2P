import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';

const VendorContext = createContext();

const initialVendorProfile = {
  sapVendorCode: '',
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  vendorType: '',
  status: 'Active',
  gstin: '',
  pan: '',
  bankName: '',
  branch: '',
  accountNumber: '',
  ifscCode: ''
};

const initialPurchaseOrders = [];

export const VendorProvider = ({ children }) => {
  const [vendorUser, setVendorUser] = useState(() => {
    const saved = localStorage.getItem('rayzon_vendor_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [vendorProfile, setVendorProfile] = useState(() => {
    const saved = localStorage.getItem('rayzon_vendor_profile');
    return saved ? JSON.parse(saved) : initialVendorProfile;
  });

  const [purchaseOrders, setPurchaseOrders] = useState(() => {
    const saved = localStorage.getItem('rayzon_vendor_pos');
    return saved ? JSON.parse(saved) : initialPurchaseOrders;
  });

  const [invoices, setInvoices] = useState(() => {
    const saved = localStorage.getItem('rayzon_vendor_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  const [advances, setAdvances] = useState(() => {
    const saved = localStorage.getItem('rayzon_vendor_advances');
    return saved ? JSON.parse(saved) : [];
  });

  const fetchPortalData = useCallback(async (vendorCode, vendorEmail) => {
    try {
      const code = vendorCode || vendorProfile.sapVendorCode || '20000201';
      const mail = vendorEmail || vendorProfile.email || '';
      const res = await apiFetch(`/api/vendors/portal-data?vendorCode=${encodeURIComponent(code)}&email=${encodeURIComponent(mail)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.purchaseOrders?.length) {
          const pos = json.purchaseOrders.map(p => ({
            id: p.sapPoNumber || p.poNumber,
            date: p.date || 'Today',
            amount: `₹${(p.totalAmount || 0).toLocaleString('en-IN')}`,
            status: p.status || 'Open',
            currency: p.currency || 'INR',
            numericAmount: p.totalAmount || 0
          }));
          setPurchaseOrders(pos);
          localStorage.setItem('rayzon_vendor_pos', JSON.stringify(pos));
        }
        if (json.invoices?.length) {
          const invs = json.invoices.map(i => ({
            id: i.invoicePaymentId || i.invoiceNumber,
            invoiceNumber: i.invoiceNumber,
            poNumber: i.sapPoNumber || i.poId,
            createdAt: i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today',
            paymentDueDate: i.createdAt ? new Date(new Date(i.createdAt).getTime() + 30*24*60*60*1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '30 Days',
            status: i.status ? (i.status.charAt(0).toUpperCase() + i.status.slice(1)) : 'Pending',
            invoiceAmount: i.grossAmount ? `₹${Number(i.grossAmount).toLocaleString('en-IN')}` : '₹0',
            grnNo: i.grnNumber || 'GRN-001',
            fileName: 'Invoice-Document.pdf'
          }));
          setInvoices(invs);
          localStorage.setItem('rayzon_vendor_invoices', JSON.stringify(invs));
        }
        if (json.advances?.length) {
          const advs = json.advances.map(a => ({
            id: a.advanceId,
            poNumber: a.sapPoNumber || a.poId,
            amount: a.amount,
            status: a.status,
            createdAt: a.createdAt
          }));
          setAdvances(advs);
          localStorage.setItem('rayzon_vendor_advances', JSON.stringify(advs));
        }
      }
    } catch (e) {
      console.warn('[VENDOR PORTAL FETCH WARN]', e.message);
    }
  }, [vendorProfile.sapVendorCode, vendorProfile.email]);

  useEffect(() => {
    if (vendorUser?.isLoggedIn) {
      fetchPortalData(vendorUser.sapVendorCode, vendorUser.email);
    }
  }, [vendorUser?.isLoggedIn]);

  const loginVendor = async (email, password) => {
    setInvoices([]);
    setPurchaseOrders([]);
    setAdvances([]);
    localStorage.removeItem('rayzon_vendor_invoices');
    localStorage.removeItem('rayzon_vendor_pos');
    localStorage.removeItem('rayzon_vendor_advances');

    const res = await apiFetch('/api/vendors/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Vendor login failed. Please verify credentials.');
    }

    const user = {
      ...json.vendor,
      isLoggedIn: true,
      loginTime: new Date().toISOString()
    };

    setVendorUser(user);
    setVendorProfile(json.vendor);
    if (json.token) {
      localStorage.setItem('rayzon_vendor_token', json.token);
    }
    localStorage.setItem('rayzon_vendor_user', JSON.stringify(user));
    localStorage.setItem('rayzon_vendor_profile', JSON.stringify(json.vendor));

    await fetchPortalData(json.vendor.sapVendorCode, json.vendor.email);
    return user;
  };

  const logoutVendor = () => {
    setVendorUser(null);
    setInvoices([]);
    setPurchaseOrders([]);
    setAdvances([]);
    localStorage.removeItem('rayzon_vendor_user');
    localStorage.removeItem('rayzon_vendor_token');
    localStorage.removeItem('rayzon_vendor_profile');
    localStorage.removeItem('rayzon_vendor_invoices');
    localStorage.removeItem('rayzon_vendor_pos');
    localStorage.removeItem('rayzon_vendor_advances');
  };

  const addInvoice = async (newInvoice) => {
    const payload = {
      poNumber: newInvoice.poNumber,
      invoiceNumber: newInvoice.invoiceNumber,
      asnNumber: newInvoice.asnNumber || '',
      vendorId: vendorProfile.sapVendorCode || vendorUser.sapVendorCode || '30000111',
      vendorName: vendorProfile.companyName || vendorUser.companyName || 'Vendor',
      requestedBy: vendorProfile.companyName || vendorUser.companyName || 'Vendor',
      grossAmount: Number(newInvoice.invoiceAmount) || 0,
      gstAmount: Number(newInvoice.cgstAmount || 0) + Number(newInvoice.sgstAmount || 0) + Number(newInvoice.igstAmount || 0),
      tdsAmount: 0,
      tdsPercentage: newInvoice.tdsPercentage || '0%',
      advanceAdjusted: Number(newInvoice.advanceAdjust || 0),
      grnNumber: newInvoice.grnNo,
      remarks: newInvoice.remarks
    };

    let backendInvoiceId = null;
    try {
      const res = await apiFetch('/api/p2p/invoices/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        backendInvoiceId = json.data?.invoicePaymentId || json.data?.invoiceNumber;
      }
    } catch (e) {
      console.warn('[VENDOR INVOICE POST ERROR]', e.message);
    }

    const invoiceRecord = {
      id: backendInvoiceId || `INV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: 'Pending',
      ...newInvoice
    };

    setInvoices((prev) => {
      const updated = [invoiceRecord, ...prev];
      localStorage.setItem('rayzon_vendor_invoices', JSON.stringify(updated));
      return updated;
    });
    return invoiceRecord;
  };

  const addAdvanceRequest = (newAdvance) => {
    const advanceRecord = {
      id: `ADV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: 'In Progress',
      ...newAdvance
    };
    setAdvances((prev) => [advanceRecord, ...prev]);
    return advanceRecord;
  };

  const updateProfile = async (updatedFields) => {
    const updated = { ...vendorProfile, ...updatedFields };
    setVendorProfile(updated);
    if (vendorUser) {
      setVendorUser((prev) => ({ ...prev, ...updatedFields }));
    }
    localStorage.setItem('rayzon_vendor_profile', JSON.stringify(updated));

    try {
      const vId = vendorProfile.sapVendorCode || vendorProfile.id || '20000201';
      await apiFetch(`/api/vendors/${vId}`, {
        method: 'PUT',
        body: JSON.stringify(updatedFields)
      });
    } catch (e) {
      console.warn('[UPDATE VENDOR PROFILE API ERROR]', e.message);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    const vId = vendorProfile.sapVendorCode || vendorUser?.sapVendorCode;
    const email = vendorProfile.email || vendorUser?.email;

    const res = await apiFetch('/api/vendors/change-password', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: vId,
        email,
        currentPassword,
        newPassword
      })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to update password.');
    }
    return json;
  };

  return (
    <VendorContext.Provider
      value={{
        vendorUser,
        vendorProfile,
        purchaseOrders,
        invoices,
        advances,
        loginVendor,
        logoutVendor,
        addInvoice,
        addAdvanceRequest,
        updateProfile,
        changePassword,
        fetchPortalData
      }}
    >
      {children}
    </VendorContext.Provider>
  );
};

export const useVendor = () => {
  const context = useContext(VendorContext);
  if (!context) {
    throw new Error('useVendor must be used within a VendorProvider');
  }
  return context;
};
