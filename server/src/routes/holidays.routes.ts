import { Router } from 'express';
import { HolidayController } from '../controllers/HolidayController';
import {
  createHolidaySchema,
  listHolidaysQuerySchema,
  updateHolidaySchema,
} from '../dto/holiday.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = HolidayController.getInstance();

// Everyone reads the calendar (it drives leave day-count and the attendance grid);
// only holidays:manage holders maintain it.
router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

router.get('/', validateRequest(listHolidaysQuerySchema, 'query'), asyncHandler(controller.list));
router.post(
  '/',
  requirePermission('holidays:manage'),
  validateRequest(createHolidaySchema),
  asyncHandler(controller.create),
);
router.patch(
  '/:id',
  requirePermission('holidays:manage'),
  validateRequest(updateHolidaySchema),
  asyncHandler(controller.update),
);
router.delete('/:id', requirePermission('holidays:manage'), asyncHandler(controller.remove));

export default router;
