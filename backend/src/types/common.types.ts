/** Shared API contract types used across modules. */

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  provider: string | null;
}

export interface AuthResponse {
  user: PublicUser;
  token: string;
}
