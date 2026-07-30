import { Router } from 'express';
import {
  getExchangeRates,
  saveAllRates,
  addCurrency,
  deleteCurrency
} from './exchangeRates.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(getExchangeRates));
router.put('/', authenticateToken, authorizePermission('exchangeRates', 'update'), asyncHandler(saveAllRates));
router.post('/', authenticateToken, authorizePermission('exchangeRates', 'create'), asyncHandler(addCurrency));
router.delete('/:currency', authenticateToken, authorizePermission('exchangeRates', 'delete'), asyncHandler(deleteCurrency));

export default router;
