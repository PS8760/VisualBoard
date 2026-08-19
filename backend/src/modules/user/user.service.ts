import prisma from '../../config/prisma.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import { AppError, badRequestError } from '../../utils/errors.js';
import type { PublicUser } from '../../types/common.types.js';

export const toPublicUser = (user: {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  provider: string | null;
}): PublicUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: publicAvatar(user),
    provider: user.provider,
  };
};

/**
 * Resolves the avatar to a client-safe URL.
 * Locally-hosted avatars are stored as `k:<storageKey>`; they must never
 * reach the client as-is, so they are exposed through the avatar endpoint.
 */
export const publicAvatar = (user: {
  id: number;
  avatar: string | null;
  updated_at?: Date | null;
}): string | null => {
  if (!user.avatar) return null;
  if (!user.avatar.startsWith('k:')) return user.avatar;
  const v = Math.floor((user.updated_at?.getTime() ?? Date.now()) / 1000);
  return `/api/v1/users/${user.id}/avatar?v=${v}`;
};

export const getUserById = async (id: number) => {
  return prisma.users.findUnique({ where: { id } });
};

export const updateUser = async (
  id: number,
  data: {
    name?: string;
    avatar?: string | null;
  },
) => {
  const user = await prisma.users.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  const updateData: { name?: string; avatar?: string | null } = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.avatar !== undefined) updateData.avatar = data.avatar ?? null;

  const updated = await prisma.users.update({ where: { id }, data: updateData });
  return toPublicUser(updated);
};

export const changePassword = async (userId: number, currentPassword: string, newPassword: string) => {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  if (!user.password) {
    throw badRequestError('Cannot change the password of an OAuth-only account');
  }
  const ok = await comparePassword(currentPassword, user.password);
  if (!ok) throw new AppError(403, 'FORBIDDEN', 'Current password is incorrect');

  await prisma.users.update({ where: { id: userId }, data: { password: await hashPassword(newPassword) } });
  return true;
};

/** Stores a locally-hosted avatar reference (`k:<storageKey>`). */
export const setAvatarStorageKey = async (userId: number, storageKey: string) => {
  await prisma.users.update({
    where: { id: userId },
    data: { avatar: `k:${storageKey}` },
  });
};

export const getUserForInvite = async (email: string) => {
  return prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, name: true, email: true, avatar: true, updated_at: true },
  });
};

export default { getUserById, updateUser, changePassword, toPublicUser, setAvatarStorageKey, getUserForInvite };