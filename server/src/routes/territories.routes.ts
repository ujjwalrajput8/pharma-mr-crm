import { Router } from 'express';
import { TerritoryController } from '../controllers/TerritoryController';
import {
  createTerritorySchema,
  listTerritoriesQuerySchema,
  updateTerritorySchema,
} from '../dto/territory.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = TerritoryController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

/**
 * Reads stay open to every authenticated field role — an MR picks beats for
 * the tour plan; only writes need `territories:manage`.
 */
router.get(
  '/',
  validateRequest(listTerritoriesQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.get('/tree', asyncHandler(controller.tree));

router.post(
  '/',
  requirePermission('territories:manage'),
  validateRequest(createTerritorySchema),
  asyncHandler(controller.create),
);
router.patch(
  '/:id',
  requirePermission('territories:manage'),
  validateRequest(updateTerritorySchema),
  asyncHandler(controller.update),
);
router.delete('/:id', requirePermission('territories:manage'), asyncHandler(controller.remove));

export default router;
