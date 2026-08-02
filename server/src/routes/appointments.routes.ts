import { Router } from 'express';
import { AppointmentController } from '../controllers/AppointmentController';
import {
  completeAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
} from '../dto/appointment.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = AppointmentController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MR));

router.get(
  '/',
  validateRequest(listAppointmentsQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.post('/', validateRequest(createAppointmentSchema), asyncHandler(controller.create));
router.patch('/:id', validateRequest(updateAppointmentSchema), asyncHandler(controller.update));
router.post(
  '/:id/complete',
  validateRequest(completeAppointmentSchema),
  asyncHandler(controller.complete),
);
router.delete('/:id', authorize(AppRoles.ADMIN), asyncHandler(controller.remove));

export default router;
