import { Router } from 'express';
import { MslRequestController } from '../controllers/MslRequestController';
import { createMslRequestSchema, decideMslRequestSchema, listMslRequestsQuerySchema } from '../dto/msl.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/** MSL add / remove requests: MRs ask (msl-requests:own), Managers / Admin decide (msl-requests:manage). */
const router = Router();
const controller = MslRequestController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

router.get(
  '/',
  requirePermission('msl-requests:own', 'msl-requests:manage'),
  validateRequest(listMslRequestsQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.post('/', requirePermission('msl-requests:own'), validateRequest(createMslRequestSchema), asyncHandler(controller.create));
router.post('/:id/cancel', requirePermission('msl-requests:own'), asyncHandler(controller.cancel));
router.post('/:id/decide', requirePermission('msl-requests:manage'), validateRequest(decideMslRequestSchema), asyncHandler(controller.decide));

export default router;
