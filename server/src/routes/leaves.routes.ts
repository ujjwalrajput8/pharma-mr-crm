import { Router } from 'express';
import { LeaveController } from '../controllers/LeaveController';
import {
  applyLeaveSchema,
  cancelLeaveSchema,
  decideLeaveSchema,
  leaveBalanceQuerySchema,
  listLeavesQuerySchema,
  setLeaveBalanceSchema,
  updateLeaveTypeSchema,
  upsertLeaveTypeSchema,
} from '../dto/leave.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = LeaveController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

const canUseLeave = requirePermission('leaves:own', 'leaves:manage');

/** ── Policy master (leave types) — before /:id so "types" is not read as an id ── */
router.get('/types', canUseLeave, asyncHandler(controller.listTypes));
router.post(
  '/types',
  requirePermission('leave-types:manage'),
  validateRequest(upsertLeaveTypeSchema),
  asyncHandler(controller.createType),
);
router.patch(
  '/types/:id',
  requirePermission('leave-types:manage'),
  validateRequest(updateLeaveTypeSchema),
  asyncHandler(controller.updateType),
);
router.delete(
  '/types/:id',
  requirePermission('leave-types:manage'),
  asyncHandler(controller.removeType),
);

/** ── Balances ─────────────────────────────────────────────────────────────── */
router.get(
  '/balances',
  canUseLeave,
  validateRequest(leaveBalanceQuerySchema, 'query'),
  asyncHandler(controller.balances),
);
router.post(
  '/balances',
  requirePermission('leave-types:manage'),
  validateRequest(setLeaveBalanceSchema),
  asyncHandler(controller.setBalance),
);

router.get('/pending-count', requirePermission('leaves:manage'), asyncHandler(controller.pendingCount));

/** ── Requests ─────────────────────────────────────────────────────────────── */
router.get(
  '/',
  canUseLeave,
  validateRequest(listLeavesQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.post('/', canUseLeave, validateRequest(applyLeaveSchema), asyncHandler(controller.apply));
router.get('/:id', canUseLeave, asyncHandler(controller.getById));
router.post(
  '/:id/decision',
  requirePermission('leaves:manage'),
  validateRequest(decideLeaveSchema),
  asyncHandler(controller.decide),
);
router.post(
  '/:id/cancel',
  canUseLeave,
  validateRequest(cancelLeaveSchema),
  asyncHandler(controller.cancel),
);

export default router;
