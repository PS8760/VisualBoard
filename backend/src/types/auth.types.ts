import type { z } from 'zod';
import { registerSchema, loginSchema, oauthExchangeSchema } from '../modules/auth/auth.validation.js';

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OAuthExchangeInput = z.infer<typeof oauthExchangeSchema>;

export type OAuthProvider = 'github' | 'google';
