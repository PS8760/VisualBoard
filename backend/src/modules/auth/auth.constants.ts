export const AuthErrors = {
  EMAIL_IN_USE: 'An account with that email already exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  OAuth_NOT_CONFIGURED: (provider: string) => `${provider} OAuth is not configured on the server`,
  OAuth_FAILED: 'OAuth exchange failed',
} as const;

export default AuthErrors;
