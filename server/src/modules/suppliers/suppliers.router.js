import { Router } from 'express';
import { getSuppliers } from './suppliers.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', getSuppliers);

export default router;
