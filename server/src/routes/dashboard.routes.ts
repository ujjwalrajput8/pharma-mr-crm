import { Router } from 'express';
import { z } from 'zod';
import { DashboardController } from '../controllers/DashboardController';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = DashboardController.getInstance();

/** Chart range in days — clamped so one query can never scan years of rows. */
const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
});

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));
router.get('/summary', asyncHandler(controller.summary));
router.get('/trends', validateRequest(trendsQuerySchema, 'query'), asyncHandler(controller.trends));

export default router;
