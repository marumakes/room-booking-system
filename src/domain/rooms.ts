// Rooms, sessions and claims, and the rules for how each room slot looks to a host.
import type { DataFailure } from './failure'

// Weekdays, matching the database's day_type. Which ones are session days comes from the seeded sessions.
export const DayType = {
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
  Sunday: 'sunday',
} as const
export type DayType = (typeof DayType)[keyof typeof DayType]

// Every weekday, Monday first.
export const DAY_TYPES: readonly DayType[] = Object.values(DayType)

export const ClaimMode = {
  Shared: 'shared',
  Quiet: 'quiet',
} as const
export type ClaimMode = (typeof ClaimMode)[keyof typeof ClaimMode]

// Slots per room: up to 2 hosts share a room, or one host takes both in quiet mode.
export const SLOTS_PER_ROOM = 2

// One booked room on one night.
export type Session = {
  id: string
  date: string
  day: DayType
  room: string
  roomPosition: number
  available: boolean
}

// One host's hold on one slot. A quiet claim is two of these with the same owner.
export type Claim = {
  id: string
  sessionId: string
  slot: number
  mode: ClaimMode
  ownerId: string
  ownerName: string
}

export type RoomsData = {
  sessions: Session[]
  claims: Claim[]
  // When sign-up closes (a timestamp), or null if the committee hasn't set one.
  closesAt: string | null
}

export type RoomsResult = { ok: true; data: RoomsData } | { ok: false; failure: DataFailure }

export interface RoomsRepo {
  // Every session and claim. Small enough (a few hundred rows) to load in one go.
  loadRooms(): Promise<RoomsResult>

  // Calls back whenever claims, display names or the closing time may have changed: on each change, and after a
  // dropped live connection comes back (changes may have been missed). Returns unsubscribe.
  onChange(callback: () => void): () => void
}

export function isDayType(value: string | undefined): value is DayType {
  return DAY_TYPES.includes(value as DayType)
}

// Session dates for one day, oldest first.
export function sessionDates(sessions: Session[], day: DayType): string[] {
  const dates = new Set(sessions.filter((s) => s.day === day).map((s) => s.date))
  return [...dates].sort()
}

// Rooms used on that day, in venue-PDF order.
export function roomsForDay(sessions: Session[], day: DayType): string[] {
  const positions = new Map<string, number>()

  for (const s of sessions) {
    if (s.day === day) {
      positions.set(s.room, s.roomPosition)
    }
  }

  return [...positions.keys()].sort((a, b) => positions.get(a)! - positions.get(b)! || a.localeCompare(b))
}

// Rooms not booked on every date of that day. Same rule as the database's multi-book check.
export function partTermRooms(sessions: Session[], day: DayType): Set<string> {
  const dateCount = sessionDates(sessions, day).length
  const nightsPerRoom = new Map<string, number>()

  for (const s of sessions) {
    if (s.day === day) {
      nightsPerRoom.set(s.room, (nightsPerRoom.get(s.room) ?? 0) + 1)
    }
  }

  return new Set([...nightsPerRoom].filter(([, nights]) => nights < dateCount).map(([room]) => room))
}

// The first session on or after today, or null once the term is over.
export function nextSessionDate(dates: string[], today: string): string | null {
  return dates.find((d) => d >= today) ?? null
}

// The days that have sessions, Monday first, e.g. [tuesday, friday]. Drives the day tabs and export.
export function sessionDays(sessions: Session[]): DayType[] {
  const days = new Set(sessions.map((s) => s.day))
  return DAY_TYPES.filter((d) => days.has(d))
}

// The day whose next session comes soonest (the first session day if the term is over).
export function defaultDay(sessions: Session[], today: string): DayType {
  let best: { day: DayType; date: string } | null = null

  for (const day of DAY_TYPES) {
    const next = nextSessionDate(sessionDates(sessions, day), today)

    if (next && (!best || next < best.date)) {
      best = { day, date: next }
    }
  }

  return best?.day ?? sessionDays(sessions)[0] ?? DayType.Monday
}

// The session date to show: the requested one if it's a session, else the next session
// on or after it. With nothing requested, the next session from today. Falls back to the last date.
export function resolveWeek(dates: string[], requested: string | null, today: string): string | null {
  if (dates.length === 0) {
    return null
  }

  const from = requested ?? today
  return nextSessionDate(dates, from) ?? dates[dates.length - 1]
}

