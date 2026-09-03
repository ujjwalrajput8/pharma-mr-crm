import { Router } from 'express';
import { StoreController } from '../controllers/StoreController';
import { createStoreSchema, listStoresQuerySchema, updateStoreSchema } from '../dto/store.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = StoreController.getInstance();

// MRs need chemist reads for POB entry and chemist calls; only stores:manage holders write.
router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

const canRead = requirePermission('stores:manage', 'sales:manage', 'sales:own', 'visits:own');

router.get(
  '/',
  canRead,
  validateRequest(listStoresQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.get('/:id', canRead, asyncHandler(controller.getById));
router.post(
  '/',
  requirePermission('stores:manage'),
  validateRequest(createStoreSchema),
  asyncHandler(controller.create),
);
router.patch(
  '/:id',
  requirePermission('stores:manage'),
  validateRequest(updateStoreSchema),
  asyncHandler(controller.update),
);
router.delete('/:id', requirePermission('stores:manage'), asyncHandler(controller.remove));

export default router;
