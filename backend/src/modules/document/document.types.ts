import type { documents } from '@prisma/client';

export type DocumentRow = Pick<
  documents,
  'id' | 'board_id' | 'element_id' | 'user_id' | 'original_name' | 'stored_name' | 'mime_type' | 'size' | 'created_at'
>;

export default {};