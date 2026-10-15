import { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController';
import {
  attendanceCalendarQuerySchema,
  attendanceSummaryQuerySchema,
  checkInSchema,
  checkOutSchema,
  createRegularizationSchema,
  decideRegularizationSchema,
  listAttendanceQuerySchema,
  listRegularizationsQuerySchema,
  manageAttendanceSchema,
  reviewFlagSchema,
} from '../dto/attendance.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = AttendanceController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

const canUseAttendance = requirePermission('attendance:own', 'attendance:manage');

router.get(
  '/',
  canUseAttendance,
  validateRequest(listAttendanceQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.get('/today', canUseAttendance, asyncHandler(controller.today));
router.get(
  '/calendar',
  canUseAttendance,
  validateRequest(attendanceCalendarQuerySchema, 'query'),
  asyncHandler(controller.calendar),
);
router.get(
  '/summary',
  canUseAttendance,
  validateRequest(attendanceSummaryQuerySchema, 'query'),
  asyncHandler(controller.summary),
);
router.get(
  '/field-users',
  requirePermission('attendance:manage'),
  asyncHandler(controller.fieldUsers),
);
router.post(
  '/check-in',
  requirePermission('attendance:own'),
  validateRequest(checkInSchema),
  asyncHandler(controller.checkIn),
);
router.post(
  '/check-out',
  requirePermission('attendance:own'),
  validateRequest(checkOutSchema),
  asyncHandler(controller.checkOut),
);
router.post(
  '/manage',
  requirePermission('attendance:manage'),
  validateRequest(manageAttendanceSchema),
  asyncHandler(controller.manage),
);
/** ── Regularization (missed check-in / check-out) ─────────────────────────── */
router.get(
  '/regularizations',
  canUseAttendance,
  validateRequest(listRegularizationsQuerySchema, 'query'),
  asyncHandler(controller.listRegularizations),
);
router.post(
  '/regularizations',
  requirePermission('attendance:own'),
  validateRequest(createRegularizationSchema),
  asyncHandler(controller.createRegularization),
);
router.post(
  '/regularizations/:id/decide',
  requirePermission('attendance:manage'),
  validateRequest(decideRegularizationSchema),
  asyncHandler(controller.decideRegularization),
);

router.post(
  '/:id/review-flag',
  requirePermission('attendance:manage'),
  validateRequest(reviewFlagSchema),
  asyncHandler(controller.reviewFlag),
);

export default router;
