import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { AuthFailure } from '../domain/auth'

const HTTP_FORBIDDEN = 403
const HTTP_TOO_MANY_REQUESTS = 429
const SUPABASE_CODE_EXPIRED = 'otp_expired'

export const AuthAction = {
  RequestCode: 'request_code',
  VerifyCode: 'verify_code',
} as const
export type AuthAction = (typeof AuthAction)[keyof typeof AuthAction]

// Translates a Supabase auth error into a domain failure the UI can explain.
// 403 means different things per action: the sign-up hook rejecting the email when
// requesting a code, or a wrong/expired code when verifying.
export function toAuthFailure(error: unknown, action: AuthAction): AuthFailure {
  if (isAuthRetryableFetchError(error)) {
    return AuthFailure.Network
  }

  if (!isAuthApiError(error)) {
    console.error('Supabase auth error', error)
    return AuthFailure.Unknown
  }

  if (error.status === HTTP_TOO_MANY_REQUESTS) {
    return AuthFailure.RateLimited
  }

  if (action === AuthAction.VerifyCode && (error.code === SUPABASE_CODE_EXPIRED || error.status === HTTP_FORBIDDEN)) {
    return AuthFailure.CodeInvalid
  }

  if (action === AuthAction.RequestCode && error.status === HTTP_FORBIDDEN) {
    return AuthFailure.NotAllowedEmail
  }

  // Logged so unexpected failures can be diagnosed from the browser console.
  console.error('Supabase auth error', error)
  return AuthFailure.Unknown
}
