import { ClaimFailure, isClosed, otherClaimants } from '../domain/claims'
import { formatLongDate } from '../domain/dates'
import { ViewerRole } from '../domain/profile'
import { CellKind, cellView, myRoomsByDate, partTermRooms, type RoomsData } from '../domain/rooms'
import { ClaimSheet } from './ClaimSheet'
import { CommitteeClear } from './CommitteeClear'
import { CLAIM_FAILURE_MESSAGES, cellText, mineTonightText } from './messages'
import type { Notice } from './notice'
import { ReleaseSheet } from './ReleaseSheet'
import { primaryButtonClass, secondaryButtonClass, warningClass } from './Screen'
import { Sheet } from './Sheet'

type SessionSheetProps = {
  data: RoomsData
  sessionId: string
  myId: string
  role: ViewerRole
  today: string
  onClose: () => void
  onDone: (notice: Notice) => void
  // Switches the sheet to another session, e.g. the host's existing room that night.
  onSelect: (sessionId: string) => void
}

// Opens the right sheet for a tapped room: claim if there's space, release if it's yours.
// Committee also get options to clear other hosts' claims. If a live update has since made the
// room full, taken or no longer yours (and there's nothing else to do), says so instead.
export function SessionSheet({ data, sessionId, myId, role, today, onClose, onDone, onSelect }: SessionSheetProps) {
  const session = data.sessions.find((s) => s.id === sessionId)

  if (!session) {
    return null
  }

  const claims = data.claims.filter((c) => c.sessionId === session.id)
  const view = cellView(session, claims, myId, today, myRoomsByDate(data, myId).get(session.date) ?? null)
  const past = session.date < today
  const canClear = role === ViewerRole.Committee && !past && otherClaimants(data, session.id, myId).length > 0
  const committee = canClear ? <CommitteeClear data={data} session={session} myId={myId} onDone={onDone} /> : null

  // After closing, nobody can claim or release: say so when they tap. Committee can still clear.
  if (isClosed(data.closesAt) && !past && (view.kind === CellKind.Mine || view.kind === CellKind.Open)) {
    return (
      <Sheet title={session.room} subtitle={formatLongDate(session.date)} onClose={onClose}>
        <p>{cellText(view)}</p>
        <p role="alert" className={`mt-4 ${warningClass}`}>
          {CLAIM_FAILURE_MESSAGES[ClaimFailure.ClaimsClosed]}
        </p>
        <button type="button" className={secondaryButtonClass} onClick={onClose}>
          Close
        </button>
        {committee}
      </Sheet>
    )
  }

  if (view.kind === CellKind.Mine && !view.past) {
    return (
      <ReleaseSheet
        data={data}
        session={session}
        mode={view.mode}
        myId={myId}
        today={today}
        onClose={onClose}
        onDone={onDone}
        extra={committee}
      />
    )
  }

  if (view.kind === CellKind.Open && !view.past && !view.mineTonight) {
    return (
      <ClaimSheet
        data={data}
        session={session}
        myId={myId}
        today={today}
        partTerm={partTermRooms(data.sessions, session.day).has(session.room)}
        onClose={onClose}
        onDone={onDone}
        extra={committee}
      />
    )
  }

  // Open, but the host already has another room that night: explain, and offer to go to that room.
  if (view.kind === CellKind.Open && !view.past && view.mineTonight) {
    const mine = data.sessions.find((s) => s.date === session.date && s.room === view.mineTonight)

    return (
      <Sheet title={`Claim ${session.room}`} subtitle={formatLongDate(session.date)} onClose={onClose}>
        <p role="alert" className={warningClass}>
          {mineTonightText(view.mineTonight)}
        </p>
        {mine && (
          <button type="button" className={primaryButtonClass} onClick={() => onSelect(mine.id)}>
            Go to {view.mineTonight}
          </button>
        )}
        <button type="button" className={secondaryButtonClass} onClick={onClose}>
          Close
        </button>
        {committee}
      </Sheet>
    )
  }

  // Full, quiet, or past: committee can still clear claims here.
  if (committee) {
    return (
      <Sheet title={session.room} subtitle={formatLongDate(session.date)} onClose={onClose}>
        <p>{cellText(view)}</p>
        {committee}
      </Sheet>
    )
  }

  // Only reachable when a live update changed the room while its sheet was open.
  return (
    <Sheet title={session.room} subtitle={formatLongDate(session.date)} onClose={onClose}>
      <p role="alert">This room changed while you were looking at it. It’s now: {cellText(view)}.</p>
      <button type="button" className={primaryButtonClass} onClick={onClose}>
        OK
      </button>
    </Sheet>
  )
}
