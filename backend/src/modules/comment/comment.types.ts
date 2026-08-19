import type { comments } from '@prisma/client';

export type CommentRow = Pick<comments, 'id' | 'board_id' | 'user_id' | 'content' | 'created_at' | 'updated_at'>;

export default {};