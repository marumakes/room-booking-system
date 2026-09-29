import { describe, expect, it } from 'vitest'
import { FIXTURE, FIXTURE_TODAY, ME, S, SE } from '../test/roomsFixture'
import { canClaim, heldWeeks, roomDates, seriesOption } from './claims'
import { ClaimMode, DayType, type RoomsData } from './rooms'

function session(date: string, room: string) {
  return FIXTURE.sessions.find((s) => s.date === date && s.room === room)!
}

// The fixture without Alex's quiet room, so S on 22 Oct is open.
const S_OPEN: RoomsData = { ...FIXTURE, claims: FIXTURE.claims.filter((c) => c.ownerId !== 'alex') }

describe('canClaim', () => {
  it('allows a shared space next to one other host', () => {
    expect(canClaim(FIXTURE, session('2026-10-29', SE), ME, ClaimMode.Shared, FIXTURE_TODAY)).toBe(true)
  })

  it('refuses quiet once anyone is in the room', () => {
    expect(canClaim(FIXTURE, session('2026-10-29', SE), ME, ClaimMode.Quiet, FIXTURE_TODAY)).toBe(false)
  })

  it('allows quiet in an empty room', () => {
    expect(canClaim(FIXTURE, session('2026-10-26', SE), ME, ClaimMode.Quiet, FIXTURE_TODAY)).toBe(true)
  })

  it('refuses a second room on a night I already have one', () => {
    expect(canClaim(S_OPEN, session('2026-10-22', S), ME, ClaimMode.Shared, FIXTURE_TODAY)).toBe(false)
    expect(canClaim(S_OPEN, session('2026-10-22', S), 'someone-free', ClaimMode.Shared, FIXTURE_TODAY)).toBe(true)
  })

  it('refuses a room I’m already in, a full room, a quiet room, the past and cancelled nights', () => {
    expect(canClaim(FIXTURE, session('2026-10-22', SE), ME, ClaimMode.Shared, FIXTURE_TODAY)).toBe(false)
    expect(canClaim(FIXTURE, session('2026-10-22', SE), 'other', ClaimMode.Shared, FIXTURE_TODAY)).toBe(false)
    expect(canClaim(FIXTURE, session('2026-10-22', S), 'other', ClaimMode.Shared, FIXTURE_TODAY)).toBe(false)
    expect(canClaim(FIXTURE, session('2026-10-19', SE), ME, ClaimMode.Shared, FIXTURE_TODAY)).toBe(false)
    expect(canClaim(FIXTURE, session('2026-11-02', SE), ME, ClaimMode.Shared, FIXTURE_TODAY)).toBe(false)
  })
})

describe('seriesOption', () => {
  it('counts only the new weeks, skipping ones already held', () => {
    // Thursday SE: 22 Oct is mine, 29 Oct has one space.
    expect(seriesOption(FIXTURE, SE, DayType.Thursday, ClaimMode.Shared, ME, FIXTURE_TODAY)).toEqual({ available: true, weeks: 1 })
  })

  it('is unavailable when any remaining week is taken for this mode', () => {
    expect(seriesOption(FIXTURE, SE, DayType.Thursday, ClaimMode.Shared, 'other', FIXTURE_TODAY)).toEqual({ available: false })
    expect(seriesOption(FIXTURE, SE, DayType.Thursday, ClaimMode.Quiet, ME, FIXTURE_TODAY)).toEqual({ available: false })
  })

  it('is unavailable when I have a different room on one of the nights', () => {
    const otherRoomOn29: RoomsData = {
      ...FIXTURE,
      sessions: [...FIXTURE.sessions, { id: `2026-10-29|${S}`, date: '2026-10-29', day: DayType.Thursday, room: S, roomPosition: 1, available: true }],
      claims: [...FIXTURE.claims, { id: 'y', sessionId: `2026-10-29|${S}`, slot: 1, mode: ClaimMode.Shared, ownerId: ME, ownerName: 'Me' }],
    }
    expect(seriesOption(otherRoomOn29, SE, DayType.Thursday, ClaimMode.Shared, ME, FIXTURE_TODAY)).toEqual({ available: false })
  })

  it('is unavailable for part-term rooms and for rooms cancelled on a remaining week', () => {
    expect(seriesOption(FIXTURE, S, DayType.Thursday, ClaimMode.Shared, ME, FIXTURE_TODAY)).toEqual({ available: false })
    expect(seriesOption(FIXTURE, SE, DayType.Monday, ClaimMode.Shared, ME, FIXTURE_TODAY)).toEqual({ available: false })
  })

  it('is unavailable when there is nothing new to claim', () => {
    const allMine: RoomsData = {
      ...FIXTURE,
      claims: [...FIXTURE.claims, { id: 'x', sessionId: `2026-10-29|${SE}`, slot: 2, mode: ClaimMode.Shared, ownerId: ME, ownerName: 'Me' }],
    }
    expect(seriesOption(allMine, SE, DayType.Thursday, ClaimMode.Shared, ME, FIXTURE_TODAY)).toEqual({ available: false })
  })
})

describe('heldWeeks and roomDates', () => {
  it('counts remaining weeks held in a room', () => {
    expect(heldWeeks(FIXTURE, SE, DayType.Thursday, ME, FIXTURE_TODAY)).toBe(1)
    expect(heldWeeks(FIXTURE, SE, DayType.Thursday, 'sam', FIXTURE_TODAY)).toBe(2)
    expect(heldWeeks(FIXTURE, SE, DayType.Monday, 'sam', FIXTURE_TODAY)).toBe(0)
  })

  it('lists the nights a room is booked', () => {
    expect(roomDates(FIXTURE, S, DayType.Thursday)).toEqual(['2026-10-22'])
  })
})
