import { Router } from 'express';
import { StoreController } from '../controllers/StoreController';
import { createStoreSchema, listStoresQuerySchema, updateStoreSchema } from '../dto/store.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = StoreController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN));

router.get('/', validateRequest(listStoresQuerySchema, 'query'), asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', validateRequest(createStoreSchema), asyncHandler(controller.create));
router.patch('/:id', validateRequest(updateStoreSchema), asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
