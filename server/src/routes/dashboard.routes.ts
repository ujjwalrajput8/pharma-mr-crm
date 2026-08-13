import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = DashboardController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));
router.get('/summary', asyncHandler(controller.summary));

export default router;
