import { Router } from 'express';
import { StockController } from '../controllers/StockController';
import { adjustStockSchema, listStockQuerySchema } from '../dto/stock.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = StockController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN));

router.get('/', validateRequest(listStockQuerySchema, 'query'), asyncHandler(controller.list));
router.post(
  '/adjust',
  validateRequest(adjustStockSchema),
  asyncHandler(controller.adjust),
);

export default router;
