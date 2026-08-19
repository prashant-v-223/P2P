import { Router } from 'express';
import { 
  getVendors, 
  getVendorById, 
  createVendor, 
  updateVendor, 
  deleteVendor, 
  generateVendorPassword,
  vendorLogin,
  getVendorPortalData,
  vendorChangePassword
} from './vendors.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';

const router = Router();

// Vendor authentication & portal data
router.post('/login', vendorLogin);
router.post('/change-password', vendorChangePassword);
router.get('/portal-data', authenticateToken, getVendorPortalData);
router.get('/my-invoices', authenticateToken, getVendorPortalData);

// Vendor management endpoints
router.get('/', authenticateToken, authorizePermission('vendors', 'view'), getVendors);
router.get('/:id', authenticateToken, authorizePermission('vendors', 'view'), getVendorById);
router.post('/', authenticateToken, authorizePermission('vendors', 'manage'), createVendor);
router.put('/:id', authenticateToken, authorizePermission('vendors', 'manage'), updateVendor);
router.delete('/:id', authenticateToken, authorizePermission('vendors', 'manage'), deleteVendor);
router.post('/:id/generate-password', authenticateToken, authorizePermission('vendors', 'manage'), generateVendorPassword);

export default router;
