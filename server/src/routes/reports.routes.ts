import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { reportQuerySchema } from '../dto/report.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = ReportController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

router.get(
  '/',
  requirePermission('reports:all', 'reports:own'),
  validateRequest(reportQuerySchema, 'query'),
  asyncHandler(controller.get),
);

export default router;
