// @vitest-environment node
// Live updates between two real users on the local Supabase stack. Needs `supabase start`;
// run with `npm run test:integration`.
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canClaim } from '../domain/claims'
import { siteToday } from '../domain/dates'
import { ClaimMode } from '../domain/rooms'
import { readCode, signIn } from '../test/localSupabase'
import { supabaseAuthRepo } from './authRepo'
import type { Database } from './database.types'
import { supabaseProfileRepo } from './profileRepo'
import { supabaseRoomsRepo } from './roomsRepo'

const NOTIFY_TIMEOUT_MS = 5000

// Resolves when the watcher's live subscription reports a change, or rejects after a timeout.
function nextChange(): { promise: Promise<void>; stop: () => void } {
  let stop = () => {}
  const promise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No live update received')), NOTIFY_TIMEOUT_MS)
    stop = supabaseRoomsRepo.onChange(() => {
      clearTimeout(timer)
      resolve()
    })
  })
  return { promise, stop: () => stop() }
}

describe('live updates between two hosts', () => {
  const run = Date.now()

  // A second, independent connection acting as another host on another device.
  const other = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })

  beforeAll(async () => {
    // The watcher, using the app's own data layer.
    const watcher = await signIn(`it-watch-${run}@university.example`)
    await supabaseProfileRepo.createProfile(watcher.id, `Watcher ${run}`)

    // The other host.
    const email = `it-other-${run}@university.example`
    await other.auth.signInWithOtp({ email })
    const { data } = await other.auth.verifyOtp({ email, token: await readCode(email), type: 'email' })
    await other.from('profiles').insert({ user_id: data.user!.id, display_name: `Other ${run}` })
  })

  afterAll(async () => {
    await supabaseAuthRepo.signOut()
    await other.auth.signOut()
  })

  it('notifies the watcher when another host claims and releases', async () => {
    const loaded = await supabaseRoomsRepo.loadRooms()
    const rooms = loaded.ok ? loaded.data : { sessions: [], claims: [], closesAt: null }
    const target = rooms.sessions.find((s) => canClaim(rooms, s, 'someone-free', ClaimMode.Shared, siteToday()))!

    const claimed = nextChange()
    await new Promise((resolve) => setTimeout(resolve, 1000)) // let the subscription connect
    expect((await other.rpc('claim_slot', { p_session_id: target.id, p_mode: ClaimMode.Shared })).error).toBeNull()
    await claimed.promise
    claimed.stop()

    const released = nextChange()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    expect((await other.rpc('release_claim', { p_session_id: target.id })).error).toBeNull()
    await released.promise
    released.stop()
  })
})
