// @vitest-environment node
// The closing time against the local Supabase stack, through the real API (which rejects UPDATE without WHERE).
// Needs `supabase start`; run with `npm run test:integration`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ClaimFailure, canClaim } from '../domain/claims'
import { siteToday } from '../domain/dates'
import { ClaimMode, type RoomsData } from '../domain/rooms'
import { makeCommittee, signIn } from '../test/localSupabase'
import { supabaseAuthRepo } from './authRepo'
import { supabaseClaimsRepo } from './claimsRepo'
import { supabaseProfileRepo } from './profileRepo'
import { supabaseRoomsRepo } from './roomsRepo'

async function loadRooms(): Promise<RoomsData> {
  const result = await supabaseRoomsRepo.loadRooms()

  if (!result.ok) {
    throw new Error(`Rooms failed to load: ${result.failure}`)
  }

  return result.data
}

describe('closing time against local Supabase', () => {
  // Unique per run, since earlier runs' users stay in the local database.
  const run = Date.now()

  beforeAll(async () => {
    const me = await signIn(`it-closing-${run}@university.example`)
    await supabaseProfileRepo.createProfile(me.id, `Closing ${run}`)
    makeCommittee(me.id)
  })

  // Never leave the local app closed.
  afterAll(async () => {
    await supabaseClaimsRepo.setClosingTime(null)
    await supabaseAuthRepo.signOut()
  })

  it('closes sign-up, refuses claims, and reopens', async () => {
    const closesAt = new Date(Date.now() - 60_000).toISOString()

    expect(await supabaseClaimsRepo.setClosingTime(closesAt)).toEqual({ ok: true })

    const closed = await loadRooms()
    expect(Date.parse(closed.closesAt!)).toBe(Date.parse(closesAt))

    const target = closed.sessions.find((s) => canClaim(closed, s, 'someone-free', ClaimMode.Shared, siteToday()))!
    expect(await supabaseClaimsRepo.claimSlot(target.id, ClaimMode.Shared)).toEqual({
      ok: false,
      failure: ClaimFailure.ClaimsClosed,
    })

    expect(await supabaseClaimsRepo.setClosingTime(null)).toEqual({ ok: true })
    expect((await loadRooms()).closesAt).toBeNull()
  })
})
