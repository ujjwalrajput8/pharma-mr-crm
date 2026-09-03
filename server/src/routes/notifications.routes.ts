import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = NotificationController.getInstance();

// Every role has a bell; the service decides what each one is allowed to see.
router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

router.get('/', asyncHandler(controller.list));

export default router;
