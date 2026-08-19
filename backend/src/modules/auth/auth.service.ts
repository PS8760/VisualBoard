import { createPublicKey } from 'node:crypto';
import prisma from '../../config/prisma.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import { signToken } from '../../utils/jwt.js';
import { AppError, conflictError } from '../../utils/errors.js';
import { env, oauthConfigured } from '../../config/env.js';
import { publicAvatar } from '../user/user.service.js';
import type { AuthResponse, PublicUser } from '../../types/common.types.js';

const stripPassword = (user: {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  provider: string | null;
}): PublicUser => {
  return { id: user.id, name: user.name, email: user.email, avatar: publicAvatar(user), provider: user.provider };
};

const issueSession = (user: { id: number; email: string }): string =>
  signToken({ id: user.id, email: user.email });

export const registerUser = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) throw conflictError('An account with that email already exists');

  const hashed = await hashPassword(password);
  const user = await prisma.users.create({
    data: { name, email, password: hashed },
  });

  return { user: stripPassword(user), token: issueSession(user) };
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user || !user.password) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const ok = await comparePassword(password, user.password);
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  return { user: stripPassword(user), token: issueSession(user) };
};

/* ------------------------------------------------------------------ */
/* OAuth                                                               */
/* ------------------------------------------------------------------ */

interface ProviderProfile {
  email: string;
  name: string;
  avatar?: string | null;
}

const GITHUB_API = 'https://api.github.com';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AppError(401, 'OAUTH_FAILED', `OAuth exchange failed${detail ? `: ${detail.slice(0, 120)}` : ''}`);
  }
  return (await res.json()) as T;
}

async function fetchGithubProfile(accessToken: string): Promise<ProviderProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const user = await fetchJson<{ name: string | null; login: string; email: string | null; avatar_url: string }>(
    `${GITHUB_API}/user`,
    { headers },
  );
  let email = user.email;
  if (!email) {
    const emails = await fetchJson<Array<{ email: string; primary: boolean; verified: boolean }>>(
      `${GITHUB_API}/user/emails`,
      { headers },
    );
    email = (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))?.email ?? null;
  }
  if (!email) throw new AppError(401, 'OAUTH_FAILED', 'Unable to obtain an email address from GitHub');
  return { email, name: user.name ?? user.login, avatar: user.avatar_url };
}

async function verifyGoogleIdToken(idToken: string): Promise<ProviderProfile> {
  const { GOOGLE_CLIENT_ID } = env;
  const certs = await fetchJson<{
    keys: Array<{ kid: string; kty: string; n?: string; e?: string; crv?: string; x?: string; y?: string }>;
  }>('https://www.googleapis.com/oauth2/v3/certs');

  const header = JSON.parse(Buffer.from(idToken.split('.')[0] ?? '', 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  const key = certs.keys.find((k) => k.kid === header.kid);
  if (!key) throw new AppError(401, 'OAUTH_FAILED', 'Google token signing key not found');

  // Reuse jsonwebtoken to verify signature + claims against Google's public key.
  const jwt = await import('jsonwebtoken');
  const publicKey = createPublicKey({ key: key as JsonWebKey, format: 'jwk' });
  const algorithm = header.alg === 'ES256' ? 'ES256' : 'RS256';
  const decoded = jwt.verify(idToken, publicKey, {
    algorithms: [algorithm],
    audience: GOOGLE_CLIENT_ID,
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
  }) as { email?: unknown; name?: unknown; picture?: unknown };

  if (typeof decoded.email !== 'string' || !decoded.email) {
    throw new AppError(401, 'OAUTH_FAILED', 'Unable to obtain an email address from Google');
  }
  return {
    email: decoded.email,
    name: (decoded.name as string | undefined) ?? decoded.email.split('@')[0] ?? 'Google user',
    avatar: (decoded.picture as string | undefined) ?? null,
  };
}

/**
 * Creates or logs in a user from a verified provider profile.
 * Account-linking strategy: identity is email. If an account already exists
 * with a password, the OAuth login succeeds and links the provider — the
 * existing password (if any) is preserved.
 */
export const upsertOAuthUser = async (provider: 'github' | 'google', profile: ProviderProfile): Promise<AuthResponse> => {
  const user = await prisma.users.upsert({
    where: { email: profile.email },
    update: { name: profile.name ?? undefined, avatar: profile.avatar ?? undefined },
    create: {
      name: profile.name,
      email: profile.email,
      password: null,
      avatar: profile.avatar ?? null,
      provider,
    },
  });

  return { user: stripPassword(user), token: issueSession(user) };
};

export const exchangeGithubCode = async (code: string, redirect_uri?: string): Promise<AuthResponse> => {
  if (!oauthConfigured.github) throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'GitHub OAuth is not configured');

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID!,
    client_secret: env.GITHUB_CLIENT_SECRET!,
    code,
  });
  if (redirect_uri) params.set('redirect_uri', redirect_uri);

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: params,
  });
  if (!tokenRes.ok) throw new AppError(401, 'OAUTH_FAILED', 'Failed to exchange GitHub authorization code');
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    throw new AppError(401, 'OAUTH_FAILED', 'GitHub did not return an access token');
  }

  const profile = await fetchGithubProfile(tokenData.access_token);
  return upsertOAuthUser('github', profile);
};

export const exchangeGoogleCode = async (code: string, redirect_uri?: string): Promise<AuthResponse> => {
  if (!oauthConfigured.google) throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'Google OAuth is not configured');

  const params = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirect_uri ?? 'postmessage',
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!tokenRes.ok) throw new AppError(401, 'OAUTH_FAILED', 'Failed to exchange Google authorization code');
  const tokenData = (await tokenRes.json()) as { id_token?: string };
  if (!tokenData.id_token) throw new AppError(401, 'OAUTH_FAILED', 'Google did not return an id_token');

  const profile = await verifyGoogleIdToken(tokenData.id_token);
  return upsertOAuthUser('google', profile);
};

export default { registerUser, loginUser, exchangeGithubCode, exchangeGoogleCode, upsertOAuthUser };
