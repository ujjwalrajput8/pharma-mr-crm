import { Router } from 'express';
import { TourPlanController } from '../controllers/TourPlanController';
import {
  decideTourPlanSchema,
  listTourPlansQuerySchema,
  tourPlanMonthQuerySchema,
  upsertMyTourPlanSchema,
} from '../dto/tour-plan.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = TourPlanController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

/** ── Own plan — static paths before /:id ──────────────────────────────────── */
router.get(
  '/my',
  requirePermission('tour-plan:own'),
  validateRequest(tourPlanMonthQuerySchema, 'query'),
  asyncHandler(controller.my),
);
router.put(
  '/my',
  requirePermission('tour-plan:own'),
  validateRequest(tourPlanMonthQuerySchema, 'query'),
  validateRequest(upsertMyTourPlanSchema),
  asyncHandler(controller.saveMy),
);
router.post(
  '/my/submit',
  requirePermission('tour-plan:own'),
  validateRequest(tourPlanMonthQuerySchema, 'query'),
  asyncHandler(controller.submitMy),
);

/** Today's approved plan day — consumed by My Day. */
router.get(
  '/today',
  requirePermission('tour-plan:own', 'myday:own'),
  asyncHandler(controller.today),
);

/** ── Manager: team list, detail, decision ─────────────────────────────────── */
router.get(
  '/',
  requirePermission('tour-plan:manage'),
  validateRequest(listTourPlansQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.get('/:id', requirePermission('tour-plan:manage'), asyncHandler(controller.getById));
router.post(
  '/:id/decide',
  requirePermission('tour-plan:manage'),
  validateRequest(decideTourPlanSchema),
  asyncHandler(controller.decide),
);

export default router;
