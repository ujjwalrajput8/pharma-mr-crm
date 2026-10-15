import { Router } from 'express';
import { ExpenseController } from '../controllers/ExpenseController';
import {
  createExpenseSchema,
  decideExpenseSchema,
  expenseSummaryQuerySchema,
  listExpensesQuerySchema,
  updateExpenseSchema,
} from '../dto/expense.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Expenses (TA/DA).
 * Mount as: ['expenses', expensesRoutes] in api/router.ts.
 */
const router = Router();
const controller = ExpenseController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

const canUseExpenses = requirePermission('expenses:own', 'expenses:manage');

router.get(
  '/',
  canUseExpenses,
  validateRequest(listExpensesQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.get(
  '/summary',
  canUseExpenses,
  validateRequest(expenseSummaryQuerySchema, 'query'),
  asyncHandler(controller.summary),
);
router.post(
  '/',
  requirePermission('expenses:own'),
  validateRequest(createExpenseSchema),
  asyncHandler(controller.create),
);
router.patch(
  '/:id',
  requirePermission('expenses:own'),
  validateRequest(updateExpenseSchema),
  asyncHandler(controller.update),
);
router.delete('/:id', requirePermission('expenses:own'), asyncHandler(controller.remove));
router.post(
  '/:id/decide',
  requirePermission('expenses:manage'),
  validateRequest(decideExpenseSchema),
  asyncHandler(controller.decide),
);
// ADMIN-only settlement — the service enforces the role.
router.post('/:id/mark-paid', asyncHandler(controller.markPaid));

export default router;
