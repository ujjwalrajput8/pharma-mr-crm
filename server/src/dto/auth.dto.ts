import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

/** Self-service password change — the employee proves the current password. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128)
      .regex(/[a-z]/, 'Include at least one lowercase letter')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

/** Admin generates a hand-over reset link for one user (no SMTP configured). */
export const resetRequestSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

/** Public: redeem a reset link. */
export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/i, 'Invalid reset token'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128),
});

export type ResetRequestDto = z.infer<typeof resetRequestSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
