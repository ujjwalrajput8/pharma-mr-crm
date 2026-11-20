import { Router } from 'express';
import { MslRequestController } from '../controllers/MslRequestController';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/** The MR's "Approval" menu: status of their tour plans, expenses, leave and MSL requests. */
const router = Router();
const controller = MslRequestController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR), requirePermission('approvals:own'));
router.get('/', asyncHandler(controller.myApprovals));

export default router;
