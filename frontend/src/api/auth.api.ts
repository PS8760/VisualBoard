import { client, apiErrorMessage } from './client';
import type { AuthResponse, User } from '../types';
import { initialsOf } from '../utils';

const TOKEN_KEY = 'vb_token';
const USER_KEY = 'vb_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as User | null;
    if (!parsed || typeof parsed !== 'object' || parsed.id === undefined || parsed.id === null) return null;
    // Ids are compared as strings across the app (board members, presence,
    // comment authors); sessions written by older builds stored numbers.
    return { ...parsed, id: String(parsed.id) };
  } catch {
    return null;
  }
}

export function persistSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Maps a backend user row into the frontend User shape. */
export function mapUser(
  raw: { id: number | string; name: string; email: string; avatar?: string | null },
  role: User['role'] = 'owner',
): User {
  return {
    id: String(raw.id),
    name: raw.name,
    email: raw.email,
    color: '#d9480f',
    initials: initialsOf(raw.name),
    role,
    avatar: raw.avatar ?? null,
  };
}

/** Merges changes into the stored user so refreshed profile data survives reloads. */
export function patchStoredUser(patch: Partial<Pick<User, 'name' | 'avatar' | 'initials'>>): void {
  const current = getStoredUser();
  if (!current) return;
  const updated = { ...current, ...patch };
  localStorage.setItem(USER_KEY, JSON.stringify(updated));
}

interface BackendAuthData {
  token: string;
  user: { id: number; name: string; email: string; avatar?: string | null };
}

function normalize(data: BackendAuthData | undefined): AuthResponse {
  if (!data?.token || !data?.user) {
    return { success: false, message: 'Invalid response from server' };
  }
  const user = mapUser(data.user);
  persistSession(data.token, user);
  return { success: true, token: data.token, user };
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    const { data } = await client.post<{ success: boolean; data?: BackendAuthData }>(
      '/auth/register',
      payload,
    );
    return normalize(data.data);
  } catch (error) {
    return { success: false, message: apiErrorMessage(error) };
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data } = await client.post<{ success: boolean; data?: BackendAuthData }>(
      '/auth/login',
      { email, password },
    );
    return normalize(data.data);
  } catch (error) {
    return { success: false, message: apiErrorMessage(error) };
  }
}

export async function oauthExchange(
  provider: 'github' | 'google',
  code: string,
  redirectUri?: string,
): Promise<AuthResponse> {
  try {
    const { data } = await client.post<{ success: boolean; data?: BackendAuthData }>(
      `/auth/${provider}/exchange`,
      { code, redirect_uri: redirectUri ?? window.location.href },
    );
    return normalize(data.data);
  } catch (error) {
    return { success: false, message: apiErrorMessage(error) };
  }
}

export function logout() {
  clearSession();
}