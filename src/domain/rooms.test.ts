import { describe, expect, it } from 'vitest'
import { FIXTURE, FIXTURE_TODAY, ME, S, SE } from '../test/roomsFixture'
import {
  CellKind,
  ClaimMode,
  DayType,
  cellView,
  claimsBySession,
  defaultDay,
  isDayType,
  myRoomsByDate,
  mySessions,
  nextSessionDate,
  partTermRooms,
  resolveWeek,
  roomsForDay,
  sessionDates,
  sessionDays,
  type Session,
} from './rooms'

const THURSDAYS = ['2026-10-15', '2026-10-22', '2026-10-29']

// Cell for one room on one night of the fixture, as seen by ME.
function fixtureCell(date: string, room: string, myId = ME) {
  const session = FIXTURE.sessions.find((s) => s.date === date && s.room === room)
  const claims = session ? (claimsBySession(FIXTURE.claims).get(session.id) ?? []) : []
  return cellView(session, claims, myId, FIXTURE_TODAY)
}

describe('days and weeks', () => {
  it('recognises weekday names only', () => {
    expect(isDayType('monday')).toBe(true)
    expect(isDayType('friday')).toBe(true)
    expect(isDayType('funday')).toBe(false)
    expect(isDayType(undefined)).toBe(false)
  })

  it('lists session dates for a day, oldest first', () => {
    expect(sessionDates(FIXTURE.sessions, DayType.Thursday)).toEqual(THURSDAYS)
  })

  it('lists rooms in venue-PDF order, not alphabetically', () => {
    expect(roomsForDay(FIXTURE.sessions, DayType.Thursday)).toEqual([SE, S])
  })

  it('flags rooms not booked every week, per day', () => {
    expect(partTermRooms(FIXTURE.sessions, DayType.Thursday)).toEqual(new Set([S]))
    expect(partTermRooms(FIXTURE.sessions, DayType.Monday)).toEqual(new Set())
  })

  it('finds the next session, including today', () => {
    expect(nextSessionDate(THURSDAYS, '2026-10-20')).toBe('2026-10-22')
    expect(nextSessionDate(THURSDAYS, '2026-10-22')).toBe('2026-10-22')
    expect(nextSessionDate(THURSDAYS, '2026-12-01')).toBeNull()
  })

  it('opens on the day whose next session is soonest', () => {
    expect(defaultDay(FIXTURE.sessions, FIXTURE_TODAY)).toBe(DayType.Thursday)
    expect(defaultDay(FIXTURE.sessions, '2026-10-23')).toBe(DayType.Monday)
  })

  it('falls back to Monday once the term is over', () => {
    expect(defaultDay(FIXTURE.sessions, '2027-01-01')).toBe(DayType.Monday)
  })
})

describe('sessionDays', () => {
  it('lists the days that have sessions, Monday first', () => {
    expect(sessionDays(FIXTURE.sessions)).toEqual([DayType.Monday, DayType.Thursday])
  })

  it('works for any weekdays, e.g. Tuesdays and Fridays', () => {
    const tueFri: Session[] = [
      { id: 'f', date: '2026-10-09', day: DayType.Friday, room: 'A', roomPosition: 0, available: true },
      { id: 't', date: '2026-10-06', day: DayType.Tuesday, room: 'A', roomPosition: 0, available: true },
    ]
    expect(sessionDays(tueFri)).toEqual([DayType.Tuesday, DayType.Friday])
    expect(defaultDay(tueFri, '2027-01-01')).toBe(DayType.Tuesday)
  })
})

