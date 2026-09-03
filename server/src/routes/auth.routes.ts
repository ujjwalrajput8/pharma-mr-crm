import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { changePasswordSchema, loginSchema, refreshTokenSchema } from '../dto/auth.dto';
import { authenticate } from '../middlewares/authenticate.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Auth routes — public login/refresh/logout + protected /me
 */
const router = Router();
const controller = AuthController.getInstance();

router.post('/login', validateRequest(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validateRequest(refreshTokenSchema), asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', authenticate, asyncHandler(controller.me));
router.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  asyncHandler(controller.changePassword),
);

export default router;
