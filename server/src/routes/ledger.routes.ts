import { Router } from 'express';
import { LedgerController } from '../controllers/LedgerController';
import {
  ledgerStatementQuerySchema,
  listLedgerReceiptsQuerySchema,
  listLedgerTxnsQuerySchema,
} from '../dto/ledger.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = LedgerController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER));

const canViewLedger = requirePermission('ledger:view', 'stock:manage');

router.get(
  '/txns',
  canViewLedger,
  validateRequest(listLedgerTxnsQuerySchema, 'query'),
  asyncHandler(controller.listTxns),
);
router.get(
  '/receipts',
  canViewLedger,
  validateRequest(listLedgerReceiptsQuerySchema, 'query'),
  asyncHandler(controller.listReceipts),
);
router.get('/receipts/:id', canViewLedger, asyncHandler(controller.getReceipt));
router.get(
  '/statement',
  canViewLedger,
  validateRequest(ledgerStatementQuerySchema, 'query'),
  asyncHandler(controller.statement),
);

export default router;
