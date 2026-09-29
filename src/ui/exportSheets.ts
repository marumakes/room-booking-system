import { toSiteClock } from '../domain/dates'
import type { HistoryEntry } from '../domain/history'
import {
  ClaimMode,
  claimsBySession,
  roomsForDay,
  sessionDays,
  sessionDates,
  sessionKey,
  sessionsByKey,
  type Claim,
  type DayType,
  type RoomsData,
  type Session,
} from '../domain/rooms'
import type { SheetTable } from '../domain/spreadsheet'
import { DAY_LABELS, historyText } from './messages'

// Column widths, in characters.
const DATE_WIDTH = 16
const ROOM_WIDTH = 22
const NAME_WIDTH = 20
const TYPE_WIDTH = 12
const WHEN_WIDTH = 18
const WHAT_WIDTH = 44

const NOT_BOOKED_TEXT = 'Not booked'

const MODE_LABELS: Record<ClaimMode, string> = {
  [ClaimMode.Shared]: 'Shared',
  [ClaimMode.Quiet]: 'Quiet room',
}

// The committee's export: a weeks × rooms grid per day, one row per claim, and the claim history.
export function exportTables(data: RoomsData, history: HistoryEntry[]): SheetTable[] {
  return [...sessionDays(data.sessions).map((day) => dayGrid(data, day)), claimsList(data), historyList(history)]
}

// One row per week, one column per room; each cell names who has it, e.g. "Alex, Sam" or "Cora (quiet room)".
// Empty = free; "Not booked" = no room that week (or cancelled).
function dayGrid(data: RoomsData, day: DayType): SheetTable {
  const rooms = roomsForDay(data.sessions, day)
  const byKey = sessionsByKey(data.sessions)
  const bySession = claimsBySession(data.claims)

  const rows = sessionDates(data.sessions, day).map((date) => [
    { date },
    ...rooms.map((room) => gridCell(byKey.get(sessionKey(date, room)), bySession)),
  ])

  return {
    name: DAY_LABELS[day],
    header: ['Week', ...rooms],
    rows,
    widths: [DATE_WIDTH, ...rooms.map(() => ROOM_WIDTH)],
  }
}

function gridCell(session: Session | undefined, bySession: Map<string, Claim[]>): string {
  if (!session || !session.available) {
    return NOT_BOOKED_TEXT
  }

  const claims = [...(bySession.get(session.id) ?? [])].sort((a, b) => a.slot - b.slot)
  const quiet = claims.find((c) => c.mode === ClaimMode.Quiet)

  if (quiet) {
    return `${quiet.ownerName} (quiet room)`
  }

  return claims.map((c) => c.ownerName).join(', ')
}

// One row per host per room-night (a quiet claim's two slots count once), by date then room order.
function claimsList(data: RoomsData): SheetTable {
  const sessionsById = new Map(data.sessions.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const entries: { session: Session; claim: Claim }[] = []

  for (const claim of data.claims) {
    const session = sessionsById.get(claim.sessionId)
    const key = `${claim.sessionId}|${claim.ownerId}`

    if (!session || seen.has(key)) {
      continue
    }

    seen.add(key)
    entries.push({ session, claim })
  }

  entries.sort(
    (a, b) =>
      a.session.date.localeCompare(b.session.date) ||
      a.session.roomPosition - b.session.roomPosition ||
      a.claim.ownerName.localeCompare(b.claim.ownerName),
  )

  return {
    name: 'Claims',
    header: ['Date', 'Day', 'Room', 'Host', 'Type'],
    rows: entries.map(({ session, claim }) => [
      { date: session.date },
      DAY_LABELS[session.day],
      session.room,
      claim.ownerName,
      MODE_LABELS[claim.mode],
    ]),
    widths: [DATE_WIDTH, TYPE_WIDTH, ROOM_WIDTH, NAME_WIDTH, TYPE_WIDTH],
  }
}

// The audit log as shown in the app, newest first, times in London.
function historyList(history: HistoryEntry[]): SheetTable {
  return {
    name: 'History',
    header: ['When', 'What happened', 'Room', 'Session'],
    rows: history.map((e) => [{ londonTime: toSiteClock(e.occurredAt) }, historyText(e), e.room, { date: e.sessionDate }]),
    widths: [WHEN_WIDTH, WHAT_WIDTH, ROOM_WIDTH, DATE_WIDTH],
  }
}
