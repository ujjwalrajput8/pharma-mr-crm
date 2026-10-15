import { Router } from 'express';
import { StockController } from '../controllers/StockController';
import { adjustStockSchema, listStockQuerySchema } from '../dto/stock.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = StockController.getInstance();

// The signed-in user's own bag — MRs included, so it sits above the
// ADMIN/MANAGER gate that covers the warehouse routes below.
router.get(
  '/my',
  authenticate,
  authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR),
  requirePermission('mystock:own'),
  asyncHandler(controller.my),
);

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER));

router.get(
  '/',
  requirePermission('stock:manage'),
  validateRequest(listStockQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.post(
  '/adjust',
  requirePermission('stock:manage'),
  validateRequest(adjustStockSchema),
  asyncHandler(controller.adjust),
);

export default router;
