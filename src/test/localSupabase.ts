/// <reference types="node" />
// Helpers for integration tests against the local Supabase stack (`supabase start`).
import { execFileSync } from 'node:child_process'
import type { SignedInUser } from '../domain/auth'
import { supabaseAuthRepo } from '../data/authRepo'

// Local mail catcher bundled with `supabase start`.
const MAILPIT_URL = 'http://127.0.0.1:54324'
const CODE_PATTERN = /\b\d{6}\b/
const MAIL_POLL_ATTEMPTS = 20
const MAIL_POLL_INTERVAL_MS = 250

// Waits for the sign-in email to arrive and pulls the 6-digit code out of it.
export async function readCode(email: string): Promise<string> {
  for (let attempt = 0; attempt < MAIL_POLL_ATTEMPTS; attempt++) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(email)}`)
    const { messages } = (await search.json()) as { messages: { ID: string }[] }

    if (messages.length > 0) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)
      const { Text } = (await message.json()) as { Text: string }
      const match = Text.match(CODE_PATTERN)

      if (match) {
        return match[0]
      }
    }

    await new Promise((resolve) => setTimeout(resolve, MAIL_POLL_INTERVAL_MS))
  }

  throw new Error(`No sign-in code emailed to ${email}`)
}

// Resolves once the auth listener reports this email signed in (ignoring any earlier session).
export function signedInAs(email: string): Promise<SignedInUser> {
  return new Promise((resolve) => {
    const unsubscribe = supabaseAuthRepo.onUserChange((user) => {
      if (user?.email === email) {
        resolve(user)
        queueMicrotask(unsubscribe)
      }
    })
  })
}

// Sessions in the local seed (the fictional term in seed-data/sessions.csv).
export const SEEDED_SESSION_COUNT = 84

// Requests a code, reads it from the mail catcher and signs in.
export async function signIn(email: string): Promise<SignedInUser> {
  await supabaseAuthRepo.requestCode(email)
  const code = await readCode(email)
  const signedIn = signedInAs(email)
  await supabaseAuthRepo.verifyCode(email, code)
  return signedIn
}

// Local database container; the only way to add committee members, as in production (SQL editor).
const DB_CONTAINER = 'supabase_db_room-booking-system'

// Adds the user to committee in the local database.
export function makeCommittee(userId: string): void {
  execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-c', `insert into public.committee (user_id) values ('${userId}')`])
}
