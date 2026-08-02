import { Router } from 'express';
import { DistributionController } from '../controllers/DistributionController';
import { listDistributionsQuerySchema } from '../dto/distribution.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = DistributionController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MR));
router.get(
  '/',
  validateRequest(listDistributionsQuerySchema, 'query'),
  asyncHandler(controller.list),
);

export default router;
