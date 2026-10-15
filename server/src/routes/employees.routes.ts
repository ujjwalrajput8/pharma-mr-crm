import { Router } from 'express';
import { EmployeeController } from '../controllers/EmployeeController';
import {
  createEmployeeDocumentSchema,
  employeeProfileQuerySchema,
  listEmployeesQuerySchema,
  setAvatarSchema,
  updateEmployeeProfileSchema,
} from '../dto/employee.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = EmployeeController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

// Own record first — every role may read it, and "me" must not be parsed as an id.
router.get(
  '/me',
  validateRequest(employeeProfileQuerySchema, 'query'),
  asyncHandler(controller.me),
);

router.get(
  '/',
  requirePermission('employees:view'),
  validateRequest(listEmployeesQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.get(
  '/:id',
  requirePermission('employees:view'),
  validateRequest(employeeProfileQuerySchema, 'query'),
  asyncHandler(controller.profile),
);
router.patch(
  '/:id',
  requirePermission('users:manage'),
  validateRequest(updateEmployeeProfileSchema),
  asyncHandler(controller.updateProfile),
);

/** ── Documents — reads allow self, writes are admin-only ──────────────────── */
router.get(
  '/:id/documents',
  requirePermission('users:manage', 'employees:view', 'profile:own'),
  asyncHandler(controller.listDocuments),
);
router.post(
  '/:id/documents',
  requirePermission('users:manage'),
  validateRequest(createEmployeeDocumentSchema),
  asyncHandler(controller.addDocument),
);
router.delete(
  '/:id/documents/:docId',
  requirePermission('users:manage'),
  asyncHandler(controller.removeDocument),
);

/** Avatar — self or admin; the service enforces ownership. */
router.patch(
  '/:id/avatar',
  validateRequest(setAvatarSchema),
  asyncHandler(controller.setAvatar),
);

export default router;
