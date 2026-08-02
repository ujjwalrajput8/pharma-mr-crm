import { Router } from 'express';
import { AuditController } from '../controllers/AuditController';
import { listAuditLogsQuerySchema } from '../dto/audit.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = AuditController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN));

router.get('/', validateRequest(listAuditLogsQuerySchema, 'query'), asyncHandler(controller.list));

export default router;
