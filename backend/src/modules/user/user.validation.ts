import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    avatar: z.string().url().max(500).optional().nullable(),
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(72),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72)
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const userSearchSchema = z.object({
  email: z.string().trim().min(3, 'Enter at least 3 characters').max(255),
});

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const AVATAR_MIME_ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export default { updateProfileSchema, changePasswordSchema, userSearchSchema, MAX_AVATAR_BYTES, AVATAR_MIME_ALLOWED };