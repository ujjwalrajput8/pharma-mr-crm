import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import {
  createMrSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  updateMrSchema,
} from '../dto/user.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Users management (MR + Manager accounts) — Admin only.
 */
const router = Router();
const controller = UserController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN));

router.get('/', validateRequest(listUsersQuerySchema, 'query'), asyncHandler(controller.list));
// Before /:id so "manager-options" is not parsed as an id.
router.get('/manager-options', asyncHandler(controller.managerOptions));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', validateRequest(createMrSchema), asyncHandler(controller.create));
router.patch('/:id', validateRequest(updateMrSchema), asyncHandler(controller.update));
router.post('/:id/activate', asyncHandler(controller.activate));
router.post('/:id/deactivate', asyncHandler(controller.deactivate));
router.post(
  '/:id/reset-password',
  validateRequest(resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);
router.delete('/:id', asyncHandler(controller.remove));

export default router;
