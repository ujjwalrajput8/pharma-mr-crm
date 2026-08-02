import { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController';
import { checkInSchema, checkOutSchema, listAttendanceQuerySchema } from '../dto/attendance.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = AttendanceController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MR));
router.get('/', validateRequest(listAttendanceQuerySchema, 'query'), asyncHandler(controller.list));
router.get('/today', asyncHandler(controller.today));
router.post('/check-in', validateRequest(checkInSchema), asyncHandler(controller.checkIn));
router.post('/check-out', validateRequest(checkOutSchema), asyncHandler(controller.checkOut));

export default router;
