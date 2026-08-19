import { Response, NextFunction } from 'express';
import { registerUser, loginUser, exchangeGithubCode, exchangeGoogleCode } from './auth.service.js';
import { registerSchema, loginSchema, oauthExchangeSchema } from './auth.validation.js';
import { validationError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import type { Request } from 'express';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw validationError(parsed.error.issues);
    const result = await registerUser(parsed.data.name, parsed.data.email, parsed.data.password);
    sendSuccess(res, result, 201);
  } catch (e) {
    next(e);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw validationError(parsed.error.issues);
    const result = await loginUser(parsed.data.email, parsed.data.password);
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};

export const githubExchange = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = oauthExchangeSchema
      .pick({ code: true, redirect_uri: true })
      .extend({ provider: req.body?.provider })
      .safeParse({ code: req.body?.code, redirect_uri: req.body?.redirect_uri });
    if (!parsed.success) throw validationError(parsed.error.issues);
    const result = await exchangeGithubCode(parsed.data.code, parsed.data.redirect_uri);
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};

export const googleExchange = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = oauthExchangeSchema
      .pick({ code: true, redirect_uri: true })
      .safeParse({ code: req.body?.code, redirect_uri: req.body?.redirect_uri });
    if (!parsed.success) throw validationError(parsed.error.issues);
    const result = await exchangeGoogleCode(parsed.data.code, parsed.data.redirect_uri);
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};

export default { register, login, githubExchange, googleExchange };