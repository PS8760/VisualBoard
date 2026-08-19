import { z } from 'zod';
import type { board_members, boards } from '@prisma/client';

export type Board = Pick<
  boards,
  'id' | 'title' | 'description' | 'owner_id' | 'created_at' | 'updated_at'
>;

export type BoardMember = Pick<board_members, 'id' | 'user_id' | 'board_id' | 'role' | 'created_at'>;

export type Role = 'owner' | 'editor' | 'viewer';

export type BoardIdParam = z.infer<typeof import('./board.validation.js').boardIdParamSchema>;
export type MemberIdParams = z.infer<typeof import('./board.validation.js').memberIdParamSchema>;

export default {};