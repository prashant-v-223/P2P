import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';

const VendorContext = createContext();

const initialVendorProfile = {
  sapVendorCode: '',
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  vendorType: '',
  category: '',
  status: 'Active',
  gstin: '',
  pan: '',
  bankName: '',
  branch: '',
  accountNumber: '',
  ifscCode: ''
};

const initialPurchaseOrders = [];

const readStored = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
};

const formatStatus = (status, fallback = 'Pending') => {
  if (!status) return fallback;
  return String(status)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const VendorProvider = ({ children }) => {
  const [vendorUser, setVendorUser] = useState(() => {
    return readStored('rayzon_vendor_user', null);
  });

  const [vendorProfile, setVendorProfile] = useState(() => {
    return readStored('rayzon_vendor_profile', initialVendorProfile);
  });

  const [purchaseOrders, setPurchaseOrders] = useState(() => {
    return readStored('rayzon_vendor_pos', initialPurchaseOrders);
  });

  const [invoices, setInvoices] = useState(() => {
    return readStored('rayzon_vendor_invoices', []);
  });

  const [advances, setAdvances] = useState(() => {
    return readStored('rayzon_vendor_advances', []);
  });

  const fetchPortalData = useCallback(async (vendorCode, vendorEmail) => {
    try {
      const code = vendorCode || vendorProfile.sapVendorCode || '';
      const mail = vendorEmail || vendorProfile.email || '';
      if (!code && !mail) {
        setPurchaseOrders([]);
        setInvoices([]);
        setAdvances([]);
        return;
      }
      const res = await apiFetch(`/api/vendors/portal-data?vendorCode=${encodeURIComponent(code)}&email=${encodeURIComponent(mail)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        const pos = (json.purchaseOrders || []).map(p => ({
            id: p.sapPoNumber || p.poNumber,
            date: p.documentDate || p.createdAt
              ? new Date(p.documentDate || p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—',
            dueDate: p.dueDate || p.deliveryDate || p.paymentDueDate
              ? new Date(p.dueDate || p.deliveryDate || p.paymentDueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—',
            amount: formatCurrency(p.totalAmount, p.currency || 'INR'),
            status: p.status || 'Open',
            currency: p.currency || 'INR',
            paymentTerms: p.paymentTerms || p.creditDays || '',
            creditDays: p.creditDays || p.paymentTerms || '',
            numericAmount: Number(p.totalAmount) || 0,
            remainingInvoiceAmount: Number(p.remainingInvoiceAmount) || 0,
            remainingAdvanceAmount: Number(p.remainingAdvanceAmount) || 0,
            totalQuantity: Number(p.totalQuantity) || 0,
            remainingQuantity: Number(p.remainingQuantity) || 0
          }));
        setPurchaseOrders(pos);
        localStorage.setItem('rayzon_vendor_pos', JSON.stringify(pos));

        const invs = (json.invoices || []).map(i => {
          const isImport = String(i.poNumber || i.sapPoNumber || '').startsWith('43') || String(i.poNumber || i.sapPoNumber || '').startsWith('PO-43') || String(vendorProfile?.vendorType || '').toLowerCase().includes('import');
          let formattedDueDate = '—';
          if (i.paymentDueDate || i.dueDate) {
            const d = new Date(i.paymentDueDate || i.dueDate);
            if (!isNaN(d.getTime())) {
              formattedDueDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
          } else {
            const baseDateStr = (isImport && i.blDate) ? i.blDate : i.invoiceDate;
            if (baseDateStr) {
              const d = new Date(baseDateStr);
              if (!isNaN(d.getTime())) {
                d.setDate(d.getDate() + Number(i.dueDays || 30));
                formattedDueDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
              }
            }
          }

          const gross = Number(i.grossAmount || i.invoiceAmount) || 0;
          const adv = Number(i.advanceAdjusted || i.advanceAdjust) || 0;
          const calculatedNet = Math.max(0, gross - adv);
          const netPayableVal = Number(i.netPayableAmount ?? i.netPayable) || calculatedNet || gross;

          return {
            id: i.invoicePaymentId || i.invoiceNumber || i._id,
            invoicePaymentId: i.invoicePaymentId || i.id,
            invoiceNumber: i.invoiceNumber,
            poNumber: i.sapPoNumber || i.poId,
            createdAt: i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today',
            rawCreatedAt: i.createdAt,
            paymentDueDate: formattedDueDate,
            rawPaymentDueDate: i.paymentDueDate || i.dueDate,
            invoiceDate: i.invoiceDate ? new Date(i.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            rawInvoiceDate: i.invoiceDate,
            status: formatStatus(i.status),
            invoiceAmount: gross,
            grossAmount: gross,
            netPayableAmount: netPayableVal,
            netPayable: netPayableVal,
            currency: i.currency || 'INR',
            grnNo: i.grnNumber || '',
            asnNumber: i.asnNumber || '',
            blNumber: i.blNumber || '',
            blDate: i.blDate ? new Date(i.blDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            rawBlDate: i.blDate,
            invoiceType: i.invoiceType || 'With GST',
            gstSubtype: i.gstSubtype || (i.igstAmount > 0 ? 'inter' : 'intra'),
            cgstAmount: Number(i.cgstAmount) || 0,
            sgstAmount: Number(i.sgstAmount) || 0,
            igstAmount: Number(i.igstAmount) || 0,
            gstAmount: Number(i.gstAmount || (Number(i.cgstAmount || 0) + Number(i.sgstAmount || 0) + Number(i.igstAmount || 0))) || 0,
            tdsPercentage: i.tdsPercentage || 0,
            tdsAmount: Number(i.tdsAmount) || 0,
            advanceAdjusted: adv,
            remarks: i.remarks || '',
            dueDays: i.dueDays || 30,
            supportingDocuments: i.supportingDocuments || [],
            fileName: i.supportingDocuments?.[0]?.originalName || i.supportingDocuments?.[0]?.fileName || 'Invoice-Document.pdf',
            rawInvoice: i
          };
        });
        setInvoices(invs);
        localStorage.setItem('rayzon_vendor_invoices', JSON.stringify(invs));

        const advs = (json.advances || []).map(a => ({
            id: a.advanceId,
            poNumber: a.sapPoNumber || a.poId,
            amount: Number(a.amount) || 0,
            currency: a.currency || 'INR',
            status: formatStatus(a.status),
            createdAt: a.createdAt
              ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '',
            requestedDate: a.createdAt
              ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : ''
          }));
        setAdvances(advs);
        localStorage.setItem('rayzon_vendor_advances', JSON.stringify(advs));
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
      invoiceDate: newInvoice.invoiceDate,
      paymentDueDate: newInvoice.paymentDueDate,
      supportingDocuments: newInvoice.supportingDocuments,
      vendorId: vendorProfile.sapVendorCode || vendorUser.sapVendorCode || '30000111',
      vendorName: vendorProfile.companyName || vendorUser.companyName || 'Vendor',
      requestedBy: vendorProfile.companyName || vendorUser.companyName || 'Vendor',
      grossAmount: Number(newInvoice.invoiceAmount) || 0,
      invoiceQuantity: Number(newInvoice.invoiceQuantity) || undefined,
      currency: newInvoice.currency || 'INR',
      gstAmount: Number(newInvoice.cgstAmount || 0) + Number(newInvoice.sgstAmount || 0) + Number(newInvoice.igstAmount || 0),
      tdsPercentage: Number.parseFloat(newInvoice.tdsPercentage) || 0,
      tdsAmount: (Number(newInvoice.invoiceAmount) || 0) * (Number.parseFloat(newInvoice.tdsPercentage) || 0) / 100,
      advanceAdjusted: Number(newInvoice.advanceAdjust || 0),
      remarks: newInvoice.remarks
    };

    const res = await apiFetch('/api/p2p/invoices/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to submit invoice.');
    }
    const backendInvoiceId = json.data?.invoicePaymentId || json.data?.invoiceNumber;

    const invoiceRecord = {
      id: backendInvoiceId || `INV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: 'Pending',
      ...newInvoice,
      asnNumber: json.data?.asnNumber || newInvoice.asnNumber
    };

    setInvoices((prev) => {
      const updated = [invoiceRecord, ...prev];
      localStorage.setItem('rayzon_vendor_invoices', JSON.stringify(updated));
      return updated;
    });
    setPurchaseOrders((prev) => {
      const updated = prev.map((po) => po.id === newInvoice.poNumber ? {
        ...po,
        remainingInvoiceAmount: Math.max(0, Number(po.remainingInvoiceAmount) - Number(newInvoice.invoiceAmount)),
        remainingQuantity: Math.max(0, Number(po.remainingQuantity) - (Number(newInvoice.invoiceQuantity) || 0))
      } : po);
      localStorage.setItem('rayzon_vendor_pos', JSON.stringify(updated));
      return updated;
    });
    return invoiceRecord;
  };

  const addAdvanceRequest = async (newAdvance) => {
    const res = await apiFetch('/api/p2p/advances/create', {
      method: 'POST',
      body: JSON.stringify({
        poNumber: newAdvance.poNumber,
        vendorName: vendorProfile.companyName || vendorUser?.companyName || 'Vendor',
        vendorCode: vendorProfile.sapVendorCode || vendorUser?.sapVendorCode,
        amount: Number(newAdvance.amount),
        currency: newAdvance.currency || 'INR',
        remarks: newAdvance.reason || '',
        requestedBy: vendorProfile.companyName || vendorUser?.companyName || 'Vendor'
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to submit advance payment request.');
    }

    const advanceRecord = {
      id: json.data?.advanceId || `ADV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: formatStatus(json.data?.status),
      ...newAdvance,
      amount: Number(newAdvance.amount)
    };
    setAdvances((prev) => {
      const updated = [advanceRecord, ...prev];
      localStorage.setItem('rayzon_vendor_advances', JSON.stringify(updated));
      return updated;
    });
    setPurchaseOrders((prev) => {
      const updated = prev.map((po) => po.id === newAdvance.poNumber ? {
        ...po,
        remainingAdvanceAmount: Math.max(0, Number(po.remainingAdvanceAmount) - Number(newAdvance.amount))
      } : po);
      localStorage.setItem('rayzon_vendor_pos', JSON.stringify(updated));
      return updated;
    });
    return advanceRecord;
  };

  const updateProfile = async (updatedFields) => {
    const vId = vendorProfile.sapVendorCode || vendorProfile.id;
    if (!vId) throw new Error('Vendor account identifier is missing.');
    const res = await apiFetch(`/api/vendors/${vId}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to update vendor profile.');
    }

    const updated = { ...vendorProfile, ...updatedFields, ...(json.vendor || {}) };
    setVendorProfile(updated);
    if (vendorUser) setVendorUser((prev) => ({ ...prev, ...updatedFields }));
    localStorage.setItem('rayzon_vendor_profile', JSON.stringify(updated));
    return updated;
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

  const updateInvoice = async (invoiceId, updatedInvoice) => {
    const targetId = invoiceId || updatedInvoice.id || updatedInvoice.invoicePaymentId || updatedInvoice.invoiceNumber;
    const payload = {
      poNumber: updatedInvoice.poNumber,
      invoiceNumber: updatedInvoice.invoiceNumber,
      asnNumber: updatedInvoice.asnNumber || '',
      invoiceDate: updatedInvoice.invoiceDate,
      paymentDueDate: updatedInvoice.paymentDueDate,
      grossAmount: Number(updatedInvoice.invoiceAmount) || Number(updatedInvoice.grossAmount) || 0,
      invoiceQuantity: Number(updatedInvoice.invoiceQuantity) || undefined,
      currency: updatedInvoice.currency || 'INR',
      invoiceType: updatedInvoice.invoiceType || 'With GST',
      gstSubtype: updatedInvoice.gstSubtype || 'intra',
      cgstAmount: Number(updatedInvoice.cgstAmount || 0),
      sgstAmount: Number(updatedInvoice.sgstAmount || 0),
      igstAmount: Number(updatedInvoice.igstAmount || 0),
      gstAmount: Number(updatedInvoice.cgstAmount || 0) + Number(updatedInvoice.sgstAmount || 0) + Number(updatedInvoice.igstAmount || 0),
      tdsPercentage: Number.parseFloat(updatedInvoice.tdsPercentage) || 0,
      tdsAmount: (Number(updatedInvoice.invoiceAmount) || 0) * (Number.parseFloat(updatedInvoice.tdsPercentage) || 0) / 100,
      advanceAdjusted: Number(updatedInvoice.advanceAdjust || updatedInvoice.advanceAdjusted || 0),
      remarks: updatedInvoice.remarks,
      supportingDocuments: updatedInvoice.supportingDocuments
    };

    const res = await apiFetch(`/api/p2p/invoices/${encodeURIComponent(targetId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to update invoice.');
    }

    await fetchPortalData(vendorProfile.sapVendorCode || vendorUser?.sapVendorCode, vendorProfile.email || vendorUser?.email);
    return json.data;
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
        updateInvoice,
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
