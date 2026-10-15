import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  resetRequestSchema,
} from '../dto/auth.dto';
import { authenticate } from '../middlewares/authenticate.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Auth routes — public login/refresh/logout + protected /me
 */
const router = Router();
const controller = AuthController.getInstance();

/**
 * Strict per-IP limiter for credential guessing. The account-level lockout
 * (5 wrong passwords → 15 min) handles a distributed attack on one account;
 * this handles one IP hammering many accounts.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this address. Try again later.',
    code: 'TOO_MANY_REQUESTS',
  },
});

router.post('/login', loginLimiter, validateRequest(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validateRequest(refreshTokenSchema), asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', authenticate, asyncHandler(controller.me));
router.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  asyncHandler(controller.changePassword),
);

/** Admin hands the generated link to the employee — there is no SMTP here. */
router.post(
  '/reset-requests',
  authenticate,
  requirePermission('users:manage'),
  validateRequest(resetRequestSchema),
  asyncHandler(controller.createResetRequest),
);
/** Public redemption of a reset link (rate-limited like login). */
router.post(
  '/reset-password',
  loginLimiter,
  validateRequest(resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);

export default router;
