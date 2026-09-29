import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { AuthFailure } from '../domain/auth'
import { AuthAction, toAuthFailure } from './authErrors'

describe('toAuthFailure', () => {
  it('maps the sign-up hook rejection to a outside-domain email', () => {
    const hookRejection = new AuthApiError('Only @university.example email addresses can sign up.', 403, 'unknown')
    expect(toAuthFailure(hookRejection, AuthAction.RequestCode)).toBe(AuthFailure.NotAllowedEmail)
  })

  it('maps an expired or wrong code', () => {
    const expired = new AuthApiError('Token has expired or is invalid', 403, 'otp_expired')
    expect(toAuthFailure(expired, AuthAction.VerifyCode)).toBe(AuthFailure.CodeInvalid)
  })

  it('maps rate limits for either action', () => {
    const limited = new AuthApiError('Too many requests', 429, 'over_email_send_rate_limit')
    expect(toAuthFailure(limited, AuthAction.RequestCode)).toBe(AuthFailure.RateLimited)
    expect(toAuthFailure(limited, AuthAction.VerifyCode)).toBe(AuthFailure.RateLimited)
  })

  it('maps network failures', () => {
    const offline = new AuthRetryableFetchError('Failed to fetch', 0)
    expect(toAuthFailure(offline, AuthAction.RequestCode)).toBe(AuthFailure.Network)
  })

  it('falls back to unknown', () => {
    expect(toAuthFailure(new Error('boom'), AuthAction.VerifyCode)).toBe(AuthFailure.Unknown)
    const serverError = new AuthApiError('Error sending magic link email', 500, 'unexpected_failure')
    expect(toAuthFailure(serverError, AuthAction.RequestCode)).toBe(AuthFailure.Unknown)
  })
})
