import React, { createContext, useContext, useState, useEffect } from 'react';

const VendorContext = createContext();

const initialVendorProfile = {
  sapVendorCode: '20000201',
  companyName: 'Jinko Solar (Vietnam) Industries Co',
  contactPerson: 'Kai',
  email: 'kaiming.sun@jinkosolar.com',
  phone: '+86 13019807370',
  vendorType: 'Domestic Vendor',
  status: 'Active',
  gstin: '-',
  pan: '-',
  bankName: 'JOINT STOCK COMMERCIAL BANK FOR FOREIGN TRADE OF VIETNAM',
  branch: 'QUANG NINH BRANCH',
  accountNumber: '**** 8888',
  ifscCode: 'BFTVWW014'
};

const initialPurchaseOrders = [
  { id: '4300001510', date: '27 Jul 2026', amount: 'USD 27,44,883', status: 'Open', currency: 'USD', numericAmount: 2744883 },
  { id: '4300001511', date: '27 Jul 2026', amount: 'USD 27,44,993', status: 'Open', currency: 'USD', numericAmount: 2744993 },
  { id: '4800000073', date: '20 Nov 2025', amount: 'USD 0', status: 'Open', currency: 'USD', numericAmount: 0 },
  { id: '4300000271', date: '19 May 2023', amount: 'USD 1,350', status: 'Open', currency: 'USD', numericAmount: 1350 }
];

export const VendorProvider = ({ children }) => {
  const [vendorUser, setVendorUser] = useState(() => {
    const saved = localStorage.getItem('rayzon_vendor_user');
    return saved ? JSON.parse(saved) : { ...initialVendorProfile, isLoggedIn: true };
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

  useEffect(() => {
    localStorage.setItem('rayzon_vendor_user', JSON.stringify(vendorUser));
  }, [vendorUser]);

  useEffect(() => {
    localStorage.setItem('rayzon_vendor_profile', JSON.stringify(vendorProfile));
  }, [vendorProfile]);

  useEffect(() => {
    localStorage.setItem('rayzon_vendor_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('rayzon_vendor_advances', JSON.stringify(advances));
  }, [advances]);

  const loginVendor = (email, password) => {
    const user = {
      ...vendorProfile,
      email: email || vendorProfile.email,
      isLoggedIn: true,
      loginTime: new Date().toISOString()
    };
    setVendorUser(user);
    localStorage.setItem('rayzon_vendor_token', 'vendor-auth-token-20000201');
    return user;
  };

  const logoutVendor = () => {
    setVendorUser(null);
    localStorage.removeItem('rayzon_vendor_user');
    localStorage.removeItem('rayzon_vendor_token');
  };

  const addInvoice = (newInvoice) => {
    const invoiceRecord = {
      id: `INV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: 'Pending',
      ...newInvoice
    };
    setInvoices((prev) => [invoiceRecord, ...prev]);
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

  const updateProfile = (updatedFields) => {
    const updated = { ...vendorProfile, ...updatedFields };
    setVendorProfile(updated);
    if (vendorUser) {
      setVendorUser((prev) => ({ ...prev, ...updatedFields }));
    }
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
        updateProfile
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
