import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { reportQuerySchema } from '../dto/report.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = ReportController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MR));
router.get('/', validateRequest(reportQuerySchema, 'query'), asyncHandler(controller.get));

export default router;
