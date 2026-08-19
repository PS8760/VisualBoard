import { z } from 'zod';

export const createBoardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
  description: z.string().trim().max(1000, 'Description is too long').optional(),
});

export const updateBoardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const boardIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const memberIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

export const addMemberSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(['editor', 'viewer']),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().min(3, 'Email is required').max(255),
  role: z.enum(['editor', 'viewer']),
});

export const updateMemberSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']),
});

export default { createBoardSchema, updateBoardSchema, boardIdParamSchema, memberIdParamSchema, addMemberSchema, inviteMemberSchema, updateMemberSchema };