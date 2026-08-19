import { Request, Response, NextFunction } from 'express';
import { generateSuggestionsForBoard } from './suggestions.service.js';
import { sendSuccess } from '../../utils/response.js';

export const getBoardSuggestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = req.params.boardId;
    const items = await generateSuggestionsForBoard(boardId);
    sendSuccess(res, items);
  } catch (e) {
    next(e);
  }
};

export default { getBoardSuggestions };