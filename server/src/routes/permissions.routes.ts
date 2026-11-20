import { Router } from 'express';
import { PermissionController } from '../controllers/PermissionController';
import { setManagerPermissionsSchema, setMrAccessSchema } from '../dto/permission.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Admin-managed access: per-Manager permissions and the MR menu switches (all MRs).
 */
const router = Router();
const controller = PermissionController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN));

router.get('/catalog', asyncHandler(controller.catalog));
router.get('/managers', asyncHandler(controller.listManagers));
router.get('/managers/:userId', asyncHandler(controller.getManager));
router.put(
  '/managers/:userId',
  validateRequest(setManagerPermissionsSchema),
  asyncHandler(controller.setManager),
);
router.post('/managers/:userId/reset', asyncHandler(controller.resetManager));
router.get('/mr', asyncHandler(controller.getMrAccess));
router.put('/mr', validateRequest(setMrAccessSchema), asyncHandler(controller.setMrAccess));
router.post('/mr/reset', asyncHandler(controller.resetMrAccess));

export default router;
