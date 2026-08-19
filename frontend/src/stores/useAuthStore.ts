import { create } from 'zustand';
import * as authApi from '../api/auth.api';
import { initialsOf } from '../utils';
import type { User } from '../types';

const DEMO_USER: User = {
  id: 'u_local',
  name: 'Demo User',
  email: 'demo@visualboard.dev',
  color: '#d9480f',
  initials: 'DU',
  role: 'owner',
};

interface AuthState {
  user: User | null;
  token: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'guest';
  error: string | null;
  hydrate: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  signInAsGuest: () => void;
  logout: () => void;
  setCurrentUser: (patch: Partial<Pick<User, 'name' | 'avatar' | 'initials'>>) => void;
}

const storedUser = authApi.getStoredUser();
const storedToken = authApi.getStoredToken();

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  token: storedToken,
  status: storedUser && storedToken ? 'authenticated' : 'idle',
  error: null,

  hydrate: () => {
    const user = authApi.getStoredUser();
    const token = authApi.getStoredToken();
    if (user && token) {
      set({ user, token, status: 'authenticated' });
    } else {
      set({ status: 'guest' });
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    const res = await authApi.login(email, password);
    if (res.success && res.user) {
      set({ user: res.user, token: res.token ?? null, status: 'authenticated' });
      return true;
    }
    set({ status: 'guest', error: res.message ?? 'Login failed' });
    return false;
  },

  register: async (name, email, password) => {
    set({ status: 'loading', error: null });
    const res = await authApi.register({ name, email, password });
    if (res.success && res.user) {
      set({ user: res.user, token: res.token ?? null, status: 'authenticated' });
      return true;
    }
    set({ status: 'guest', error: res.message ?? 'Registration failed' });
    return false;
  },

  signInAsGuest: () => {
    const name = 'Guest';
    const user: User = {
      ...DEMO_USER,
      id: `guest_${Math.random().toString(36).slice(2, 8)}`,
      name,
      initials: initialsOf(name),
      role: 'viewer',
    };
    set({ user, token: null, status: 'authenticated' });
  },

  logout: () => {
    authApi.logout();
    set({ user: null, token: null, status: 'guest' });
  },

  setCurrentUser: (patch) => {
    set((s) => (s.user ? { user: { ...s.user, ...patch } } : s));
    authApi.patchStoredUser(patch);
  },
}));

export const isAuthenticated = () =>
  useAuthStore.getState().status === 'authenticated' &&
  Boolean(useAuthStore.getState().user);