export const CellKind = {
  NotBooked: 'not_booked',
  Open: 'open',
  Mine: 'mine',
  Full: 'full',
  Quiet: 'quiet',
} as const
export type CellKind = (typeof CellKind)[keyof typeof CellKind]

// What one room on one night looks like to the signed-in host.
// "past" sessions keep their state but can't be changed.
export type CellView =
  | { kind: typeof CellKind.NotBooked }
  | { kind: typeof CellKind.Open; spacesLeft: number; others: string[]; past: boolean; mineTonight: string | null }
  | { kind: typeof CellKind.Mine; mode: ClaimMode; others: string[]; past: boolean }
  | { kind: typeof CellKind.Full; names: string[]; past: boolean }
  | { kind: typeof CellKind.Quiet; name: string; past: boolean }

// Derives a cell from the session (if booked) and its claims.
// Cancelled sessions count as not booked. myRoomTonight is the room the host already holds that night, if any:
// an open room is then shown but can't be claimed (one room per host per night).
export function cellView(
  session: Session | undefined,
  claims: Claim[],
  myId: string,
  today: string,
  myRoomTonight: string | null = null,
): CellView {
  if (!session || !session.available) {
    return { kind: CellKind.NotBooked }
  }

  const past = session.date < today
  const quiet = claims.find((c) => c.mode === ClaimMode.Quiet)
  const mine = claims.find((c) => c.ownerId === myId)
  const others = [...new Set(claims.filter((c) => c.ownerId !== myId).map((c) => c.ownerName))]

  if (mine) {
    return { kind: CellKind.Mine, mode: mine.mode, others, past }
  }

  if (quiet) {
    return { kind: CellKind.Quiet, name: quiet.ownerName, past }
  }

  if (claims.length >= SLOTS_PER_ROOM) {
    return { kind: CellKind.Full, names: others, past }
  }

  const mineTonight = myRoomTonight && myRoomTonight !== session.room ? myRoomTonight : null
  return { kind: CellKind.Open, spacesLeft: SLOTS_PER_ROOM - claims.length, others, past, mineTonight }
}

// Claims grouped by session, for looking up a cell's claims.
export function claimsBySession(claims: Claim[]): Map<string, Claim[]> {
  const bySession = new Map<string, Claim[]>()

  for (const c of claims) {
    bySession.set(c.sessionId, [...(bySession.get(c.sessionId) ?? []), c])
  }

  return bySession
}

// The room the host holds on each date, e.g. "2026-11-05" → "Harcourt 1.04". At most one per night.
export function myRoomsByDate(data: RoomsData, myId: string): Map<string, string> {
  const sessionsById = new Map(data.sessions.map((s) => [s.id, s]))
  const byDate = new Map<string, string>()

  for (const c of data.claims) {
    const session = sessionsById.get(c.sessionId)

    if (c.ownerId === myId && session) {
      byDate.set(session.date, session.room)
    }
  }

  return byDate
}

// Sessions keyed by "date|room", for looking up a grid cell.
export function sessionKey(date: string, room: string): string {
  return `${date}|${room}`
}

export function sessionsByKey(sessions: Session[]): Map<string, Session> {
  return new Map(sessions.map((s) => [sessionKey(s.date, s.room), s]))
}

export type MySession = {
  sessionId: string
  date: string
  day: DayType
  room: string
  mode: ClaimMode
}

// The host's claims, one entry per room-night (a quiet claim's two slots count once), soonest first.
export function mySessions(data: RoomsData, myId: string): MySession[] {
  const sessionsById = new Map(data.sessions.map((s) => [s.id, s]))
  const bySession = new Map<string, MySession>()

  for (const c of data.claims) {
    const session = sessionsById.get(c.sessionId)

    if (c.ownerId !== myId || !session) {
      continue
    }

    bySession.set(session.id, { sessionId: session.id, date: session.date, day: session.day, room: session.room, mode: c.mode })
  }

  const position = (m: MySession) => sessionsById.get(m.sessionId)!.roomPosition
  return [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date) || position(a) - position(b))
}
