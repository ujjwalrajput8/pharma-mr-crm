import { Router } from 'express';
import { SettingController } from '../controllers/SettingController';
import { listSettingsQuerySchema, upsertSettingSchema } from '../dto/setting.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = SettingController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN));

router.get('/', validateRequest(listSettingsQuerySchema, 'query'), asyncHandler(controller.list));
router.put('/', validateRequest(upsertSettingSchema), asyncHandler(controller.upsert));

export default router;
