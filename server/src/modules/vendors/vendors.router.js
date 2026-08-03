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
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// Vendor authentication & portal data
router.post('/login', vendorLogin);
router.post('/change-password', vendorChangePassword);
router.get('/portal-data', authenticateToken, getVendorPortalData);

// Vendor management endpoints
router.get('/', getVendors);
router.get('/:id', getVendorById);
router.post('/', authenticateToken, createVendor);
router.put('/:id', authenticateToken, updateVendor);
router.delete('/:id', optionalAuth, deleteVendor);
router.post('/:id/generate-password', optionalAuth, generateVendorPassword);

export default router;
