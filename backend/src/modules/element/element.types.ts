import type { elements } from '@prisma/client';

export type ElementRow = Pick<elements, 'id' | 'board_id' | 'element_data' | 'created_at' | 'updated_at'>;

export default {};