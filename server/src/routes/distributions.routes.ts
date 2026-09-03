import { Router } from 'express';
import { DistributionController } from '../controllers/DistributionController';
import { listDistributionsQuerySchema } from '../dto/distribution.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = DistributionController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

router.get(
  '/',
  requirePermission('distributions:manage', 'distributions:own'),
  validateRequest(listDistributionsQuerySchema, 'query'),
  asyncHandler(controller.list),
);

export default router;
