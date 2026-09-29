// @vitest-environment node
// Real claims against the local Supabase stack. Needs `supabase start`; run with `npm run test:integration`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SignedInUser } from '../domain/auth'
import { ClaimFailure, canClaim, seriesOption } from '../domain/claims'
import { siteToday } from '../domain/dates'
import { ClaimMode, DAY_TYPES, partTermRooms, roomsForDay, type RoomsData } from '../domain/rooms'
import { signIn } from '../test/localSupabase'
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

describe('claims against local Supabase', () => {
  // Unique per run, since earlier runs' users stay in the local database.
  const run = Date.now()
  let me: SignedInUser

  beforeAll(async () => {
    me = await signIn(`it-claims-${run}@university.example`)
    await supabaseProfileRepo.createProfile(me.id, `Claims ${run}`)
  })

  afterAll(async () => {
    await supabaseAuthRepo.signOut()
  })

  it('claims a space, refuses a second in the room or that night, and releases it', async () => {
    const today = siteToday()
    const before = await loadRooms()
    const target = before.sessions.find((s) => canClaim(before, s, me.id, ClaimMode.Shared, today))!

    expect(await supabaseClaimsRepo.claimSlot(target.id, ClaimMode.Shared)).toEqual({ ok: true })

    const after = await loadRooms()
    expect(after.claims.some((c) => c.sessionId === target.id && c.ownerId === me.id)).toBe(true)

    expect(await supabaseClaimsRepo.claimSlot(target.id, ClaimMode.Shared)).toEqual({
      ok: false,
      failure: ClaimFailure.AlreadyClaimed,
    })

    // Another room the same night is refused, even though it has space.
    const sameNight = after.sessions.find((s) => s.date === target.date && s.id !== target.id && canClaim(after, s, 'someone-free', ClaimMode.Shared, today))!
    expect(await supabaseClaimsRepo.claimSlot(sameNight.id, ClaimMode.Shared)).toEqual({
      ok: false,
      failure: ClaimFailure.BookedTonight,
    })

    expect(await supabaseClaimsRepo.releaseClaim(target.id)).toEqual({ ok: true, released: 1 })
  })

  it('refuses to multi-book a room that isn’t booked every week', async () => {
    const data = await loadRooms()
    const partTerm = DAY_TYPES.flatMap((day) => [...partTermRooms(data.sessions, day)].map((room) => ({ room, day })))[0]

    expect(await supabaseClaimsRepo.claimSeries(partTerm.room, partTerm.day, ClaimMode.Shared)).toEqual({
      ok: false,
      failure: ClaimFailure.NotEveryWeek,
    })
  })

  it('multi-books a free full-term room and releases every week', async () => {
    const today = siteToday()
    const data = await loadRooms()

    // First room/day the client says can be multi-booked, so the test doesn't depend on local dev data.
    const candidate = DAY_TYPES.flatMap((day) => roomsForDay(data.sessions, day).map((room) => ({ room, day })))
      .map((c) => ({ ...c, option: seriesOption(data, c.room, c.day, ClaimMode.Shared, me.id, today) }))
      .find((c) => c.option.available)!

    expect(candidate).toBeDefined()
    expect(await supabaseClaimsRepo.claimSeries(candidate.room, candidate.day, ClaimMode.Shared)).toEqual({ ok: true })

    const weeks = candidate.option.available ? candidate.option.weeks : 0
    expect(await supabaseClaimsRepo.releaseSeries(candidate.room, candidate.day)).toEqual({ ok: true, released: weeks })
  })
})