describe('resolveWeek', () => {
  it('keeps a requested session date', () => {
    expect(resolveWeek(THURSDAYS, '2026-10-15', FIXTURE_TODAY)).toBe('2026-10-15')
  })

  it('snaps a non-session date to the next session', () => {
    expect(resolveWeek(THURSDAYS, '2026-10-16', FIXTURE_TODAY)).toBe('2026-10-22')
  })

  it('uses the next session from today when nothing is requested', () => {
    expect(resolveWeek(THURSDAYS, null, FIXTURE_TODAY)).toBe('2026-10-22')
  })

  it('shows the last week after the term ends', () => {
    expect(resolveWeek(THURSDAYS, null, '2027-01-01')).toBe('2026-10-29')
  })

  it('has nothing to show without sessions', () => {
    expect(resolveWeek([], null, FIXTURE_TODAY)).toBeNull()
  })
})

describe('cellView', () => {
  it('shows an empty room with two spaces', () => {
    expect(fixtureCell('2026-10-26', SE)).toEqual({ kind: CellKind.Open, spacesLeft: 2, others: [], past: false, mineTonight: null })
  })

  it('shows one space left beside the other host', () => {
    expect(fixtureCell('2026-10-29', SE)).toEqual({ kind: CellKind.Open, spacesLeft: 1, others: ['Sam'], past: false, mineTonight: null })
  })

  it('shows my claim with whoever I share with', () => {
    expect(fixtureCell('2026-10-22', SE)).toEqual({ kind: CellKind.Mine, mode: ClaimMode.Shared, others: ['Sam'], past: false })
  })

  it('shows a full room to someone not in it', () => {
    expect(fixtureCell('2026-10-22', SE, 'someone-else')).toEqual({ kind: CellKind.Full, names: ['Me', 'Sam'], past: false })
  })

  it('shows a quiet room once, not as two claims', () => {
    expect(fixtureCell('2026-10-22', S)).toEqual({ kind: CellKind.Quiet, name: 'Alex', past: false })
  })

  it('shows my own quiet room as mine', () => {
    expect(fixtureCell('2026-10-22', S, 'alex')).toEqual({ kind: CellKind.Mine, mode: ClaimMode.Quiet, others: [], past: false })
  })

  it('marks past sessions', () => {
    expect(fixtureCell('2026-10-19', SE)).toMatchObject({ kind: CellKind.Open, past: true })
  })

  it('notes when I already have another room that night', () => {
    const session = FIXTURE.sessions.find((s) => s.date === '2026-10-22' && s.room === S)
    expect(cellView(session, [], ME, FIXTURE_TODAY, SE)).toMatchObject({ kind: CellKind.Open, mineTonight: SE })
    expect(cellView(session, [], ME, FIXTURE_TODAY, S)).toMatchObject({ kind: CellKind.Open, mineTonight: null })
  })

  it('treats unbooked and cancelled rooms the same', () => {
    expect(fixtureCell('2026-10-29', S)).toEqual({ kind: CellKind.NotBooked })
    expect(fixtureCell('2026-11-02', SE)).toEqual({ kind: CellKind.NotBooked })
  })
})

describe('myRoomsByDate', () => {
  it('maps each night to the room I hold', () => {
    expect(myRoomsByDate(FIXTURE, ME)).toEqual(new Map([['2026-10-22', SE]]))
    expect(myRoomsByDate(FIXTURE, 'alex')).toEqual(new Map([['2026-10-22', S]]))
  })
})

describe('mySessions', () => {
  it('lists my claims once per room-night, soonest first', () => {
    const data = {
      sessions: FIXTURE.sessions,
      claims: [...FIXTURE.claims].reverse(),
      closesAt: null,
    }

    expect(mySessions(data, 'alex')).toEqual([
      { sessionId: `2026-10-22|${S}`, date: '2026-10-22', day: DayType.Thursday, room: S, mode: ClaimMode.Quiet },
    ])
    expect(mySessions(data, 'sam').map((m) => m.date)).toEqual(['2026-10-19', '2026-10-22', '2026-10-29'])
  })

  it('ignores claims on sessions that no longer exist', () => {
    const orphan: Session[] = []
    expect(mySessions({ sessions: orphan, claims: FIXTURE.claims, closesAt: null }, ME)).toEqual([])
  })
})
