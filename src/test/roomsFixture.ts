import { ClaimMode, DayType, type Claim, type RoomsData, type Session } from '../domain/rooms'

// A small term, seen from Tuesday 20 Oct 2026 (London).
// Mondays: 12 Oct (past), 19 Oct (past), 26 Oct, 2 Nov.
// Thursdays: 15 Oct (past), 22 Oct, 29 Oct.
// SE (Lister Lab 0.14) is booked every night; S (Harcourt 1.04) only on Thursday 22 Oct, so it's part-term.
// Room positions put SE first, which alphabetical order wouldn't.
export const FIXTURE_TODAY = '2026-10-20'
export const FIXTURE_NOW = new Date('2026-10-20T12:00:00Z')

export const ME = 'me'
export const SE = 'Lister Lab 0.14'
export const S = 'Harcourt 1.04'

function session(date: string, day: DayType, room: string, available = true): Session {
  return { id: `${date}|${room}`, date, day, room, roomPosition: room === SE ? 0 : 1, available }
}

function claim(date: string, room: string, slot: number, ownerId: string, ownerName: string, mode: ClaimMode = ClaimMode.Shared): Claim {
  return { id: `${date}|${room}|${slot}`, sessionId: `${date}|${room}`, slot, mode, ownerId, ownerName }
}

export const FIXTURE: RoomsData = {
  sessions: [
    session('2026-10-12', DayType.Monday, SE),
    session('2026-10-19', DayType.Monday, SE),
    session('2026-10-26', DayType.Monday, SE),
    session('2026-11-02', DayType.Monday, SE, false),
    session('2026-10-15', DayType.Thursday, SE),
    session('2026-10-22', DayType.Thursday, SE),
    session('2026-10-22', DayType.Thursday, S),
    session('2026-10-29', DayType.Thursday, SE),
  ],
  claims: [
    // Past Monday: Sam alone.
    claim('2026-10-19', SE, 1, 'sam', 'Sam'),
    // Next Thursday: me + Sam in SE; Alex quiet in S.
    claim('2026-10-22', SE, 1, ME, 'Me'),
    claim('2026-10-22', SE, 2, 'sam', 'Sam'),
    claim('2026-10-22', S, 1, 'alex', 'Alex', ClaimMode.Quiet),
    claim('2026-10-22', S, 2, 'alex', 'Alex', ClaimMode.Quiet),
    // Thursday after: Sam alone.
    claim('2026-10-29', SE, 1, 'sam', 'Sam'),
  ],
  closesAt: null,
}
