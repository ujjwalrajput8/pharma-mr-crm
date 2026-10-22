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

/** Birthdays / anniversaries window — 7 for the dashboard card, up to a year for the full list. */
const occasionsQuerySchema = z.object({
  days: z.coerce.number().int().min(0).max(366).default(7),
  type: z.enum(['DOCTOR', 'EMPLOYEE']).optional(),
});

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));
router.get('/summary', asyncHandler(controller.summary));
router.get('/trends', validateRequest(trendsQuerySchema, 'query'), asyncHandler(controller.trends));
router.get(
  '/occasions',
  validateRequest(occasionsQuerySchema, 'query'),
  asyncHandler(controller.occasions),
);

export default router;
