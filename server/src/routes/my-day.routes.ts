import { Router } from 'express';
import { MyDayController } from '../controllers/MyDayController';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = MyDayController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

/** The MR home screen — one call composes check-in, plan, appointments, follow-ups. */
router.get('/', requirePermission('myday:own'), asyncHandler(controller.snapshot));

export default router;
