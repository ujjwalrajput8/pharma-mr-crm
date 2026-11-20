import { Router } from 'express';
import { StoreController } from '../controllers/StoreController';
import {
  assignStoresSchema,
  createStoreSchema,
  listStoresQuerySchema,
  myStoresQuerySchema,
  updateStoreSchema,
} from '../dto/store.dto';
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

const canRead = requirePermission('stores:manage', 'sales:manage', 'sales:own', 'visits:own', 'chemist-visits:own', 'stockist-visits:own');

router.get(
  '/',
  canRead,
  validateRequest(listStoresQuerySchema, 'query'),
  asyncHandler(controller.list),
);
// The MR's own chemists / stockists (MSL List → Chemists / Stockists).
router.get('/mine', requirePermission('doctors:own'), validateRequest(myStoresQuerySchema, 'query'), asyncHandler(controller.mine));
router.post('/assign-mr', requirePermission('stores:manage'), validateRequest(assignStoresSchema), asyncHandler(controller.assignMr));
router.get('/:id/assignment-history', requirePermission('stores:manage'), asyncHandler(controller.assignmentHistory));
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
