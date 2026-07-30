const trimTrailingSlash = (value = '') => value.trim().replace(/\/+$/, '');

export const sapConfig = {
  baseUrl: trimTrailingSlash(process.env.SAP_BASE_URL || 'https://my420266-api.s4hana.cloud.sap'),
  username: process.env.SAP_USERNAME?.trim() || '',
  password: process.env.SAP_PASSWORD || '',
  timeoutMs: Math.max(5000, Number(process.env.SAP_TIMEOUT_MS) || 30000),
  maxPages: Math.max(1, Number(process.env.SAP_MAX_PAGES) || 500),
  endpoints: {
    suppliers: '/sap/opu/odata/sap/YY1_SUPPLIERMASTERAPIFINAL_CDS/YY1_SupplierMasterAPIFinal',
    purchaseOrders: '/sap/opu/odata/sap/YY1_PURCHASEORDERFORADVFIN_CDS/YY1_PurchaseOrderforAdvFin',
    houseBanks: '/sap/opu/odata/sap/YY1_HOUSEBANKAPIFINAL2_CDS/YY1_HouseBankAPIFinal2',
    supplierInvoices: '/sap/opu/odata/sap/YY1_SUPPLIERINVOICEAPIV1_CDS/YY1_SupplierInvoiceAPIV1'
  }
};

export const publicSapConfig = () => ({
  baseUrl: sapConfig.baseUrl.replace(/^https?:\/\//, ''),
  configured: Boolean(sapConfig.username && sapConfig.password),
  endpoints: Object.entries(sapConfig.endpoints).map(([key, path]) => ({ key, method: 'GET', path }))
});
