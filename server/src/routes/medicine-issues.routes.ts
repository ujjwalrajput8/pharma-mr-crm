import { Router } from 'express';
import { MedicineIssueController } from '../controllers/MedicineIssueController';
import {
  createMedicineIssueSchema,
  listMedicineIssuesQuerySchema,
} from '../dto/medicine-issue.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = MedicineIssueController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MR));
router.get(
  '/',
  validateRequest(listMedicineIssuesQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.post(
  '/',
  authorize(AppRoles.ADMIN),
  validateRequest(createMedicineIssueSchema),
  asyncHandler(controller.create),
);

export default router;
