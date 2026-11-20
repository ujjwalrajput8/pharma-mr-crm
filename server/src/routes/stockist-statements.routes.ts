import { Router } from 'express';
import { StockistStatementController } from '../controllers/StockistStatementController';
import {
  getStatementQuerySchema,
  saveStatementSchema,
  statementOverviewQuerySchema,
  statementSummaryQuerySchema,
} from '../dto/stockist-statement.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/** Stockist statements: MRs enter theirs (stockist-statement:own); Managers / Admin see and correct (…:manage). */
const router = Router();
const controller = StockistStatementController.getInstance();

router.use(
  authenticate,
  authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR),
  requirePermission('stockist-statement:own', 'stockist-statement:manage'),
);

router.get('/stockists', asyncHandler(controller.stockists));
router.get('/overview', validateRequest(statementOverviewQuerySchema, 'query'), asyncHandler(controller.overview));
router.get('/summary', validateRequest(statementSummaryQuerySchema, 'query'), asyncHandler(controller.summary));
router.get('/', validateRequest(getStatementQuerySchema, 'query'), asyncHandler(controller.get));
router.put('/', validateRequest(saveStatementSchema), asyncHandler(controller.save));

export default router;
