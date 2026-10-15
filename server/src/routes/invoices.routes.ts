import { Router } from 'express';
import { InvoiceController } from '../controllers/InvoiceController';
import {
  createInvoiceSchema,
  invoiceSummaryQuerySchema,
  listInvoicesQuerySchema,
  recordPaymentSchema,
} from '../dto/invoice.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = InvoiceController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

const canUseInvoices = requirePermission('sales:manage', 'sales:own');
const canManageSales = requirePermission('sales:manage');

/** Doctor / store / MR wise billing summary — before /:id so "summary" is not read as an id. */
router.get(
  '/summary',
  canUseInvoices,
  validateRequest(invoiceSummaryQuerySchema, 'query'),
  asyncHandler(controller.summary),
);

router.get(
  '/',
  canUseInvoices,
  validateRequest(listInvoicesQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.post(
  '/',
  canUseInvoices,
  validateRequest(createInvoiceSchema),
  asyncHandler(controller.create),
);
router.get('/:id', canUseInvoices, asyncHandler(controller.getById));
router.post(
  '/:id/payments',
  canUseInvoices,
  validateRequest(recordPaymentSchema),
  asyncHandler(controller.addPayment),
);
router.delete('/:id/payments/:paymentId', canManageSales, asyncHandler(controller.removePayment));
router.post('/:id/cancel', canManageSales, asyncHandler(controller.cancel));

export default router;
