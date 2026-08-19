import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: z.string().trim().toLowerCase().email('A valid email is required').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password is too long')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required').max(255),
  password: z.string().min(1, 'Password is required').max(72),
});

/** Body for the GitHub/Google server-side exchange endpoints. */
export const oauthExchangeSchema = z.object({
  provider: z.enum(['github', 'google']),
  code: z.string().min(1, 'Authorization code is required'),
  redirect_uri: z.string().url().optional(),
});

export default { registerSchema, loginSchema, oauthExchangeSchema };
