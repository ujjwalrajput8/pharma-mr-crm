import { Router } from 'express';
import { SaleController } from '../controllers/SaleController';
import { createSaleSchema, listSalesQuerySchema } from '../dto/sale.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = SaleController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

const canUseSales = requirePermission('sales:manage', 'sales:own');

router.get(
  '/',
  canUseSales,
  validateRequest(listSalesQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.post('/', canUseSales, validateRequest(createSaleSchema), asyncHandler(controller.create));

export default router;
