import { useState, type ReactNode } from 'react'
import { heldWeeks, type ReleaseResult } from '../domain/claims'
import { formatLongDate, formatShortDate } from '../domain/dates'
import { ClaimMode, type RoomsData, type Session } from '../domain/rooms'
import { CLAIM_FAILURE_MESSAGES } from './messages'
import { NoticeKind, type Notice } from './notice'
import { useRepos } from './repos'
import { ErrorText, primaryButtonClass, secondaryButtonClass } from './Screen'
import { Sheet } from './Sheet'

type ReleaseSheetProps = {
  data: RoomsData
  session: Session
  mode: ClaimMode
  myId: string
  today: string
  onClose: () => void
  onDone: (notice: Notice) => void
  // Shown below the main content, e.g. committee's clear options.
  extra?: ReactNode
}

// Give up a claim: this week only, or every remaining week of this room.
export function ReleaseSheet({ data, session, mode, myId, today, onClose, onDone, extra }: ReleaseSheetProps) {
  const { claims } = useRepos()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const weeksHeld = heldWeeks(data, session.room, session.day, myId, today)

  async function release(action: () => Promise<ReleaseResult>, done: string) {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)

    if (!result.ok) {
      setError(CLAIM_FAILURE_MESSAGES[result.failure])
      return
    }

    onDone({ kind: NoticeKind.Success, text: done })
  }

  return (
    <Sheet title={`Your claim: ${session.room}`} subtitle={formatLongDate(session.date)} onClose={onClose}>
      <p className="text-muted">
        {mode === ClaimMode.Quiet ? 'You have this room as a quiet room.' : 'You have a space in this room.'} Releasing it lets
        another host claim it straight away.
      </p>
      <ErrorText message={error} />
      <button
        type="button"
        className={primaryButtonClass}
        disabled={busy}
        onClick={() =>
          void release(() => claims.releaseClaim(session.id), `Released ${session.room} on ${formatShortDate(session.date)}.`)
        }
      >
        Release this week
      </button>
      {weeksHeld > 1 && (
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={busy}
          onClick={() =>
            void release(
              () => claims.releaseSeries(session.room, session.day),
              `Released ${session.room} for all remaining weeks.`,
            )
          }
        >
          Release all remaining weeks ({weeksHeld})
        </button>
      )}
      {extra}
    </Sheet>
  )
}
