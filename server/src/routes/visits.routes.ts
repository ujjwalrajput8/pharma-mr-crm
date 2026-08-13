import { Router } from 'express';
import { VisitController } from '../controllers/VisitController';
import { listVisitsQuerySchema } from '../dto/visit.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = VisitController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

router.get('/', validateRequest(listVisitsQuerySchema, 'query'), asyncHandler(controller.list));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
