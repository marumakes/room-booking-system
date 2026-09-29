import type { AuthRepo, AuthResult, SignedInUser } from '../domain/auth'
import { normaliseEmail } from '../domain/email'
import { AuthAction, toAuthFailure } from './authErrors'
import { supabase } from './supabaseClient'

const OK: AuthResult = { ok: true }

// Email + 6-digit code sign-in on Supabase Auth.
export const supabaseAuthRepo: AuthRepo = {
  async requestCode(email) {
    const { error } = await supabase.auth.signInWithOtp({ email: normaliseEmail(email) })

    if (error) {
      return { ok: false, failure: toAuthFailure(error, AuthAction.RequestCode) }
    }

    return OK
  },

  async verifyCode(email, code) {
    const { error } = await supabase.auth.verifyOtp({
      email: normaliseEmail(email),
      token: code,
      type: 'email',
    })

    if (error) {
      return { ok: false, failure: toAuthFailure(error, AuthAction.VerifyCode) }
    }

    return OK
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  // Fires straight away with the stored session, then on sign-in, sign-out and failed refresh.
  // Only sets state in the callback: calling Supabase inside it can deadlock the auth client.
  onUserChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      const signedIn: SignedInUser | null = user ? { id: user.id, email: user.email ?? '' } : null
      callback(signedIn)
    })

    return () => data.subscription.unsubscribe()
  },
}
