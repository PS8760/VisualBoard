import { Response, NextFunction, Request } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import prisma from '../../config/prisma.js';
import {
  getUserById,
  updateUser,
  changePassword,
  setAvatarStorageKey,
  publicAvatar,
} from './user.service.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  userSearchSchema,
  MAX_AVATAR_BYTES,
  AVATAR_MIME_ALLOWED,
} from './user.validation.js';
import { parseOrThrow } from '../../utils/params.js';
import { notFoundError, badRequestError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { getStorage } from '../../services/storage/index.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const me = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) throw notFoundError('User not found');
    const { password: _pw, ...rest } = user;
    sendSuccess(res, { ...rest, avatar: publicAvatar(user) });
  } catch (e) {
    next(e);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = parseOrThrow(updateProfileSchema, req.body);
    const user = await updateUser(req.user.id, parsed);
    sendSuccess(res, user);
  } catch (e) {
    next(e);
  }
};

export const setPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = parseOrThrow(changePasswordSchema, req.body);
    await changePassword(req.user.id, parsed.currentPassword, parsed.newPassword);
    sendSuccess(res, { updated: true });
  } catch (e) {
    next(e);
  }
};

/** Searches users by email so owners can invite collaborators. */
export const search = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = parseOrThrow(userSearchSchema, req.query);
    const users = await prisma.users.findMany({
      where: {
        email: { contains: email, mode: 'insensitive' as const },
        NOT: { id: req.user.id },
      },
      select: { id: true, name: true, email: true, avatar: true, updated_at: true },
      take: 8,
    });
    sendSuccess(
      res,
      users.map((u) => ({ id: u.id, name: u.name, email: u.email, avatar: publicAvatar(u) })),
    );
  } catch (e) {
    next(e);
  }
};

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, AVATAR_MIME_ALLOWED.has(file.mimetype));
  },
});

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw badRequestError('An avatar image is required (field "avatar")');
    if (!AVATAR_MIME_ALLOWED.has(req.file.mimetype)) {
      throw badRequestError('Avatar must be a PNG, JPEG, WebP or GIF image');
    }

    const ext = extname(req.file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.png';
    const key = `avatars/${Date.now()}_${randomBytes(10).toString('hex')}${ext}`;
    const storage = getStorage();
    await storage.save(key, req.file.buffer, req.file.mimetype);

    const previous = (await getUserById(req.user.id))?.avatar;
    await setAvatarStorageKey(req.user.id, key);

    if (previous?.startsWith('k:')) {
      storage.delete(previous.slice(2)).catch(() => undefined);
    }

    const fresh = await getUserById(req.user.id);
    if (!fresh) throw notFoundError('User not found');
    sendSuccess(res, { avatar: publicAvatar(fresh) });
  } catch (e) {
    next(e);
  }
};

/** Publicly serves a stored avatar; redirects to external (OAuth) avatar URLs. */
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export const serveAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.userId);
    if (!Number.isInteger(id) || id <= 0) throw notFoundError('User not found');
    const user = await getUserById(id);
    if (!user?.avatar) throw notFoundError('Avatar not found');

    if (!user.avatar.startsWith('k:')) {
      res.redirect(user.avatar);
      return;
    }

    const storage = getStorage();
    const bytes = await storage.read(user.avatar.slice(2));
    if (!bytes) throw notFoundError('Avatar not found');
    res.setHeader('Content-Type', MIME_BY_EXT[extname(user.avatar).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Content-Length', bytes.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(bytes);
  } catch (e) {
    next(e);
  }
};

export default { me, update, setPassword, search, avatarUpload, uploadAvatar, serveAvatar };