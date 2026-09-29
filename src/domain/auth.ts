// Sign-in contract between the UI and the data layer. No Supabase types leak past here.

// Length of the emailed sign-in code. Matches auth.email.otp_length in Supabase.
export const SIGN_IN_CODE_LENGTH = 6

// Seconds before another code can be sent to the same email. Matches Supabase's SMTP minimum interval.
export const RESEND_COOLDOWN_SECONDS = 60

export const AuthFailure = {
  NotAllowedEmail: 'not_allowed_email',
  CodeInvalid: 'code_invalid',
  RateLimited: 'rate_limited',
  Network: 'network',
  Unknown: 'unknown',
} as const
export type AuthFailure = (typeof AuthFailure)[keyof typeof AuthFailure]

export type AuthResult = { ok: true } | { ok: false; failure: AuthFailure }

export type SignedInUser = {
  id: string
  email: string
}

export interface AuthRepo {
  // Emails a sign-in code, creating the account on first use.
  requestCode(email: string): Promise<AuthResult>

  // Signs in with the emailed code. Success is reported through onUserChange.
  verifyCode(email: string, code: string): Promise<AuthResult>

  signOut(): Promise<void>

  // Calls back now with the current user (or null), then on every sign-in/out. Returns unsubscribe.
  onUserChange(callback: (user: SignedInUser | null) => void): () => void
}
