// Claiming and releasing: the contract with the data layer, and client-side rules
// that decide which options to offer. The database re-checks everything.
import { DataFailure } from './failure'
import { ClaimMode, SLOTS_PER_ROOM, myRoomsByDate, sessionDates, type DayType, type RoomsData, type Session } from './rooms'

// Why a claim or release was refused. Mirrors the reason codes raised by the database functions.
export const ClaimFailure = {
  ...DataFailure,
  NotSignedIn: 'not_authenticated',
  EmailNotAllowed: 'email_not_allowed',
  ProfileMissing: 'profile_missing',
  SessionNotFound: 'session_not_found',
  SessionUnavailable: 'session_unavailable',
  SessionPast: 'session_past',
  AlreadyClaimed: 'already_claimed',
  BookedTonight: 'already_booked_tonight',
  RoomTaken: 'room_taken',
  RoomFull: 'room_full',
  NotEveryWeek: 'room_not_every_week',
  NothingToClaim: 'nothing_to_claim',
  NotCommittee: 'not_committee',
  ClaimsClosed: 'claims_closed',
} as const
export type ClaimFailure = (typeof ClaimFailure)[keyof typeof ClaimFailure]

export type ClaimResult = { ok: true } | { ok: false; failure: ClaimFailure }

// A multi-book either succeeds, fails outright, or is refused because some weeks are taken.
export type SeriesResult = ClaimResult | { ok: false; conflicts: string[] }

export type ReleaseResult = { ok: true; released: number } | { ok: false; failure: ClaimFailure }

export interface ClaimsRepo {
  claimSlot(sessionId: string, mode: ClaimMode): Promise<ClaimResult>

  // Every remaining week of a room, all or nothing.
  claimSeries(room: string, day: DayType, mode: ClaimMode): Promise<SeriesResult>

  releaseClaim(sessionId: string): Promise<ReleaseResult>

  // Every remaining week of a room.
  releaseSeries(room: string, day: DayType): Promise<ReleaseResult>

  // Committee only: removes another host's claim on one session.
  clearClaim(sessionId: string, ownerId: string): Promise<ReleaseResult>

  // Committee only: sets when sign-up closes (a timestamp), or removes the closing time with null.
  setClosingTime(closesAt: string | null): Promise<ClaimResult>
}

// Whether sign-up has closed: hosts can no longer claim or release.
export function isClosed(closesAt: string | null, now: Date = new Date()): boolean {
  return closesAt !== null && Date.parse(closesAt) <= now.getTime()
}

export type OtherClaimant = {
  ownerId: string
  ownerName: string
  mode: ClaimMode
}

// Other hosts holding this session (a quiet claim listed once), for committee's "clear" options.
export function otherClaimants(data: RoomsData, sessionId: string, myId: string): OtherClaimant[] {
  const byOwner = new Map<string, OtherClaimant>()

  for (const c of data.claims) {
    if (c.sessionId === sessionId && c.ownerId !== myId) {
      byOwner.set(c.ownerId, { ownerId: c.ownerId, ownerName: c.ownerName, mode: c.mode })
    }
  }

  return [...byOwner.values()]
}

// Whether this host could claim this session in this mode right now. Same rules as the database,
// including one room per host per night.
export function canClaim(data: RoomsData, session: Session, myId: string, mode: ClaimMode, today: string): boolean {
  if (!session.available || session.date < today) {
    return false
  }

  const claims = data.claims.filter((c) => c.sessionId === session.id)

  if (claims.some((c) => c.ownerId === myId) || myRoomsByDate(data, myId).has(session.date)) {
    return false
  }

  if (mode === ClaimMode.Quiet) {
    return claims.length === 0
  }

  return !claims.some((c) => c.mode === ClaimMode.Quiet) && claims.length < SLOTS_PER_ROOM
}

// The room's sessions on that day, oldest first.
export function roomSessions(data: RoomsData, room: string, day: DayType): Session[] {
  return data.sessions.filter((s) => s.room === room && s.day === day).sort((a, b) => a.date.localeCompare(b.date))
}

// Dates the room is booked on that day, for the "not every week" warning.
export function roomDates(data: RoomsData, room: string, day: DayType): string[] {
  return roomSessions(data, room, day).map((s) => s.date)
}

export type SeriesOption = { available: true; weeks: number } | { available: false }

// Whether "every week" can be offered: the room is booked every week, and every remaining week
// is either already this host's or free in this mode. weeks = how many new weeks it would claim.
export function seriesOption(
  data: RoomsData,
  room: string,
  day: DayType,
  mode: ClaimMode,
  myId: string,
  today: string,
): SeriesOption {
  const sessions = roomSessions(data, room, day)

  if (sessions.length !== sessionDates(data.sessions, day).length) {
    return { available: false }
  }

  let weeks = 0

  for (const session of sessions.filter((s) => s.date >= today)) {
    if (data.claims.some((c) => c.sessionId === session.id && c.ownerId === myId)) {
      continue
    }

    if (!canClaim(data, session, myId, mode, today)) {
      return { available: false }
    }

    weeks++
  }

  return weeks > 0 ? { available: true, weeks } : { available: false }
}

// Remaining weeks of this room the host holds on that day, to offer "release all remaining weeks".
export function heldWeeks(data: RoomsData, room: string, day: DayType, myId: string, today: string): number {
  const mine = new Set(data.claims.filter((c) => c.ownerId === myId).map((c) => c.sessionId))
  return roomSessions(data, room, day).filter((s) => s.date >= today && mine.has(s.id)).length
}
