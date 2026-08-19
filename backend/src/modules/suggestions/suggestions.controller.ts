import { Response, NextFunction } from 'express';
import { loadBoardContext, requestGroqSuggestions } from './suggestions.service.js';
import { suggestionsParamsSchema, suggestionsBodySchema } from './suggestions.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { validationError } from '../../utils/errors.js';
import { assertBoardAccess } from '../../services/rbac.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const getBoardSuggestions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const paramsResult = suggestionsParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      next(validationError(paramsResult.error.issues));
      return;
    }

    const bodyResult = suggestionsBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      next(validationError(bodyResult.error.issues));
      return;
    }

    const { boardId } = paramsResult.data;
    await assertBoardAccess(req.user, boardId);

    const userPrompt = bodyResult.data.prompt ?? null;

    const ctx = await loadBoardContext(boardId);
    const suggestions = await requestGroqSuggestions(ctx, userPrompt);

    sendSuccess(res, { suggestions });
  } catch (e) {
    next(e);
  }
};

export default { getBoardSuggestions };
