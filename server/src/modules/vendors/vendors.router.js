import { Router } from 'express';
import { 
  getVendors, 
  getVendorById, 
  createVendor, 
  updateVendor, 
  deleteVendor, 
  generateVendorPassword 
} from './vendors.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// Allow public or authenticated read, protect mutations
router.get('/', getVendors);
router.get('/:id', getVendorById);
router.post('/', authenticateToken, createVendor);
router.put('/:id', authenticateToken, updateVendor);
router.delete('/:id', authenticateToken, deleteVendor);
router.post('/:id/generate-password', authenticateToken, generateVendorPassword);

export default router;
